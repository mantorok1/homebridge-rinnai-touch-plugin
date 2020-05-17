const RinnaiTouchSwitch = require('./RinnaiTouchSwitch');

let Accessory, Service, Characteristic, UUIDGen

class RinnaiTouchAdvanceSwitch extends RinnaiTouchSwitch {
    constructor(platform) {
        super(platform);
        this.debug(this.constructor.name, undefined, 'platform');

        this.name = 'AdvanceSwitch';

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    setEventHandlers() {
        this.debug(this.constructor.name, 'setEventHandlers');

        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristicValue.bind(this, this.getAdvanceSwitchOn.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setAdvanceSwitchOn.bind(this)));
    }

    getAdvanceSwitchOn(status) {
        this.debug(this.constructor.name, 'getAdvanceSwitchOn', 'status');

        let path = this.map.getPath('ScheduleState', status.mode, this.accessory.context.zone);
        let state = status.getState(path);

        if (state === undefined)
            return false;

        return state === 'A';
    }

    setAdvanceSwitchOn(value, status) {
        this.debug(this.constructor.name, 'setAdvanceSwitchOn', value, 'status');

        let commands = [];

        let currentValue = this.getAdvanceSwitchOn(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('Operation', status.mode, this.accessory.context.zone);
        let state = status.getState(path);
        if (state !== 'A')
            commands.push(this.getCommand(path, 'A'));

        path = this.map.getPath('ScheduleState', status.mode, this.accessory.context.zone);
        state = value ? 'A' : 'N';
        commands.push(this.getCommand(path, state));

        return commands;
    }

    updateValues(status) {
        this.debug(this.constructor.name, 'updateValues', 'status');
        
        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .updateValue(this.getAdvanceSwitchOn(status));
    }
}

module.exports = RinnaiTouchAdvanceSwitch;