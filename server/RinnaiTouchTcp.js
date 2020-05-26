const RinnaiTouchUdp = require('./RinnaiTouchUdp');
const net = require('net');

class RinnaiTouchTcp {
    #log;

    constructor(log, timeout = 5000) {
        this.#log = log;
        this.#log.debug(this.constructor.name, undefined, 'log', timeout);

        this.udp = new RinnaiTouchUdp(log, timeout);
        this.address = null;
        this.socket = null;
    }

    connect() {
        this.#log.debug(this.constructor.name, 'connect');

        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                if (!self.address) {
                    self.address = await self.udp.getAddress();
                }

                if (self.socket) {
                    self.socket.removeAllListeners();
                    self.socket.destroy();
                    self.socket = null;
                }

                self.socket = new net.Socket();
        
                self.socket.on('data', (data) => {
                    data = data.toString();
                    if (data.substr(0, 1) === "N") {
                        self.socket.removeAllListeners();
                        resolve(data.substr(7));
                    }
                });
        
                self.socket.on('error', (error) => {
                    self.address = undefined;
                    self.socket.removeAllListeners();
                    reject(error);
                });
        
                self.socket.connect(self.address.port, self.address.address);
            }
            catch(error) {
                self.address = undefined;
                if (self.socket) {
                    self.socket.removeAllListeners();
                }
                reject(error);
            }
        });
    }

    destroy() {
        this.#log.debug(this.constructor.name, 'destroy');

        let self = this;
        return new Promise((resolve, reject) => {
            if (self.socket) {
                self.socket.removeAllListeners();
                self.socket.destroy();
                self.socket = null;
            } 
            resolve();
        });
    }

    read() {
        this.#log.debug(this.constructor.name, 'read');

        let self = this;
        return new Promise((resolve, reject) => {
            self.socket.on('data', (data) => {
                data = data.toString();
                if (data.substr(0, 1) === "N") {
                    self.socket.removeAllListeners();
                    resolve(data.substr(7));
                }
            });

            self.socket.on('error', (error) => {
                self.socket.removeAllListeners();
                reject(error);
            });
        });
    }

    write(data) {
        this.#log.debug(this.constructor.name, 'write', data);

        let self = this;
        return new Promise((resolve, reject) => {
            try {
                self.socket.write(data, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            }
            catch(error) {
                reject(error);
            }
        });
    }
}

module.exports = RinnaiTouchTcp;