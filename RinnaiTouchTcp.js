const RinnaiTouchUdp = require('./RinnaiTouchUdp');
const net = require('net');

class RinnaiTouchTcp {
    constructor(options) {
        this.log = options.log || console.log;
        this.debug = options.debug === true;
        this.timeout = options.timeout || 5000;
        this.udp = new RinnaiTouchUdp(options);
        this.address = null;
        this.socket = null;
    }

    connect() {
        if (this.debug) this.log('RinnaiTouchTcp.connect()');
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
        if (this.debug) this.log('RinnaiTouchTcp.destroy()');
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
        if (this.debug) this.log('RinnaiTouchTcp.read()');
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
        if (this.debug) this.log(`RinnaiTouchTcp.write('${data}')`);
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