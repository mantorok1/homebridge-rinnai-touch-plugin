const RinnaiTouchSwitch = require('./RinnaiTouchSwitch');

let Accessory, Service, Characteristic, UUIDGen

class RinnaiTouchManualSwitch extends RinnaiTouchSwitch {
    constructor(platform) {
        super(platform);
        this.log.debug(this.constructor.name, undefined, 'platform');

        this.name = 'ManualSwitch';

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
            .on('get', this.getCharacteristicValue.bind(this, this.getManualSwitchOn.bind(this), 'On'))
            .on('set', this.setCharacteristicValue.bind(this, this.setManualSwitchOn.bind(this), 'On'));
    }

    getManualSwitchOn() {
        this.log.debug(this.constructor.name, 'getManualSwitchOn');

        let state = this.service.getControlMode(this.accessory.context.zone);

        return state === this.service.ControlModes.MANUAL;
    }

    async setManualSwitchOn(value) {
        this.log.debug(this.constructor.name, 'setManualSwitchOn', value);

        if (this.getManualSwitchOn() === value) {
            return;
        }

        let state = value
            ? this.service.ControlModes.MANUAL
            : this.service.ControlModes.SCHEDULE;

        await this.service.setControlMode(state, this.accessory.context.zone);
    }

    updateValues() {
        this.log.debug(this.constructor.name, 'updateValues');
        
        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .updateValue(this.getManualSwitchOn());
    }
}

module.exports = RinnaiTouchManualSwitch;