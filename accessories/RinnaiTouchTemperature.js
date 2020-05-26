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

    init(name, status, zone) {
        this.log.debug('RinnaiTouchTemperature', 'init', name, 'status', zone);

        let accessoryName = `${this.name} ${zone}`;
        let uuid = UUIDGen.generate(accessoryName);
        this.accessory = new Accessory(accessoryName, uuid);
        this.accessory.context.type = this.name.toLowerCase();
        this.accessory.context.zone = zone;

        this.setAccessoryInformation();
    }

    setEventHandlers(service) {
        this.log.debug('RinnaiTouchTemperature', 'setEventHandlers', 'service');

        service.getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCharacteristicValue.bind(this, this.getCurrentTemperature.bind(this)));

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getCharacteristicValue.bind(this, this.getTemperatureUnits.bind(this)));
    }

    getCurrentTemperature(status) {
        this.log.debug('RinnaiTouchTemperature', 'getCurrentTemperature', 'status');

        let path = this.map.getPath('CurrentTemp', status.mode, this.accessory.context.zone);
        let state = status.getState(path);

        if (state === undefined || state === '999')
            return null;

        return parseFloat(state) / 10.0;
    }

    getTemperatureUnits(status) {
        this.log.debug('RinnaiTouchTemperature', 'getTemperatureUnits', 'status');

        let path = this.map.getPath('TempUnits');
        let state = status.getState(path);

        return state === 'F'
            ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT
            : Characteristic.TemperatureDisplayUnits.CELSIUS;    
    }

    updateValues(status, service) {
        this.log.debug('RinnaiTouchTemperature', 'updateValues', 'status', 'service');

        service.getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(this.getCurrentTemperature(status));

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .updateValue(this.getTemperatureUnits(status));
    }
}

module.exports = RinnaiTouchTemperature;