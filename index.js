const Settings = require('./util/Settings');
const Logger = require('./util/Logger');
const Mapper = require('./util/Mapper');

const RinnaiTouchServer = require('./server/RinnaiTouchServer');
const RinnaiTouchThermostat = require('./accessories/RinnaiTouchThermostat');
const RinnaiTouchHeaterCooler = require('./accessories/RinnaiTouchHeaterCooler');
const RinnaiTouchZoneSwitch = require('./accessories/RinnaiTouchZoneSwitch');
const RinnaiTouchFan = require('./accessories/RinnaiTouchFan');
const RinnaiTouchPump = require('./accessories/RinnaiTouchPump');
const RinnaiTouchAdvanceSwitch = require('./accessories/RinnaiTouchAdvanceSwitch');
const RinnaiTouchManualSwitch = require('./accessories/RinnaiTouchManualSwitch');

const MqttClient = require('./mqtt/Client');

let Accessory, Service, Characteristic, UUIDGen;

/*  config.json
    {
        "platform": "RinnaiTouchPlatform",
        "name": "Rinnai Touch",
        "serviceType": "thermostat",
        "controllers": 1,
        "showZoneSwitches": true,
        "showFan": true,
        "showAuto": true,
        "showAdvanceSwitches": true,
        "showManualSwitches": true;
        "closeConnectionDelay": 1100,
        "clearCache": false,
        "debug": true,
        "mqtt": {},
        "maps": {}
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
    
            this.map = new Mapper(this.log, this.settings);
            this.server = new RinnaiTouchServer(this.log);
            this.server.queue.drained(this.postProcess.bind(this));
            this.mqttClient = new MqttClient(this);
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
                    this.log.info('Homebridge is shutting down');
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

            let status = await this.server.getStatus();
            this.zones = status.getZones();

            this.settings.setStatusSettings(status);
   
            if (this.settings.hasHeater) this.log.info('Found Heater');
            if (this.settings.hasCooler) this.log.info('Found Cooler');
            if (this.settings.hasEvap) this.log.info('Found Evaporative Cooler');
            this.log.info(`Found Controllers: ${this.settings.controllers}`);
            if (this.settings.controllers === 1) {
                this.log.info(`Found Zone(s): ${this.zones.join()}`);
            }

            this.configureThermostats(status);
            this.configureHeaterCoolers(status);
            this.configureZoneSwitches(status);
            this.configureFan(status);
            this.configurePump(status);
            this.configureAdvanceSwitches(status);
            this.configureManualSwitches(status);
        }
        catch(error) {
            this.log.error(error);
        }
    }

    configureThermostats(status) {
        this.log.debug(this.constructor.name, 'configureThermostats', 'status');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (this.settings.useThermostat && i < this.settings.controllers) {
                let name = (this.settings.controllers > 1) ? this.zones[i] : this.settings.name;
                this.addAccessory(RinnaiTouchThermostat, name, status, zone);
            } else {
                this.removeAccessory(RinnaiTouchThermostat, zone);
            }
        }
    }

    configureHeaterCoolers(status) {
        this.log.debug(this.constructor.name, 'configureHeaterCoolers', 'status');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (!this.settings.useThermostat && i < this.settings.controllers) {
                let name = (this.settings.controllers > 1) ? this.zones[i] : this.settings.name;
                this.addAccessory(RinnaiTouchHeaterCooler, name, status, zone);
            } else {
                this.removeAccessory(RinnaiTouchHeaterCooler, zone);
            }
        }
    }

    configureZoneSwitches(status) {
        this.log.debug(this.constructor.name, 'configureZoneSwitches', 'status');

        let hasZoneSwitches = this.settings.showZoneSwitches && this.settings.controllers === 1 && this.zones.length > 1;
        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (hasZoneSwitches && i < this.zones.length) {
                this.addAccessory(RinnaiTouchZoneSwitch, this.zones[i], status, zone);
            } else {
                this.removeAccessory(RinnaiTouchZoneSwitch, zone);
            }
        }
    }

    configureFan(status) {
        this.log.debug(this.constructor.name, 'configureFan', 'status');

        if (this.settings.showFan) {
            this.addAccessory(RinnaiTouchFan, 'Circulation Fan', status);
        } else {
            this.removeAccessory(RinnaiTouchFan);
        }
    }

    configurePump(status) {
        this.log.debug(this.constructor.name, 'configurePump', 'status');

        if (this.settings.hasEvap) {
            this.addAccessory(RinnaiTouchPump, 'Evaporative Pump', status);
        } else {
            this.removeAccessory(RinnaiTouchPump);
        }
    }

    configureAdvanceSwitches(status) {
        this.log.debug(this.constructor.name, 'configureAdvanceSwitch', 'status');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (this.settings.showAdvanceSwitches && i < this.settings.controllers) {
                let name = (this.settings.controllers > 1) ? `Advance Period ${this.zones[i]}` : 'Advance Period';
                this.addAccessory(RinnaiTouchAdvanceSwitch, name, status, zone);
            } else {
                this.removeAccessory(RinnaiTouchAdvanceSwitch, zone);
            }
        }
    }

    configureManualSwitches(status) {
        this.log.debug(this.constructor.name, 'configureManualSwitch', 'status');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (this.settings.showManualSwitches && i < this.settings.controllers) {
                let name = (this.settings.controllers > 1) ? `Manual ${this.zones[i]}` : 'Manual';
                this.addAccessory(RinnaiTouchManualSwitch, name, status, zone);
            } else {
                this.removeAccessory(RinnaiTouchManualSwitch, zone);
            }
        }
    }

    addAccessory(RinnaiTouchAccessory, name, status, zone) {
        this.log.debug(this.constructor.name, 'addAccessory', RinnaiTouchAccessory.name, name, 'status', zone);
      
        let rtAccessory = new RinnaiTouchAccessory(this);
        let key = rtAccessory.getKey(zone);
        if (key in this.accessories) {
            return;
        }

        rtAccessory.init(name, status, zone);

        this.accessories[key] = rtAccessory;
        this.api.registerPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [rtAccessory.accessory]);
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
    }

    async postProcess() {
        try {
            this.log.debug(this.constructor.name, 'postProcess');

            let status = this.server.status;
            setTimeout(() => {
                this.updateAll(status);
            }, 500);

            // Clear the cached status
            this.server.status = undefined;

            // Close TCP connection
            await this.server.destroy(this.settings.closeConnectionDelay);
        }
        catch(error) {
            this.log.error(error);
        }
    }

    updateAll(status) {
        try {
            this.log.debug(this.constructor.name, 'updateAll', 'status');

            // Check if zones have changed
            if (this.settings.controllers === 1) {
                if (this.zones.length !== status.getZones().length) {
                    this.zones = status.getZones();
                    this.configureZoneSwitches(status);
                }
            }
    
            // Update values for all accessories
            for(let key in this.accessories) {
                this.accessories[key].updateValues(status);
            }
        }
        catch(error) {
            this.log.error(error);
        }
    }
}