const crypto = require('crypto');
const PluginVersion = require('../package.json').version;

let Accessory, Service, Characteristic, UUIDGen;

class RinnaiTouchAccessory {
    constructor(platform) {
        this.log = platform.log;
        this.log.debug('RinnaiTouchAccessory', undefined, 'platform');

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;

        this.settings = platform.settings;
        this.map = platform.map;
        this.server = platform.server;
        this.accessory = null;
    }

    getKey(zone) {
        this.log.debug('RinnaiTouchAccessory', 'getKey', zone);

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
        this.log.debug('RinnaiTouchAccessory', 'configure', 'accessory');

        this.accessory = accessory;
        this.setAccessoryInformation();
        this.setEventHandlers();
    }

    setAccessoryInformation() {
        this.log.debug('RinnaiTouchAccessory', 'setAccessoryInformation');

        this.accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, 'Rinnai')
            .setCharacteristic(Characteristic.Model, 'N-BW2')
            .setCharacteristic(Characteristic.SerialNumber, 
                crypto.createHash('sha1').update(this.accessory.UUID).digest('hex'))
            .setCharacteristic(Characteristic.FirmwareRevision, PluginVersion);
    }

    async getCharacteristicValue(getValue, callback) {
        this.log.debug('RinnaiTouchAccessory', 'getCharacteristicValue', 'getValue', 'callback');
        try {
            let status = await this.server.getStatus();
            let value = getValue(status);

            callback(null, value);
        }
        catch(error) {
            this.log.error(error);
            callback(error);
        }
    }

    async setCharacteristicValue(setValue, value, callback) {
        this.log.debug('RinnaiTouchAccessory', 'setCharacteristic', 'setValue', value, 'callback');
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
            this.log.error(error);
            callback(error);
        }
    }

    getCommand(path, state, expect) {
        this.log.debug('RinnaiTouchAccessory', 'getCommand', path, state, JSON.stringify(expect));

        if (path === undefined) {
            this.log.warn('Cannot determine path for command');
            return undefined;
        }

        if (state === undefined) {
            this.log.warn('Unable to determine state for command');
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