const RinnaiTouchServer = require('./server/RinnaiTouchServer');
const Mapper = require('./accessories/Mapper');
const RinnaiTouchThermostat = require('./accessories/RinnaiTouchThermostat');
const RinnaiTouchHeaterCooler = require('./accessories/RinnaiTouchHeaterCooler');
const RinnaiTouchZoneSwitch = require('./accessories/RinnaiTouchZoneSwitch');
const RinnaiTouchFan = require('./accessories/RinnaiTouchFan');
const RinnaiTouchPump = require('./accessories/RinnaiTouchPump');
const RinnaiTouchAdvanceSwitch = require('./accessories/RinnaiTouchAdvanceSwitch');
const RinnaiTouchManualSwitch = require('./accessories/RinnaiTouchManualSwitch');

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
    constructor(log, config, api) {
        this.log = log;

        config = config ? config : {};

        this.debug = () => {};
        if (config.debug) {
            this.debug = (className, methodName, ...args) => {
                let message = className;
                if (methodName) {
                    message += `.${methodName}`;
                }
                message += `(${args.join(',')})`;
        
                this.log(message);
            }
        }

        this.debug(this.constructor.name, undefined, 'log', JSON.stringify(config), 'api')

        this.name = config.name || 'Rinnai Touch';
        this.useThermostat = (config.serviceType || "thermostat") === "thermostat";
        this.controllers = config.controllers || 1;

        this.showZoneSwitches = config.showZoneSwitches === undefined
            ? this.controllers === 1
            : config.showZoneSwitches;
        this.showFan = config.showFan === undefined
            ? true
            : config.showFan;
        this.showAuto = config.showAuto === undefined
            ? this.controllers === 1 
            : config.showAuto;
        this.showAdvanceSwitches = config.showAdvanceSwitches === undefined
            ? this.controllers === 1
            : config.showAdvanceSwitches;
        this.showManualSwitches = config.showManualSwitches === undefined
            ? this.controllers === 1 
            : config.showManualSwitches;
        this.closeConnectionDelay = config.closeConnectionDelay || 1100;
        this.clearCache = config.clearCache === undefined ? false : config.clearCache;
        this.maps = config.maps;

        this.Accessory = Accessory;
        this.Service = Service; 
        this.Characteristic = Characteristic;
        this.UUIDGen = UUIDGen;

        this.accessories = {};
        this.config = {};

        this.map = new Mapper(this.debug);
        this.server = new RinnaiTouchServer(this.debug, this.log);
        this.server.queue.drained(this.postProcess.bind(this));

        if (api) {
            this.api = api;
            this.api.on('didFinishLaunching', () => {
                this.discover();
            });
        }
    }

    configureAccessory(accessory) {
        this.debug(this.constructor.name, 'configureAccessory', 'accessory');
        this.log(`Configure ${accessory.displayName}`);

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

    async discover() {
        this.debug(this.constructor.name, 'discover');
        try {
            // Clear Cached accessories if required
            if (this.clearCache) {
                let accessories = Object.values(this.accessories).map((acc) => acc.accessory);
                this.api.unregisterPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", Object.values(accessories));
                this.accessories = {};
            }

            let status = await this.server.getStatus();

            const path = {
                HasHeater: 'SYST.AVM.HG',
                HasCooler: 'SYST.AVM.CG',
                HasEvap: 'SYST.AVM.EC',
                HasMultipleControllers: 'SYST.CFG.MTSP'
            };

            this.config['hasHeater'] = status.getState(path.HasHeater) === 'Y';
            this.config['hasCooler'] = status.getState(path.HasCooler) === 'Y';
            this.config['hasEvap'] = status.getState(path.HasEvap) === 'Y';
            this.hasMultipleControllers = status.getState(path.HasMultipleControllers) === 'Y';
            
            this.zones = status.getZones();
            if (this.controllers === undefined) {
                this.controllers = this.hasMultipleControllers ? this.zones.length : 1;
            } else {
                if (this.controllers > 1 && this.controllers !== this.zones.length) {
                    this.log(`WARNING: Cannot have more controllers than there are zones. Setting controllers to ${this.zones.length}`);
                    this.controllers = this.zones.length;
                }
            }
            this.hasMultipleControllers = this.controllers > 1;

            this.map.init(this.hasMultipleControllers, this.maps);
   
            // Log what was found
            this.log('Discovered the following:')
            if (this.config.hasHeater) this.log('* Heater');
            if (this.config.hasCooler) this.log('* Cooler');
            if (this.config.hasEvap) this.log('* Evaporative Cooler');
            this.log(`* Controllers: ${this.controllers}`);
            if (this.controllers === 1) {
                this.log(`* Zones: ${this.zones.join()}`);
            }

            this.configureThermostats(status);
            this.configureHeaterCoolers(status);
            this.configureZoneSwitches(status);
            this.configureFan(status);
            this.configurePump(status);
            this.configureAdvanceSwitch(status);
            this.configureManualSwitch(status);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    configureThermostats(status) {
        this.debug(this.constructor.name, 'configureThermostats', 'status');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (this.useThermostat && i < this.controllers) {
                let name = this.hasMultipleControllers ? this.zones[i] : this.name;
                this.addAccessory(RinnaiTouchThermostat, name, status, zone);
            } else {
                this.removeAccessory(RinnaiTouchThermostat, zone);
            }
        }
    }

    configureHeaterCoolers(status) {
        this.debug(this.constructor.name, 'configureHeaterCoolers', 'status');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (!this.useThermostat && i < this.controllers) {
                let name = this.hasMultipleControllers ? this.zones[i] : this.name;
                this.addAccessory(RinnaiTouchHeaterCooler, name, status, zone);
            } else {
                this.removeAccessory(RinnaiTouchHeaterCooler, zone);
            }
        }
    }

    configureZoneSwitches(status) {
        this.debug(this.constructor.name, 'configureZoneSwitches', 'status');

        let hasZoneSwitches = this.showZoneSwitches && this.controllers === 1 && this.zones.length > 1;
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
        this.debug(this.constructor.name, 'configureFan', 'status');

        if (this.showFan) {
            this.addAccessory(RinnaiTouchFan, 'Circulation Fan', status);
        } else {
            this.removeAccessory(RinnaiTouchFan);
        }
    }

    configurePump(status) {
        this.debug(this.constructor.name, 'configurePump', 'status');

        if (this.hasEvap) {
            this.addAccessory(RinnaiTouchPump, 'Evaporative Pump', status);
        } else {
            this.removeAccessory(RinnaiTouchPump);
        }
    }

    configureAdvanceSwitch(status) {
        this.debug(this.constructor.name, 'configureAdvanceSwitch', 'status');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (this.showAdvanceSwitches && i < this.controllers) {
                let name = this.hasMultipleControllers ? `Advance Period ${this.zones[i]}` : 'Advance Period';
                this.addAccessory(RinnaiTouchAdvanceSwitch, name, status, zone);
            } else {
                this.removeAccessory(RinnaiTouchAdvanceSwitch, zone);
            }
        }
    }

    configureManualSwitch(status) {
        this.debug(this.constructor.name, 'configureManualSwitch', 'status');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (this.showManualSwitches && i < this.controllers) {
                let name = this.hasMultipleControllers ? `Manual ${this.zones[i]}` : 'Manual';
                this.addAccessory(RinnaiTouchManualSwitch, name, status, zone);
            } else {
                this.removeAccessory(RinnaiTouchManualSwitch, zone);
            }
        }
    }

    addAccessory(RinnaiTouchAccessory, name, status, zone) {
        this.debug(this.constructor.name, 'addAccessory', RinnaiTouchAccessory.name, name, 'status', zone);
      
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
        this.debug(this.constructor.name, 'removeAccessory', RinnaiTouchAccessory.name, zone);

        let rtAccessory = new RinnaiTouchAccessory(this);
        let key = rtAccessory.getKey(zone);
        if (!(key in this.accessories))
            return;
    
        let accessory = this.accessories[key].accessory;
        this.api.unregisterPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [accessory]);
        delete this.accessories[key];
    }

    async postProcess() {
        this.debug(this.constructor.name, 'postProcess');
        try {
            let status = this.server.status;
            setTimeout(() => {
                this.updateAll(status);
            }, 500);

            // Clear the cached status
            this.server.status = undefined;

            // Close TCP connection
            await this.server.destroy(this.closeConnectionDelay);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    updateAll(status) {
        this.debug(this.constructor.name, 'updateAll', 'status');

        // Check if zones have changed
        if (this.controllers === 1) {
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
}