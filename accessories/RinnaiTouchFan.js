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

    init(name) {
        this.log.debug(this.constructor.name, 'init', name);
        
        let accessoryName = this.name;
        let uuid = UUIDGen.generate(accessoryName);
        this.accessory = new Accessory(accessoryName, uuid);
        this.accessory.context.type = this.name.toLowerCase();

        this.setAccessoryInformation();

        this.accessory.addService(Service.Fan, name);

        this.setEventHandlers();
        this.updateValues();
    }

    setEventHandlers() {
        this.log.debug(this.constructor.name, 'setEventHandlers');
        super.setEventHandlers();

        let service = this.accessory.getService(Service.Fan);
        service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristicValue.bind(this, this.getFanOn.bind(this), 'On'))
            .on('set', this.setCharacteristicValue.bind(this, this.setFanOn.bind(this), 'On'));

        service
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', this.getCharacteristicValue.bind(this, this.getFanRotationSpeed.bind(this), 'RotationSpeed'))
            .on('set', this.setCharacteristicValue.bind(this, this.setFanRotationSpeed.bind(this), 'RotationSpeed'));
    }

    getFanOn() {
        this.log.debug(this.constructor.name, 'getFanOn');

        return this.service.getFanState();
    }

    getFanRotationSpeed() {
        this.log.debug(this.constructor.name, 'getFanRotationSpeed');

        return this.service.getFanSpeed() / 16.0 * 100.0
    }

    async setFanOn(value) {
        this.log.debug(this.constructor.name, 'setFanOn', value);

        if (this.getFanOn() === value) {
            return;
        }

        // If turning fan on then ensure HVAC is off first
        if (value) {
            await this.service.setState(false);
        }
        
        await this.service.setFanState(value);
    }

    async setFanRotationSpeed(value) {
        this.log.debug(this.constructor.name, 'setFanRotationSpeed', value);

        if (this.getFanRotationSpeed() === value) {
            return;
        }

        let speed = parseInt(Math.round(value / 100.0 * 16.0));

        await this.service.setFanSpeed(speed);  
    }
    
    updateValues() {
        this.log.debug(this.constructor.name, 'updateValues');
        
        let service = this.accessory.getService(Service.Fan);
        service
            .getCharacteristic(Characteristic.On)
            .updateValue(this.getFanOn());

        service
            .getCharacteristic(Characteristic.RotationSpeed)
            .updateValue(this.getFanRotationSpeed());

        service
            .getCharacteristic(Characteristic.RotationDirection)
            .updateValue(Characteristic.RotationDirection.CLOCKWISE);
    }
}

module.exports = RinnaiTouchFan;