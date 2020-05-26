const RinnaiTouchAccessory = require('./RinnaiTouchAccessory');

let Accessory, Service, Characteristic, UUIDGen

class RinnaiTouchFan extends RinnaiTouchAccessory {
    constructor(platform) {
        super(platform);
        this.log.debug(this.constructor.name, undefined, 'platform');

        this.name = 'Fan';

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    init(name, status) {
        this.log.debug(this.constructor.name, 'init', name, 'status');
        
        let accessoryName = this.name;
        let uuid = UUIDGen.generate(accessoryName);
        this.accessory = new Accessory(accessoryName, uuid);
        this.accessory.context.type = this.name.toLowerCase();

        this.setAccessoryInformation();

        this.accessory.addService(Service.Fan, name);

        this.setEventHandlers();
        this.updateValues(status);
    }

    setEventHandlers() {
        this.log.debug(this.constructor.name, 'setEventHandlers');

        let service = this.accessory.getService(Service.Fan);
        service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristicValue.bind(this, this.getFanOn.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setFanOn.bind(this)));

        service
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', this.getCharacteristicValue.bind(this, this.getFanRotationSpeed.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setFanRotationSpeed.bind(this)));
    }

    getFanOn(status) {
        this.log.debug(this.constructor.name, 'getFanOn', 'status');

        let path = this.map.getPath('State', status.mode);
        let state = status.getState(path);

        if (state === undefined)
            return false;

        if ((status.mode !== 'ECOM' && state === 'Z') || (status.mode === 'ECOM' && state !== 'F'))
            return true;

        return false;
    }

    getFanRotationSpeed(status) {
        this.log.debug(this.constructor.name, 'getFanRotationSpeed', 'status');

        let path = this.map.getPath('FanSpeed', status.mode);
        let state = status.getState(path);

        if (state === undefined)
            return 0;

        return parseFloat(state) / 16.0 * 100.0;
    }

    setFanOn(value, status) {
        this.log.debug(this.constructor.name, 'setFanOn', value, 'status');

        let commands = [];

        let currentValue = this.getFanOn(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('State', status.mode);

        // If turning on fan and heater/cooling currently on then turn off first
        if (value) {
            if (status.getState(path) === 'N' && status.mode !== 'ECOM') {
                commands.push(this.getCommand(path, 'F'));
            }
        }

        let state = 'F';
        if (value) {
            state = status.mode === 'ECOM' ? 'N' : 'Z';
        }
        commands.push(this.getCommand(path, state));

        return commands;
    }

    setFanRotationSpeed(value, status) {
        this.log.debug(this.constructor.name, 'setFanRotationSpeed', value, 'status');

        let commands = [];

        let currentValue = this.getFanRotationSpeed(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('FanSpeed', status.mode);
        let state = ('0' + Math.round(value / 100.0 * 16.0)).slice(-2)
        
        commands.push(this.getCommand(path, state));

        return commands;    
    }

    updateValues(status) {
        this.log.debug(this.constructor.name, 'updateValues', 'status');
        
        let service = this.accessory.getService(Service.Fan);
        service
            .getCharacteristic(Characteristic.On)
            .updateValue(this.getFanOn(status));

        service
            .getCharacteristic(Characteristic.RotationSpeed)
            .updateValue(this.getFanRotationSpeed(status));

        service
            .getCharacteristic(Characteristic.RotationDirection)
            .updateValue(Characteristic.RotationDirection.CLOCKWISE);
    }
}

module.exports = RinnaiTouchFan;