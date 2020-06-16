const RinnaiTouchSwitch = require('./RinnaiTouchSwitch');

let Accessory, Service, Characteristic, UUIDGen

class RinnaiTouchAdvanceSwitch extends RinnaiTouchSwitch {
    constructor(platform) {
        super(platform);
        this.log.debug(this.constructor.name, undefined, 'platform');

        this.name = 'AdvanceSwitch';

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
            .on('get', this.getCharacteristicValue.bind(this, this.getAdvanceSwitchOn.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setAdvanceSwitchOn.bind(this)));
    }

    getAdvanceSwitchOn() {
        this.log.debug(this.constructor.name, 'getAdvanceSwitchOn');

        let state = this.service.getScheduleOverride(this.accessory.context.zone);

        return state === this.service.ScheduleOverrideModes.ADVANCE;
    }

    async setAdvanceSwitchOn(value) {
        this.log.debug(this.constructor.name, 'setAdvanceSwitchOn', value);

        if (this.getAdvanceSwitchOn() === value) {
            return;
        }

        let state = value
            ? this.service.ScheduleOverrideModes.ADVANCE
            : this.service.ScheduleOverrideModes.NONE;

        await this.service.setControlMode(this.service.ControlModes.SCHEDULE, this.accessory.context.zone);
        await this.service.setScheduleOverride(state, this.accessory.context.zone);
    }

    updateValues() {
        this.log.debug(this.constructor.name, 'updateValues');
        
        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .updateValue(this.getAdvanceSwitchOn());
    }
}

module.exports = RinnaiTouchAdvanceSwitch;