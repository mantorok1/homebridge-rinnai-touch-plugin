const RinnaiTouchSwitch = require('./RinnaiTouchSwitch');

let Accessory, Service, Characteristic, UUIDGen

class RinnaiTouchZoneSwitch extends RinnaiTouchSwitch {
    constructor(platform) {
        super(platform);
        this.debug(this.constructor.name, undefined, 'platform');

        this.name = 'ZoneSwitch';

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    setEventHandlers() {
        this.debug(this.constructor.name, 'setEventHandlers');

        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristicValue.bind(this, this.getZoneSwitchOn.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setZoneSwitchOn.bind(this)));
    }

    getZoneSwitchOn(status) {
        this.debug(this.constructor.name, 'getZoneSwitchOn', 'status');

        let path = this.map.getPath('ZoneSwitch', status.mode, this.accessory.context.zone);
        let state = status.getState(path);

        if (state === undefined)
            return false;

        return state === 'Y';
    }

    setZoneSwitchOn(value, status) {
        this.debug(this.constructor.name, 'setZoneSwitchOn', value, 'status');

        let commands = [];

        let currentValue = this.getZoneSwitchOn(status, this.accessory.context.zone);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('ZoneSwitch', status.mode, this.accessory.context.zone);
        let state = value ? 'Y' : 'N';
        commands.push(this.getCommand(path, state));

        return commands;
    }

    updateValues(status) {
        this.debug(this.constructor.name, 'updateValues', 'status');
        
        this.accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .updateValue(this.getZoneSwitchOn(status));
    }
}

module.exports = RinnaiTouchZoneSwitch;