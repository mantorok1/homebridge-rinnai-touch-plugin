const RinnaiTouchSwitch = require('./RinnaiTouchSwitch');

let Accessory, Service, Characteristic, UUIDGen

class RinnaiTouchZoneSwitch extends RinnaiTouchSwitch {
    constructor(platform) {
        super(platform);
        this.log.debug(this.constructor.name, undefined, 'platform');

        this.name = 'ZoneSwitch';

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    setEventHandlers() {
        this.log.debug(this.constructor.name, 'setEventHandlers');
        super.setEventHandlers();

        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristicValue.bind(this, this.getZoneSwitchOn.bind(this), 'On'))
            .on('set', this.setCharacteristicValue.bind(this, this.setZoneSwitchOn.bind(this), 'On'));
    }

    getZoneSwitchOn() {
        this.log.debug(this.constructor.name, 'getZoneSwitchOn');

        return this.service.getUserEnabled(this.accessory.context.zone);
    }

    async setZoneSwitchOn(value) {
        this.log.debug(this.constructor.name, 'setZoneSwitchOn', value);

        if (this.getZoneSwitchOn() === value) {
            return;
        }

        if (!this.service.getState() && !this.service.getFanState()) {
            setTimeout(this.updateValues.bind(this), 1000);
            return;
        }

        await this.service.setUserEnabled(value, this.accessory.context.zone);
    }

    updateValues() {
        this.log.debug(this.constructor.name, 'updateValues');
        
        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .updateValue(this.getZoneSwitchOn());
    }
}

module.exports = RinnaiTouchZoneSwitch;