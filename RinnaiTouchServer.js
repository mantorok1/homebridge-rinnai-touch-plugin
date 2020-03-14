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

        this.queue.drained(() => {
            this.status = undefined;
            if (this.debug) this.log('queue is drained');
        });
    }

    async getStatus() {
        try {
            if (this.debug) this.log('RinnaiTouchServer.getStatus()');
            this.status = await this.queue();
            return this.status;
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

            let status = await this.tcp.connect();
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
}

module.exports = RinnaiTouchServer;