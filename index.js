const Settings = require('./util/Settings');
const Logger = require('./util/Logger');

const RinnaiTouchRepository = require('./repositories/RinnaiTouchRepository');
const RinnaiTouchService = require('./services/RinnaiTouchService');
const RinnaiTouchThermostat = require('./accessories/RinnaiTouchThermostat');
const RinnaiTouchHeaterCooler = require('./accessories/RinnaiTouchHeaterCooler');
const RinnaiTouchZoneSwitch = require('./accessories/RinnaiTouchZoneSwitch');
const RinnaiTouchFan = require('./accessories/RinnaiTouchFan');
const RinnaiTouchPump = require('./accessories/RinnaiTouchPump');
const RinnaiTouchAdvanceSwitch = require('./accessories/RinnaiTouchAdvanceSwitch');
const RinnaiTouchManualSwitch = require('./accessories/RinnaiTouchManualSwitch');

const NativeClient = require('./mqtt/NativeClient');
const HomeAssistantClient = require('./mqtt/HomeAssistantClient');
const TemperatureClient = require('./mqtt/TemperatureClient');

let Accessory, Service, Characteristic, UUIDGen;

/*  config.json
    {
        "platform": "RinnaiTouchPlatform",
        "name": "Rinnai Touch",
        "address": "192.168.1.3",
        "port": 27847,
        "controllerType": "T",
        "zoneType": "S",
        "showFan": true,
        "showAuto": true,
        "showAdvanceSwitches": true,
        "showManualSwitches": true;
        "closeConnectionDelay": 1100,
        "connectionTimeout": 5000,
        "clearCache": false,
        "debug": true,
        "mqtt": {}
    }
*/

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", RinnaiTouchPlatform, true);
}

class RinnaiTouchPlatform {
    #started = false;
    #repository;
    service;

