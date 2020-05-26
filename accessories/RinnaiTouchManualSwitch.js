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

        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristicValue.bind(this, this.getManualSwitchOn.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setManualSwitchOn.bind(this)));
    }

    getManualSwitchOn(status) {
        this.log.debug(this.constructor.name, 'getManualSwitchOn', 'status');

        let path = this.map.getPath('Operation', status.mode, this.accessory.context.zone);
        let state = status.getState(path);

        if (state === undefined)
            return false;

        return state === 'M';
    }

    setManualSwitchOn(value, status) {
        this.log.debug(this.constructor.name, 'setManualSwitchOn', value, 'status');

        let commands = [];

        let currentValue = this.getManualSwitchOn(status, this.accessory.context.zone);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('Operation', status.mode, this.accessory.context.zone);
        let state = value ? 'M' : 'A';
        commands.push(this.getCommand(path, state));

        return commands;
    }

    updateValues(status) {
        this.log.debug(this.constructor.name, 'updateValues', 'status');
        
        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .updateValue(this.getManualSwitchOn(status));
    }
}

module.exports = RinnaiTouchManualSwitch;