class NativePayload {
    #log;
    #server;

    constructor(platform) {
        this.#log = platform.log;
        this.#log.debug(this.constructor.name, undefined, 'platform');

        this.#server = platform.server;
    }

    async getStatus() {
        this.#log.debug(this.constructor.name, 'getStatus');

        try {
            const status = await this.#server.getStatus();
            return status.toString();
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async processCommand(payload) {
        this.#log.debug(this.constructor.name, 'processCommand', payload);

        try {
            let json = JSON.parse(payload);

            let group1 = Object.keys(json)[0];
            let group2 = Object.keys(json[group1])[0];
            let cmd = Object.keys(json[group1][group2])[0];
            let state = json[group1][group2][cmd];
    
            let expect = {
                path: `${group1}.${group2}.${cmd}`,
                state: state
            };
    
            let command = {
                instruction: `N000001${payload}`,
                expect: expect
            };
    
            this.#log.info(JSON.stringify(command));
            await this.#server.sendCommand(command)    
        }
        catch(error) {
            this.#log.error(error);
        }
    }
}

module.exports = NativePayload;