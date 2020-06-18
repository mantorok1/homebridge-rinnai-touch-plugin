const RinnaiTouchTcp = require('./RinnaiTouchTcp');
const EventEmitter = require('events');
const cq = require('concurrent-queue');

class RinnaiTouchRepository extends EventEmitter {
    #log;
    #connectionCloseDelay;
    #connectionTimeout;
    #connectionStates = {
        OPEN: 0,
        CLOSING: 1,
        CLOSED: 2
    };
    #connectionState;
    #timer;
    #tcp;
    #queue;
    #sequenceNumber;
    #status;
    #timestamp;
    #previousStatus;
    #address;

    constructor(log, settings) {
        super();
        this.#log = log;
        this.#log.debug(this.constructor.name, undefined, 'log', 'settings');

        this.#connectionCloseDelay = settings.closeConnectionDelay;
        this.#connectionTimeout = settings.connectionTimeout;
        this.#connectionState = this.#connectionStates.CLOSED;

        if (settings.address) {
            this.#address = {
                address: settings.address,
                port: settings.port || 27847
            };
        }

        this.#tcp = new RinnaiTouchTcp(log, this.#address);
        this.#tcp.on('data', this.dataHandler.bind(this));

        if (settings.connectionTimeout < 0) {
            this.#tcp.on('timeout', () => {
                this.execute({type: 'get'});
            });
        }

        this.#queue = cq()
            .limit({ concurrency: 1 })
            .process(this.process.bind(this));

        this.#queue.drained(this.drained.bind(this));
    }

    async execute(request) {
        this.#log.debug(this.constructor.name, 'execute', JSON.stringify(request));

        try {
            return await this.#queue(request);
        }
        catch (error) {
            this.#log.error(error);
            throw error;
        }
    }

    async process(request) {
        this.#log.debug(this.constructor.name, 'process', JSON.stringify(request));

        try {
            if (request.type === 'close') {
                await this.closeConnection();
                return;
            }

            if (request.type === 'get' && (Date.now() - this.#timestamp <= 1000)) {
                return this.#status;
            }

            clearTimeout(this.#timer);
            if (this.#connectionState === this.#connectionStates.OPEN) {
                // If no status receieved for > 2 sec then close connection.
                if (Date.now() - this.#timestamp > 2000) {
                    await this.closeConnection();
                }
            }
            else if (this.#connectionState === this.#connectionStates.CLOSING) {
                await this.connectionClosed();
            }
            if (this.#connectionState === this.#connectionStates.CLOSED) {
                await this.connect();
                this.#connectionState = this.#connectionStates.OPEN;
            }

            // Wait for new status to be emitted from tcp
            if (request.type === 'get') {
                let ts = this.#timestamp;
                for(let i = 0; i < 10; i++) {
                    await this.delay(500);
                    if (ts !== this.#timestamp) {
                        return this.#status;
                    }
                }
                throw new Error('Failed to get new status');
            }
 
            let command = this.getCommand(request);
            this.#log.info(`Sending Command: ${command}`);
            for(let i = 1; i <= 3; i++) {
                await this.#tcp.write(command);

                let success = await this.commandSucceeded(command);
                if (success) {
                    return;
                }
                this.#log.warn(`Command failed. Attempt ${i} of 3`);
            }
        }
        catch (error) {
            this.#log.error(error);
            throw error;
        }
    }

    async connect() {
        this.#log.debug(this.constructor.name, 'connect');

        for(let i = 1; i <= 3; i++) {
            try {
                await this.#tcp.connect();
                return;
            }
            catch(error) {
                this.#log.warn(`TCP Connection failed. ${error.message}. Attempt ${i} of 3`);
                await this.delay(500);
            }
        }
        throw new Error('Unable to connect');
    }

    getCommand(request) {
        this.#log.debug(this.constructor.name, 'getCommand', JSON.stringify(request));

        let sequenceNumber = ((this.#sequenceNumber + 1) % 255).toString().padStart(6, '0');

        if (request.type === 'set') {
            let path = request.path.split('.');
            return `N${sequenceNumber}{"${path[0]}":{"${path[1]}":{"${path[2]}":"${request.state}"}}}`;
        }

        return `N${sequenceNumber}${request.command}`;
    }

    commandSucceeded(command) {
        this.#log.debug(this.constructor.name, 'commandSucceeded', command);

        let json = JSON.parse(command.substr(7));
        let group1 = Object.keys(json)[0];
        let group2 = Object.keys(json[group1])[0];
        let cmd = Object.keys(json[group1][group2])[0];
        let state = json[group1][group2][cmd];
        let item = group1 === 'SYST' ? 0 : 1;

        return new Promise((resolve, reject) => {
            try {
                const startTime = Date.now();

                let timer = setTimeout(() => {
                    this.removeAllListeners('status');
                    resolve(false);
                }, 10000);

                this.on('status', (status) => {
                    if (status[item][group1][group2][cmd] === state) {
                        clearTimeout(timer);
                        this.#log.info(`Command succeeded. Took ${Date.now() - startTime} ms`);
                        this.removeAllListeners('status');
                        resolve(true);
                    }
                });
            }
            catch(error) {
                this.removeAllListeners('status');
                reject(error);
            }
        });
    }

    async drained() {
        this.#log.debug(this.constructor.name, 'drained');

        if (this.#connectionState !== this.#connectionStates.OPEN) {
            return;
        }

        if (this.#connectionTimeout < 0) {
            return;
        }

        if (this.#connectionTimeout === 0) {
            await this.execute({type: 'close'});
            return;
        }

        this.#timer = setTimeout(async () => {
            await this.execute({type: 'close'});
        }, this.#connectionTimeout);
    }

    async closeConnection() {
        this.#log.debug(this.constructor.name, 'closeConnection');

        try {
            if (this.#connectionState !== this.#connectionStates.OPEN) {
                return;
            }

            this.#connectionState = this.#connectionStates.CLOSING;
            this.#tcp.destroy();
            await this.delay(this.#connectionCloseDelay);
            this.#connectionState = this.#connectionStates.CLOSED;
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    dataHandler(message) {
        this.#log.debug(this.constructor.name, 'dataHandler', message);

        this.#sequenceNumber = parseInt(message.substr(1, 6));
        this.#timestamp = Date.now();
        const newStatus = message.substr(7);
        if (this.#previousStatus !== newStatus) {
            this.#status = JSON.parse(newStatus);
            this.#previousStatus = newStatus;
            this.emit('status', this.#status);
        }
    }

    async delay(ms) {
        await new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    async connectionClosed() {
        this.#log.debug(this.constructor.name, 'connectionClosed');

        for(let i = 0; i < 10; i++) {
            await this.delay(500);
            if (this.#connectionState === this.#connectionStates.CLOSED) {
                return;
            }
        }
        throw new Error('Connection was not closed within time limit');
    }
}

module.exports = RinnaiTouchRepository