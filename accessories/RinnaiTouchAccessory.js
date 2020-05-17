const crypto = require('crypto');
const PluginVersion = require('../package.json').version;

let Accessory, Service, Characteristic, UUIDGen;

class RinnaiTouchAccessory {
    constructor(platform) {
        this.log = platform.log;
        this.debug = platform.debug;
        this.debug('RinnaiTouchAccessory', undefined, 'platform');

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;

        this.map = platform.map;
        this.server = platform.server;
        this.accessory = null;
    }

    getKey(zone) {
        this.debug('RinnaiTouchAccessory', 'getKey', zone);

        let key = this.name;

        if (this.accessory !== null && this.accessory.context.zone !== undefined) {
            key += `_${this.accessory.context.zone}`;
        }
        else if (zone !== undefined) {
            key += `_${zone}`;
        }
        return key;
    }

    configure(accessory) {
        this.debug('RinnaiTouchAccessory', 'configure', 'accessory');

        this.accessory = accessory;
        this.setAccessoryInformation();
        this.setEventHandlers();
    }

    setAccessoryInformation() {
        this.debug('RinnaiTouchAccessory', 'setAccessoryInformation');

        this.accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, 'Rinnai')
            .setCharacteristic(Characteristic.Model, 'N-BW2')
            .setCharacteristic(Characteristic.SerialNumber, 
                crypto.createHash('sha1').update(this.accessory.UUID).digest('hex'))
            .setCharacteristic(Characteristic.FirmwareRevision, PluginVersion);
    }

    async getCharacteristicValue(getValue, callback) {
        this.debug('RinnaiTouchAccessory', 'getCharacteristicValue', 'getValue', 'callback');
        try {
            let status = await this.server.getStatus();
            let value = getValue(status);

            callback(null, value);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }
    }

    async setCharacteristicValue(setValue, value, callback) {
        this.debug('RinnaiTouchAccessory', 'setCharacteristic', 'setValue', value, 'callback');
        try {
            let status = await this.server.getStatus();
            let commands = setValue(value, status);

            for(let command of commands) {
                if (command !== undefined) {
                    await this.server.sendCommand(command);
                }
            }
            
            callback(null);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }
    }

    getCommand(path, state, expect) {
        this.debug('RinnaiTouchAccessory', 'getCommand', path, state, JSON.stringify(expect));

        if (path === undefined) {
            this.log('ERROR: Cannot determine path for command');
            return undefined;
        }

        if (state === undefined) {
            this.log('ERROR: Unable to determine state for command');
            return undefined;
        }

        if (expect === undefined) {
            expect = {
                path: path,
                state: state
            }
        }

        path = path.split('.');
        return {
            instruction: `N000001{"${path[0]}":{"${path[1]}":{"${path[2]}":"${state}"}}}`,
            expect: expect
        };
    }
}

module.exports = RinnaiTouchAccessory;