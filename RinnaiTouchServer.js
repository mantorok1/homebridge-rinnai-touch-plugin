const RinnaiTouchTcp = require('./RinnaiTouchTcp');
const RinnaiTouchStatus = require('./RinnaiTouchStatus');
const cq = require('concurrent-queue');

class RinnaiTouchServer {
    constructor(options = {}) {
        this.options = options;
        this.log = options.log || console.log;
        this.debug = options.debug === true;
        this.tcp = new RinnaiTouchTcp(options);
        this.status = undefined;

        this.tcpStates = {
            OPEN: 0,
            CLOSING: 1,
            CLOSED: 2
        };
        this.tcpState = this.tcpStates.CLOSED;

        this.queue = cq()
            .limit({ concurrency: 1 })
            .process(this.process.bind(this));
    }

    async getStatus() {
        try {
            if (this.debug) this.log('RinnaiTouchServer.getStatus()');
            this.status = await this.queue();
            return this.status;
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    async sendCommand(command) {
        try {
            if (this.debug) this.log(`RinnaiTouchServer.sendCommand('${JSON.stringify(command)}')`);
            this.status = await this.queue(command);
            return this.status;
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    async process(command) {
        try {
            if (this.debug) this.log(`RinnaiTouchServer.process(${JSON.stringify(command)})`);
            if (command === undefined && this.status !== undefined) {
                return this.status;
            }

            if (this.tcpState === this.tcpStates.CLOSING) {
                await this.connectionClosed();
            }

            let status = undefined;
            if (this.tcpState === this.tcpStates.CLOSED) {
                status = await this.connect();
            }

            if (command) {
                await this.tcp.write(command.instruction);
                status = await this.expectedState(command.expect);
            }

            if (status === undefined) {
                status = await this.tcp.read();
            }

            return new RinnaiTouchStatus(status, this.options);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    async expectedState(expect) {
        let status = undefined;
        try {
            if (this.debug) this.log(`RinnaiTouchServer.expectedState(${JSON.stringify(expect)})`);
            
            const startTime = Date.now();
            while(Date.now() - startTime < 10000) {
                status = await this.tcp.read();
                let rtStatusObj = new RinnaiTouchStatus(status);
                if (rtStatusObj.getState(expect.path) === expect.state) {
                    this.log(`State change succeeded: Took ${Date.now() - startTime} ms`);
                    return status;
                }
            }
            this.log(`WARNING: State change failed: Expected state "${expect.state}" at ${expect.path}`);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
        return status;
    }

    async connectionClosed() {
        if (this.debug) this.log('RinnaiTouchServer.connectionClosed()');

        for(let i = 0; i < 10; i++) {
            await this.delay(500);
            if (this.tcpState === this.tcpStates.CLOSED) {
                return;
            }
        }
        throw new Error('Connection was not closed within time limit');
    }

    async connect(limit = 3, ms = 1000) {
        if (this.debug) this.log(`RinnaiTouchServer.connect(${limit}, ${ms})`);

        for(let i = 1; i <= limit; i++) {
            try {
                let status = await this.tcp.connect();
                this.tcpState = this.tcpStates.OPEN;
                return status;
            } catch(e) {
                this.log(`Connect failed: ${e.message} [Attempt ${i} of ${limit}]`)
                await this.delay(ms);
            } 
        }

        throw new error('Unable to connect to Rinnai Touch Module');
    }

    async destroy(ms = 1100) {
        if (this.debug) this.log('RinnaiTouchServer.destroy()');

        try {
            this.tcpState = this.tcpStates.CLOSING;
            await this.tcp.destroy();
            await this.delay(ms);
            this.tcpState = this.tcpStates.CLOSED;
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    async delay(ms) {
        await new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

module.exports = RinnaiTouchServer;