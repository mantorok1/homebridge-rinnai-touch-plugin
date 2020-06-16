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
        this.service = platform.service;
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

    setEventHandlers() {
        this.log.debug('RinnaiTouchAccessory', 'setEventHandlers');

        this.service.on('updated', () => {
            this.updateValues();
        });
    }

    async getCharacteristicValue(getValue, callback) {
        this.log.debug('RinnaiTouchAccessory', 'getCharacteristicValue', 'getValue', 'callback');
        try {
            await this.service.updateStates();
            let value = getValue();

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
            await setValue(value);
 
            callback(null);

            await this.service.updateStates();
        }
        catch(error) {
            this.log.error(error);
            callback(error);
        }
    }    
}

module.exports = RinnaiTouchAccessory;