const RinnaiTouchAccessory = require('./RinnaiTouchAccessory');

let Accessory, Service, Characteristic, UUIDGen;

class RinnaiTouchTemperature extends RinnaiTouchAccessory {
    constructor(platform) {
        super(platform);
        this.log.debug('RinnaiTouchTemperature', undefined, 'platform');

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    init(name, zone) {
        this.log.debug('RinnaiTouchTemperature', 'init', name, zone);

        let accessoryName = `${this.name} ${zone}`;
        let uuid = UUIDGen.generate(accessoryName);
        this.accessory = new Accessory(accessoryName, uuid);
        this.accessory.context.type = this.name.toLowerCase();
        this.accessory.context.zone = zone;

        this.setAccessoryInformation();
    }

    setEventHandlers(service) {
        this.log.debug('RinnaiTouchTemperature', 'setEventHandlers', 'service');
        super.setEventHandlers();

        service.getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCharacteristicValue.bind(this, this.getCurrentTemperature.bind(this), 'CurrentTemperature'));

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getCharacteristicValue.bind(this, this.getTemperatureUnits.bind(this), 'TemperatureDisplayUnits'));
    }

    getCurrentTemperature() {
        this.log.debug('RinnaiTouchTemperature', 'getCurrentTemperature');

        return this.service.getCurrentTemperature(this.accessory.context.zone);
    }

    getTemperatureUnits() {
        this.log.debug('RinnaiTouchTemperature', 'getTemperatureUnits');

        let state = this.service.getTemperatureUnits();
        return state === 'F'
            ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT
            : Characteristic.TemperatureDisplayUnits.CELSIUS;    
    }

    updateValues(service) {
        this.log.debug('RinnaiTouchTemperature', 'updateValues', 'service');

        service.getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(this.getCurrentTemperature());

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .updateValue(this.getTemperatureUnits());
    }
}

module.exports = RinnaiTouchTemperature;