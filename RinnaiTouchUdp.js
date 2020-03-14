const dgram = require('dgram');

class RinnaiTouchUdp {
    constructor(options) {
        this.log = options.log || console.log;
        this.debug = options.debug === true;
        this.timeout = options.timeout || 5000;
        this.port = 50000;
    }

    getAddress() {
        if (this.debug) this.log('RinnaiTouchUdp.getAddress()');
        let self = this;
        return new Promise((resolve, reject) => {
            let socket = dgram.createSocket('udp4');

            let timer = setTimeout(() => {
                socket.removeAllListeners();
                socket.close();
                reject(new Error('Timeout occured. No UDP message received from Rinnai Touch Module'));
            }, self.timeout);
    
            socket.on('message', (message, remote) => {
                if (message.toString().substr(0, 18) === 'Rinnai_NBW2_Module') {
                    clearTimeout(timer);
                    socket.removeAllListeners();
                    socket.close();
                    resolve({
                        address: remote.address,
                        port: message[32] * 256 + message[33]
                    });
                }            
            });
    
            socket.on('error', (error) => {
                clearTimeout(timer);
                socket.removeAllListeners();
                socket.close();
                reject(error);
            });
    
            socket.bind(self.port);
        });
    }
}

module.exports = RinnaiTouchUdp;