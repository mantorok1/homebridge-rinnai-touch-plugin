const RinnaiTouchTcp = require('./RinnaiTouchTcp');
const cq = require('concurrent-queue');

class RinnaiTouchServer {
    constructor(options) {
        this.log = options.log || console.log;
        this.debug = options.debug === true;
        this.tcp = new RinnaiTouchTcp(options);
        this.status = undefined;

        this.queue = cq()
            .limit({ concurrency: 1 })
            .process(this.process.bind(this));
    }

    async getStatus() {
        try {
            if (this.debug) this.log('RinnaiTouchServer.getStatus()');
            this.status = await this.queue();
            return JSON.parse(this.status);
        }
        catch(error) {
            throw error;
        }
    }

    async sendCommand(command) {
        try {
            if (this.debug) this.log(`RinnaiTouchServer.sendCommand('${command}')`);
            await this.queue(command);
            this.status = undefined;
        }
        catch(error) {
            throw error;
        }
    }

    async process(command) {
        try {
            if (this.debug) this.log(`RinnaiTouchServer.process('${command}')`);
            if (command === undefined && this.status !== undefined) {
                return this.status;
            }

            let status = await this.connect();
            if (command) {
                await this.tcp.write(command);
            }
            return status;
        }
        catch(error) {
            throw error;
        }
        finally {
            await this.tcp.destroy();
        }
    }

    async connect(limit = 3, delay = 1000) {
        if (this.debug) this.log(`RinnaiTouchServer.connect(${limit}, ${delay})`);

        for(let i = 1; i <= limit; i++) {
            try {
                return await this.tcp.connect();
            } catch(e) {
                this.log(`Connect failed: ${e.message} [Attempt ${i} of ${limit}]`)
                await new Promise((resolve) => {
                    setTimeout(resolve, delay);
                });
            } 
        }

        throw new error('Unable to connect to Rinnai Touch Module');
    }
}

module.exports = RinnaiTouchServer;