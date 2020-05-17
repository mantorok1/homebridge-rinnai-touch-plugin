const RinnaiTouchAccessory = require('./RinnaiTouchAccessory');

let Accessory, Service, Characteristic, UUIDGen

class RinnaiTouchSwitch extends RinnaiTouchAccessory {
    constructor(platform) {
        super(platform);
        this.debug('RinnaiTouchSwitch', undefined, 'platform');

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    init(name, status, zone) {
        this.debug('RinnaiTouchSwitch', 'init', name, 'status', zone);
        
        let accessoryName = zone ? `${this.name} ${zone}` : this.name;
        let uuid = UUIDGen.generate(accessoryName);
        this.accessory = new Accessory(accessoryName, uuid);
        this.accessory.context.type = this.name.toLowerCase();
        this.accessory.context.zone = zone;

        this.setAccessoryInformation();

        this.accessory.addService(Service.Switch, name);

        this.setEventHandlers();
        this.updateValues(status);
    }
}

module.exports = RinnaiTouchSwitch;