    constructor(log, config, api) {
        try {
            this.settings = new Settings(config);
            this.log = new Logger(log, this.settings.debug);
    
            this.log.debug(this.constructor.name, undefined, 'log', JSON.stringify(config), 'api')
    
            this.Accessory = Accessory;
            this.Service = Service; 
            this.Characteristic = Characteristic;
            this.UUIDGen = UUIDGen;
    
            this.accessories = {};

            this.#repository = new RinnaiTouchRepository(this.log, this.settings);
            this.service = new RinnaiTouchService(this.log, this.#repository);

            this.#started = true;
    
            if (api) {
                this.api = api;
                this.api.on('didFinishLaunching', () => {
                    try {
                        this.discover();
                    }
                    catch(error) {
                        this.log.error(error);
                    }
                });

                this.api.on('shutdown', () => {
                    this.log.info('Shutting down plugin');
                    this.#repository.closeConnection();
                });
            }
        }
        catch(error) {
            log(`[ERROR] ${error.message}`);
        }
    }

    configureAccessory(accessory) {
        try {
            if (!this.#started)
                return;

            this.log.debug(this.constructor.name, 'configureAccessory', 'accessory');
            this.log.info(`Configure ${accessory.displayName}`);
    
            accessory.reachable = true;
    
            let rtAccessory;
    
            switch(accessory.context.type) {
                case 'thermostat':
                    rtAccessory = new RinnaiTouchThermostat(this);
                    break;
                case 'heatercooler':
                    rtAccessory = new RinnaiTouchHeaterCooler(this);
                    break;
                case 'zoneswitch':
                    rtAccessory = new RinnaiTouchZoneSwitch(this);
                    break;
                case 'fan':
                    rtAccessory = new RinnaiTouchFan(this);
                    break;
                case 'pump':
                    rtAccessory = new RinnaiTouchPump(this);
                    break;
                case 'advanceswitch':
                    rtAccessory = new RinnaiTouchAdvanceSwitch(this);
                    break;
                case 'manualswitch':
                    rtAccessory = new RinnaiTouchManualSwitch(this);
                    break;
            }
    
            rtAccessory.configure(accessory);
            this.accessories[rtAccessory.getKey()] = rtAccessory;    
        }
        catch(error) {
            this.log.error(error);
        }
    }

    async discover() {
        try {
            this.log.debug(this.constructor.name, 'discover');

            // Clear Cached accessories if required
            if (this.settings.clearCache) {
                let accessories = Object.values(this.accessories).map((acc) => acc.accessory);
                this.api.unregisterPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", Object.values(accessories));
                this.accessories = {};
            }

            await this.service.init();
   
            if (this.service.hasHeater) this.log.info('Found Heater');
            if (this.service.hasCooler) this.log.info('Found Cooler');
            if (this.service.hasEvaporative) this.log.info('Found Evaporative Cooler');
            
            let zones = this.service.zones.map(z => this.service.getZoneName(z));
            this.log.info(`Found Zone(s): ${zones.join()}`);

            let operation = this.service.hasMultiSetPoint ? 'Multi' : 'Single';
            this.log.info(`Operation Mode: ${operation} Temperature Set Point`);

            this.configureThermostats();
            this.configureHeaterCoolers();
            this.configureZoneSwitches();
            this.configureFan();
            this.configureAdvanceSwitches();
            this.configureManualSwitches();
            this.configurePump();

            this.service.on('mode', (mode) => {
                if (!this.service.hasMultiSetPoint) {
                    this.configureZoneSwitches();
                    this.configureHeaterCoolers();
                }
                if (this.service.hasEvaporative) {
                    this.configurePump();
                }
            });

            if (this.settings.mqtt.formatNative) {
                this.nativeClient = new NativeClient(this.log, this.settings.mqtt, this.#repository);
            }
            if (this.settings.mqtt.formatHomeAssistant) {
                this.homeAssistantClient = new HomeAssistantClient(this.log, this.settings.mqtt, this.service);
            }
            if (this.settings.mqtt.subscribeTemperature) {
                this.temperatureClient = new TemperatureClient(this.log, this.settings.mqtt, this.service);
            }
        }
        catch(error) {
            this.log.error(error);
        }
    }

    configureThermostats() {
        this.log.debug(this.constructor.name, 'configureThermostats');

        for(let zone of this.service.AllZones) {
            if (this.settings.controllerType === 'T' && this.service.controllers.includes(zone)) {
                let name = this.service.hasMultiSetPoint
                    ? this.service.getZoneName(zone)
                    : this.settings.name;
                this.addAccessory(RinnaiTouchThermostat, name, zone);
            } else {
                this.removeAccessory(RinnaiTouchThermostat, zone);
            }
        }
    }

    configureHeaterCoolers() {
        this.log.debug(this.constructor.name, 'configureHeaterCoolers');

        for(let zone of this.service.AllZones) {
            let addHeaterCooler =
                (this.settings.controllerType === 'H' && this.service.controllers.includes(zone)) ||
                (!this.service.hasMultiSetPoint && zone !== 'U' && this.settings.zoneType === 'H' && this.service.zones.includes(zone));

            if (addHeaterCooler) {
                let name = zone !== 'U'
                    ? this.service.getZoneName(zone)
                    : this.settings.name;
                this.addAccessory(RinnaiTouchHeaterCooler, name, zone);
            } else {
                this.removeAccessory(RinnaiTouchHeaterCooler, zone);
            }
        }
    }

    configureZoneSwitches() {
        this.log.debug(this.constructor.name, 'configureZoneSwitches');

        for(let zone of ['A','B','C','D']) {
            if (!this.service.hasMultiSetPoint && this.settings.zoneType === 'S' && this.service.zones.includes(zone)) {
                this.addAccessory(RinnaiTouchZoneSwitch, this.service.getZoneName(zone), zone);
            } else {
                this.removeAccessory(RinnaiTouchZoneSwitch, zone);
            }
        }
    }

    configureFan() {
        this.log.debug(this.constructor.name, 'configureFan');

        if (this.settings.showFan) {
            this.addAccessory(RinnaiTouchFan, 'Circulation Fan');
        } else {
            this.removeAccessory(RinnaiTouchFan);
        }
    }

    configureAdvanceSwitches() {
        this.log.debug(this.constructor.name, 'configureAdvanceSwitch');

        for(let zone of this.service.AllZones) {
            if (this.settings.showAdvanceSwitches && this.service.controllers.includes(zone)) {
                let name = this.service.hasMultiSetPoint ? `Advance Period ${zone}` : 'Advance Period';
                this.addAccessory(RinnaiTouchAdvanceSwitch, name, zone);
            } else {
                this.removeAccessory(RinnaiTouchAdvanceSwitch, zone);
            }
        }
    }

    configureManualSwitches() {
        this.log.debug(this.constructor.name, 'configureManualSwitch');

        for(let zone of this.service.AllZones) {
            if (this.settings.showManualSwitches && this.service.controllers.includes(zone)) {
                let name = this.service.hasMultiSetPoint ? `Manual ${zone}` : 'Manual';
                this.addAccessory(RinnaiTouchManualSwitch, name, zone);
            } else {
                this.removeAccessory(RinnaiTouchManualSwitch, zone);
            }
        }
    }

    configurePump() {
        this.log.debug(this.constructor.name, 'configurePump');

        if (this.service.hasEvaporative) {
            this.addAccessory(RinnaiTouchPump, 'Evaporative Pump');
        } else {
            this.removeAccessory(RinnaiTouchPump);
        }
    }

    addAccessory(RinnaiTouchAccessory, name, zone) {
        this.log.debug(this.constructor.name, 'addAccessory', RinnaiTouchAccessory.name, name, zone);
      
        let rtAccessory = new RinnaiTouchAccessory(this);
        let key = rtAccessory.getKey(zone);
        if (key in this.accessories) {
            return;
        }

        rtAccessory.init(name, zone);

        this.accessories[key] = rtAccessory;
        this.api.registerPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [rtAccessory.accessory]);
        this.log.info(`Add ${rtAccessory.accessory.displayName}`);
    }

    removeAccessory(RinnaiTouchAccessory, zone) {
        this.log.debug(this.constructor.name, 'removeAccessory', RinnaiTouchAccessory.name, zone);

        let rtAccessory = new RinnaiTouchAccessory(this);
        let key = rtAccessory.getKey(zone);
        if (!(key in this.accessories))
            return;
    
        let accessory = this.accessories[key].accessory;
        this.api.unregisterPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [accessory]);
        delete this.accessories[key];
        this.log.info(`Remove ${accessory.displayName}`);
    }
}