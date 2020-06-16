const RinnaiTouchAccessory = require('./RinnaiTouchAccessory');

let Accessory, Service, Characteristic, UUIDGen;

class RinnaiTouchPump extends RinnaiTouchAccessory {
    constructor(platform) {
        super(platform);
        this.log.debug(this.constructor.name, undefined, 'platform');

        this.name = 'Pump';

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

        this.accessory.addService(Service.Valve, name);

        this.setEventHandlers();
        this.updateValues();
    }

    setEventHandlers() {
        this.log.debug(this.constructor.name, 'setEventHandlers');
        super.setEventHandlers();

        let service = this.accessory.getService(Service.Valve);
        service
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getCharacteristicValue.bind(this, this.getPumpActive.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setPumpActive.bind(this)));

        service
            .getCharacteristic(Characteristic.InUse)
            .on('get', this.getCharacteristicValue.bind(this, this.getPumpInUse.bind(this)));
    }

    getPumpActive() {
        this.log.debug(this.constructor.name, 'getPumpActive');

        let state = this.service.getPumpState();

        return state
            ? Characteristic.Active.ACTIVE
            : Characteristic.Active.INACTIVE;
    }

    getPumpInUse() {
        this.log.debug(this.constructor.name, 'getPumpInUse');

        let state = this.service.getPumpState();

        return state
            ? Characteristic.InUse.IN_USE
            : Characteristic.InUse.NOT_IN_USE;
    }

    async setPumpActive(value) {
        this.log.debug(this.constructor.name, 'setPumpActive', value);

        if (this.getPumpActive() === value) {
            return;
        }

        let state = value === Characteristic.Active.ACTIVE;

        await this.service.setPumpState(state);
    }

    updateValues() {
        this.log.debug(this.constructor.name, 'updateValues');
        
        let service = this.accessory.getService(Service.Valve);
        service
            .getCharacteristic(Characteristic.Active)
            .updateValue(this.getPumpActive());

        service
            .getCharacteristic(Characteristic.InUse)
            .updateValue(this.getPumpInUse());

        service
            .getCharacteristic(Characteristic.ValveType)
            .updateValue(Characteristic.ValveType.GENERIC_VALVE);
    }
}

module.exports = RinnaiTouchPump;