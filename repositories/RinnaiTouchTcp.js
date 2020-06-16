const RinnaiTouchUdp = require('./RinnaiTouchUdp');
const net = require('net');
var EventEmitter = require('events');

class RinnaiTouchTcp extends EventEmitter {
    #log;
    #udp;
    #defaultAddress;
    #address;
    #socket;

    constructor(log, address, timeout = 5000) {
        super();
        this.#log = log;
        this.#defaultAddress = address;
        this.#log.debug(this.constructor.name, undefined, 'log', JSON.stringify(address), timeout);
        this.#udp = new RinnaiTouchUdp(log, timeout);
    }

    connect() {
        this.#log.debug(this.constructor.name, 'connect');

        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                if (!self.#address) {
                    self.#address = this.#defaultAddress === undefined
                        ? await self.#udp.getAddress()
                        : this.#defaultAddress;
                }

                if (self.#socket) {
                    resolve();
                }    
                
                self.#socket = new net.Socket();
        
                self.#socket.on('data', (data) => {
                    data = data.toString();
                    if (data.substr(0, 1) === 'N') {
                        self.emit('data', data);
                        resolve();
                    }
                });
        
                self.#socket.on('error', (error) => {
                    self.#address = undefined;
                    self.#socket.removeAllListeners();
                    self.#socket = null;
                    reject(error);
                });

                self.#socket.on('ready', () => {
                    self.#log.info('TCP Connection: Open');
                });

                self.#socket.on('timeout', () => {
                    self.#log.info('TCP Connection: Timed out');
                    self.emit('timeout');
                });
        
                self.#socket.connect(self.#address.port, self.#address.address);
                self.#socket.setTimeout(5000);
            }
            catch(error) {
                self.#address = undefined;
                if (self.#socket) {
                    self.#socket.removeAllListeners();
                    self.#socket = null;
                }
                reject(error);
            }
        });
    }

    destroy() {
        this.#log.debug(this.constructor.name, 'destroy');

        if (this.#socket) {
            this.#socket.removeAllListeners();
            this.#socket.destroy();
            this.#socket = null;
            this.#log.info('TCP Connection: Closed');
        } 
    }

    write(data) {
        this.#log.debug(this.constructor.name, 'write', data);

        let self = this;
        return new Promise((resolve, reject) => {
            try {
                self.#socket.write(data, (error) => {
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