const dgram = require('dgram');

class RinnaiTouchUdp {
    #log;
    #timeout;
    #port = 50000;

    constructor(log, timeout = 5000) {
        this.#log = log;
        this.#log.debug(this.constructor.name, undefined, 'log', timeout);
        this.#timeout = timeout;
    }

    getAddress() {
        this.#log.debug(this.constructor.name, 'getAddress');

        let self = this;
        return new Promise((resolve, reject) => {
            let socket = dgram.createSocket('udp4');

            let timer = setTimeout(() => {
                socket.removeAllListeners();
                socket.close();
                reject(new Error('Timeout occured. No UDP message received from Rinnai Touch Module'));
            }, self.#timeout);
    
            socket.on('message', (message, remote) => {
                if (message.toString().substr(0, 18) === 'Rinnai_NBW2_Module') {
                    clearTimeout(timer);
                    socket.removeAllListeners();
                    socket.close();
                    const port = message[32] * 256 + message[33];
                    this.#log.info(`Found Rinnai Touch module at ${remote.address}:${port}`)
                    resolve({
                        address: remote.address,
                        port: port
                    });
                }            
            });
    
            socket.on('error', (error) => {
                clearTimeout(timer);
                socket.removeAllListeners();
                socket.close();
                reject(error);
            });
    
            socket.bind(self.#port);
        });
    }
}

module.exports = RinnaiTouchUdp;