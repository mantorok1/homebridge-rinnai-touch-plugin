const RinnaiTouchAccessory = require('./RinnaiTouchAccessory');

let Accessory, Service, Characteristic, UUIDGen

class RinnaiTouchSwitch extends RinnaiTouchAccessory {
    constructor(platform) {
        super(platform);
        this.log.debug('RinnaiTouchSwitch', undefined, 'platform');

        Accessory = platform.Accessory;
        Service = platform.Service; 
        Characteristic = platform.Characteristic;
        UUIDGen = platform.UUIDGen;
    }

    init(name, zone) {
        this.log.debug('RinnaiTouchSwitch', 'init', name, zone);
        
        let accessoryName = zone ? `${this.name} ${zone}` : this.name;
        let uuid = UUIDGen.generate(accessoryName);
        this.accessory = new Accessory(accessoryName, uuid);
        this.accessory.context.type = this.name.toLowerCase();
        this.accessory.context.zone = zone;

        this.setAccessoryInformation();

        this.accessory.addService(Service.Switch, name);

        this.setEventHandlers();
        this.updateValues();
    }
}

module.exports = RinnaiTouchSwitch;