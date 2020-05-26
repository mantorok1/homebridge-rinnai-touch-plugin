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

    init(name, status) {
        this.log.debug(this.constructor.name, 'init', name, 'status');
        
        let accessoryName = this.name;
        let uuid = UUIDGen.generate(accessoryName);
        this.accessory = new Accessory(accessoryName, uuid);
        this.accessory.context.type = this.name.toLowerCase();

        this.setAccessoryInformation();

        this.accessory.addService(Service.Valve, name);

        this.setEventHandlers();
        this.updateValues(status);
    }

    setEventHandlers() {
        this.log.debug(this.constructor.name, 'setEventHandlers');

        let service = this.accessory.getService(Service.Valve);
        service
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getCharacteristicValue.bind(this, this.getPumpActive.bind(this)))
            .on('set', this.setCharacteristicValue.bind(this, this.setPumpActive.bind(this)));

        service
            .getCharacteristic(Characteristic.InUse)
            .on('get', this.getCharacteristicValue.bind(this, this.getPumpInUse.bind(this)));
    }

    getPumpActive(status) {
        this.log.debug(this.constructor.name, 'getPumpActive', 'status');

        let path = this.map.getPath('Pump', status.mode);
        let state = status.getState(path);

        if (state === undefined)
            return Characteristic.Active.INACTIVE;

        if (state === 'N')
            return Characteristic.Active.ACTIVE;

        return Characteristic.Active.INACTIVE;
    }

    getPumpInUse(status) {
        this.log.debug(this.constructor.name, 'getPumpInUse', 'status');

        const active = this.getPumpActive(status);

        return active === Characteristic.Active.ACTIVE
            ? Characteristic.InUse.IN_USE
            : Characteristic.InUse.NOT_IN_USE;
    }

    setPumpActive(value, status) {
        this.log.debug(this.constructor.name, 'setPumpActive', value, status);

        let commands = [];

        let currentValue = this.getPumpActive(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('Pump', status.mode);
        let state = value === Characteristic.Active.ACTIVE ? 'N' : 'F';

        commands.push(this.getCommand(path, state));

        return commands;
    }

    updateValues(status) {
        this.log.debug(this.constructor.name, 'updateValues', 'status');
        
        let service = this.accessory.getService(Service.Valve);
        service
            .getCharacteristic(Characteristic.Active)
            .updateValue(this.getPumpActive(status));

        service
            .getCharacteristic(Characteristic.InUse)
            .updateValue(this.getPumpInUse(status));

        service
            .getCharacteristic(Characteristic.ValveType)
            .updateValue(Characteristic.ValveType.GENERIC_VALVE);
    }
}

module.exports = RinnaiTouchPump;