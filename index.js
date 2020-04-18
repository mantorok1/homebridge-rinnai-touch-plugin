const crypto = require('crypto');
const RinnaiTouchServer = require('./RinnaiTouchServer');
const Mapper = require('./Mapper');
const PluginVersion = require('./package.json').version;

let Accessory, Service, Characteristic, UUIDGen;

/*  config.json
    {
        "platform": "RinnaiTouchPlatform",
        "name": "Rinnai Touch",
        "controllers": 1,
        "maps": {},
        "showAuto": true,
        "showZoneSwitches": true,
        "showFan": true,
        "showAdvanceSwitch": true,
        "refresh": 60,
        "clearCache": false,
        "debug": true
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

        if (config === null) {
            config = {};
        }

        this.debug = config.debug === undefined ? false : config.debug;

        if (this.debug) this.log(`RinnaiTouchPlatform(log,${JSON.stringify(config)},api)`);

        this.name = config.name || 'Rinnai Touch';
        this.controllers = config.controllers
        this.maps = config.maps;
        this.showAuto = config.showAuto === undefined ? true : config.showAuto;
        this.showZoneSwitches = config.showZoneSwitches === undefined ? true : config.showZoneSwitches;
        this.showFan = config.showFan === undefined ? true : config.showFan;
        this.showAdvanceSwitch = config.showAdvanceSwitch === undefined ? true : config.showAdvanceSwitch;
        this.clearCache = config.clearCache === undefined ? false : config.clearCache;

        this.accessories = {};

        this.server = new RinnaiTouchServer({log: this.log, debug: this.debug});
        this.server.queue.drained(this.postProcess.bind(this));

        if (api) {
            this.api = api;

            this.api.on('didFinishLaunching', () => {
                this.discover();

                // Refresh characteristics
                if (config.refresh) {
                    this.log(`Refresh every ${config.refresh} seconds`);
                    let ms = parseInt(config.refresh) * 1000;
                    setInterval(this.updateAll.bind(this), ms);
                }
            });
        }
    }

    configureAccessory(accessory) {
        if (this.debug) this.log('RinnaiTouchPlatform.configureAccessory(accessory)');

        this.log(`Configure ${accessory.displayName}`);

        accessory.reachable = true;
        let zone;
        let service;

        this.setAccessoryInformation(accessory);

        switch(accessory.context.type) {
            case 'thermostat':
                zone = accessory.context.zone;
                service = accessory.getService(Service.Thermostat);
    
                service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                    .on('get', this.getCharacteristic.bind(this, zone, this.getCurrentHeatingCoolingState.bind(this)));
    
                service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
                    .on('get', this.getCharacteristic.bind(this, zone, this.getTargetHeatingCoolingState.bind(this)))
                    .on('set', this.setCharacteristic.bind(this, zone, this.setTargetHeatingCoolingState.bind(this)))
    
                service.getCharacteristic(Characteristic.CurrentTemperature)
                    .on('get', this.getCharacteristic.bind(this, zone, this.getCurrentTemperature.bind(this)))
    
                service.getCharacteristic(Characteristic.TargetTemperature)
                    .on('get', this.getCharacteristic.bind(this, zone, this.getTargetTemperature.bind(this)))
                    .on('set', this.setCharacteristic.bind(this, zone, this.setTargetTemperature.bind(this)))
    
                this.accessories[`Thermostat_${zone}`] = accessory;
                break;
            case 'zoneswitch':
                zone = accessory.context.zone;
                service = accessory.getService(Service.Switch);
                
                service
                    .getCharacteristic(Characteristic.On)
                    .on('get', this.getCharacteristic.bind(this, zone, this.getZoneSwitchOn.bind(this)))
                    .on('set', this.setCharacteristic.bind(this, zone, this.setZoneSwitchOn.bind(this)));
    
                this.accessories[`ZoneSwitch_${zone}`] = accessory;
                break;
            case 'fan':
                service = accessory.getService(Service.Fan);

                service
                    .getCharacteristic(Characteristic.On)
                    .on('get', this.getCharacteristic.bind(this, '', this.getFanOn.bind(this)))
                    .on('set', this.setCharacteristic.bind(this, '', this.setFanOn.bind(this)));
    
                service
                    .getCharacteristic(Characteristic.RotationSpeed)
                    .on('get', this.getCharacteristic.bind(this, '', this.getFanRotationSpeed.bind(this)))
                    .on('set', this.setCharacteristic.bind(this, '', this.setFanRotationSpeed.bind(this)));
    
                this.accessories['Fan'] = accessory;
                break;
            case 'pump':
                service = accessory.getService(Service.Valve);

                service
                    .getCharacteristic(Characteristic.Active)
                    .on('get', this.getCharacteristic.bind(this, '', this.getPumpActive.bind(this)))
                    .on('set', this.setCharacteristic.bind(this, '', this.setPumpActive.bind(this)));
        
                service
                    .getCharacteristic(Characteristic.InUse)
                    .on('get', this.getCharacteristic.bind(this, '', this.getPumpInUse.bind(this)))
    
                this.accessories['Pump'] = accessory;
                break;
            case 'advanceswitch':
                service = accessory.getService(Service.Switch);
            
                service
                    .getCharacteristic(Characteristic.On)
                    .on('get', this.getCharacteristic.bind(this, '', this.getAdvanceSwitchOn.bind(this)))
                    .on('set', this.setCharacteristic.bind(this, '', this.setAdvanceSwitchOn.bind(this)));
    
                this.accessories['AdvanceSwitch'] = accessory;
                break;
        }
    }

    async discover() {
        try {
            if (this.debug) this.log('RinnaiTouchPlatform.discover()');
            
            // Clear Cached accessories if required
            if (this.clearCache) {
                this.api.unregisterPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", Object.values(this.accessories));
                this.accessories = {};
            }

            let status = await this.server.getStatus();

            const path = {
                HasHeater: 'SYST.AVM.HG',
                HasCooler: 'SYST.AVM.CG',
                HasEvap: 'SYST.AVM.EC',
                HasMultipleControllers: 'SYST.CFG.MTSP',
                FirmwareVersion: 'SYST.CFG.VR'
            };

            this.hasHeater = status.getState(path.HasHeater) === 'Y';
            this.hasCooler = status.getState(path.HasCooler) === 'Y';
            this.hasEvap = status.getState(path.HasEvap) === 'Y';
            this.hasMultipleControllers = status.getState(path.HasMultipleControllers) === 'Y';
            this.firmwareVersion = status.getState(path.FirmwareVersion);
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

            this.map = new Mapper(this.hasMultipleControllers, this.maps, this.log, this.debug);
   
            // Log what was found
            this.log('Discovered the following:')
            if (this.hasHeater) this.log('* Heater');
            if (this.hasCooler) this.log('* Cooler');
            if (this.hasEvap) this.log('* Evaporative Cooler');
            this.log(`* Controllers: ${this.controllers}`);
            if (this.controllers === 1) {
                this.log(`* Zones: ${this.zones.join()}`);
            }

            this.configureThermostats(status);
            this.configureZoneSwitches(status);
            this.configureFan(status);
            this.configurePump(status);
            this.configureAdvanceSwitch(status);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    configureThermostats(status) {
        if (this.debug) this.log('RinnaiTouchPlatform.configureThermostats(status)');

        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (i < this.controllers) {
                let name = this.hasMultipleControllers ? this.zones[i] : this.name;
                this.addThermostat(zone, name, status);
            } else {
                this.removeAccessory(`Thermostat_${zone}`)
            }
        }
    }

    configureZoneSwitches(status) {
        if (this.debug) this.log('RinnaiTouchPlatform.configureZoneSwitches(status)');

        let hasZoneSwitches = this.showZoneSwitches && this.controllers === 1 && this.zones.length > 1;
        for(let i = 0; i < 4; i++) {
            let zone = String.fromCharCode(65 + i);
            if (hasZoneSwitches && i < this.zones.length) {
                this.addZoneSwitch(zone, this.zones[i], status);
            } else {
                this.removeAccessory(`ZoneSwitch_${zone}`);
            }
        }
    }

    configureFan(status) {
        if (this.debug) this.log('RinnaiTouchPlatform.configureFan(status)');

        if (this.showFan) {
            this.addFan('Circulation Fan', status);
        } else {
            this.removeAccessory('Fan');
        }
    }

    configurePump(status) {
        if (this.debug) this.log('RinnaiTouchPlatform.configurePump(status)');

        if (this.hasEvap) {
            this.addPump('Evaporative Pump', status);
        } else {
            this.removeAccessory('Pump');
        }
    }

    configureAdvanceSwitch(status) {
        if (this.debug) this.log('RinnaiTouchPlatform.configureAdvanceSwitch(status)');

        if (this.showAdvanceSwitch && this.controllers === 1) {
            this.addAdvanceSwitch('Advance Period', status);
        } else {
            this.removeAccessory('AdvanceSwitch');
        }
    }

    addThermostat(zone, serviceName, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.addThermostat('${zone}','${serviceName}', status)`);
      
        let accessoryKey = `Thermostat_${zone}`;
        if (accessoryKey in this.accessories)
            return;

        let accessoryName = `Thermostat ${zone}`;
        let uuid = UUIDGen.generate(accessoryName);
        let accessory = new Accessory(accessoryName, uuid);
        accessory.context.type = 'thermostat';
        accessory.context.zone = zone;

        this.setAccessoryInformation(accessory);

        let service = accessory.addService(Service.Thermostat, serviceName);

        service.setCharacteristic(Characteristic.TemperatureDisplayUnits, Characteristic.TemperatureDisplayUnits.CELSIUS);

        let validStates = this.getValidCurrentHeatingCoolingStates();
        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .setProps({
                minValue: Math.min(...validStates),
                maxValue: Math.max(...validStates),
                validValues: validStates
            })
            .on('get', this.getCharacteristic.bind(this, zone, this.getCurrentHeatingCoolingState.bind(this)))
            .updateValue(this.getCurrentHeatingCoolingState(status, zone));

        validStates = this.getValidTargetHeatingCoolingStates();
        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .setProps({
                minValue: Math.min(...validStates),
                maxValue: Math.max(...validStates),
                validValues: validStates
            })
            .on('get', this.getCharacteristic.bind(this, zone, this.getTargetHeatingCoolingState.bind(this)))
            .on('set', this.setCharacteristic.bind(this, zone, this.setTargetHeatingCoolingState.bind(this)))
            .updateValue(this.getTargetHeatingCoolingState(status));

        service.getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCharacteristic.bind(this, zone, this.getCurrentTemperature.bind(this)))
            .updateValue(this.getCurrentTemperature(status, zone));

        service.getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minValue: 8,
                maxValue: 30,
                minStep: 1,
            })
            .on('get', this.getCharacteristic.bind(this, zone, this.getTargetTemperature.bind(this)))
            .on('set', this.setCharacteristic.bind(this, zone, this.setTargetTemperature.bind(this)))
            .updateValue(this.getTargetTemperature(status, zone));

        this.accessories[accessoryKey] = accessory;
        this.api.registerPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [accessory]);
    }

    addZoneSwitch(zone, serviceName, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.addZoneSwitch('${zone}','${serviceName}', status)`);
      
        let accessoryKey = `ZoneSwitch_${zone}`;
        if (accessoryKey in this.accessories)
            return;
        
        let accessoryName = `ZoneSwitch ${zone}`;
        let uuid = UUIDGen.generate(accessoryName);
        let accessory = new Accessory(accessoryName, uuid);
        accessory.context.type = 'zoneswitch';
        accessory.context.zone = zone;

        this.setAccessoryInformation(accessory);

        let service = accessory.addService(Service.Switch, serviceName);
        service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristic.bind(this, zone, this.getZoneSwitchOn.bind(this)))
            .on('set', this.setCharacteristic.bind(this, zone, this.setZoneSwitchOn.bind(this)))
            .updateValue(this.getZoneSwitchOn(status, zone));

        this.accessories[accessoryKey] = accessory;
        this.api.registerPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [accessory]);
    }

    addFan(serviceName, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.addFan('${serviceName}', status)`);

        let accessoryKey = 'Fan';
        if (accessoryKey in this.accessories)
            return;
        
        let accessoryName = 'Fan';
        let uuid = UUIDGen.generate(accessoryName);
        let accessory = new Accessory(accessoryName, uuid);
        accessory.context.type = 'fan';

        this.setAccessoryInformation(accessory);

        let service = accessory.addService(Service.Fan, serviceName);
        service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristic.bind(this, '', this.getFanOn.bind(this)))
            .on('set', this.setCharacteristic.bind(this, '', this.setFanOn.bind(this)))
            .updateValue(this.getFanOn(status));

        service
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', this.getCharacteristic.bind(this, '', this.getFanRotationSpeed.bind(this)))
            .on('set', this.setCharacteristic.bind(this, '', this.setFanRotationSpeed.bind(this)))
            .updateValue(this.getFanRotationSpeed(status));

        service
            .getCharacteristic(Characteristic.RotationDirection)
            .updateValue(Characteristic.RotationDirection.CLOCKWISE);

        this.accessories[accessoryKey] = accessory;
        this.api.registerPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [accessory]);
    }

    addPump(serviceName, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.addPump('${serviceName}', status)`);

        let accessoryKey = 'Pump';
        if (accessoryKey in this.accessories)
            return;
        
        let accessoryName = 'Pump';
        let uuid = UUIDGen.generate(accessoryName);
        let accessory = new Accessory(accessoryName, uuid);
        accessory.context.type = 'pump';

        this.setAccessoryInformation(accessory);

        let service = accessory.addService(Service.Valve, serviceName);
        service
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getCharacteristic.bind(this, '', this.getPumpActive.bind(this)))
            .on('set', this.setCharacteristic.bind(this, '', this.setPumpActive.bind(this)))
            .updateValue(this.getPumpActive(status));

        service
            .getCharacteristic(Characteristic.InUse)
            .on('get', this.getCharacteristic.bind(this, '', this.getPumpInUse.bind(this)))
            .updateValue(this.getPumpInUse(status));

        service
            .getCharacteristic(Characteristic.ValveType)
            .updateValue(Characteristic.ValveType.GENERIC_VALVE);

        this.accessories[accessoryKey] = accessory;
        this.api.registerPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [accessory]);
    }

    addAdvanceSwitch(serviceName, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.addAdvanceSwitch('${serviceName}', status)`);
      
        let accessoryKey = 'AdvanceSwitch';
        if (accessoryKey in this.accessories)
            return;
        
        let accessoryName = 'AdvanceSwitch';
        let uuid = UUIDGen.generate(accessoryName);
        let accessory = new Accessory(accessoryName, uuid);
        accessory.context.type = 'advanceswitch';

        this.setAccessoryInformation(accessory);

        let service = accessory.addService(Service.Switch, serviceName);
        service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getCharacteristic.bind(this, '', this.getAdvanceSwitchOn.bind(this)))
            .on('set', this.setCharacteristic.bind(this, '', this.setAdvanceSwitchOn.bind(this)))
            .updateValue(this.getAdvanceSwitchOn(status));

        this.accessories[accessoryKey] = accessory;
        this.api.registerPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [accessory]);
    }

    setAccessoryInformation(accessory) {
        if (this.debug) this.log('RinnaiTouchPlatform.setAccessoryInformation(accessory)');

        accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, 'Rinnai')
            .setCharacteristic(Characteristic.Model, 'N-BW2')
            .setCharacteristic(Characteristic.SerialNumber, 
                crypto.createHash('sha1').update(accessory.UUID).digest('hex'))
            .setCharacteristic(Characteristic.FirmwareRevision, PluginVersion);
    }

    removeAccessory(accessoryKey) {
        if (this.debug) this.log(`RinnaiTouchPlatform.removeAccessory('${accessoryKey}')`);

        if (!(accessoryKey in this.accessories))
            return;
    
        let accessory = this.accessories[accessoryKey];
        this.api.unregisterPlatformAccessories("homebridge-rinnai-touch-plugin", "RinnaiTouchPlatform", [accessory]);
        delete this.accessories[accessoryKey];
    }

    getValidCurrentHeatingCoolingStates () {
        if (this.debug) this.log('RinnaiTouchPlatform.getValidCurrentHeatingCoolingStates()');

        let validStates = [Characteristic.CurrentHeatingCoolingState.OFF];
        if (this.hasHeater) {
            validStates.push(Characteristic.CurrentHeatingCoolingState.HEAT);
        }
        if (this.hasCooler || this.hasEvap) {
            validStates.push(Characteristic.CurrentHeatingCoolingState.COOL);
        }
        return validStates;
    }

    getValidTargetHeatingCoolingStates() {
        if (this.debug) this.log('RinnaiTouchPlatform.getValidTargetHeatingCoolingStates()');

        let validStates = [Characteristic.TargetHeatingCoolingState.OFF];
        if (this.hasHeater) {
            validStates.push(Characteristic.TargetHeatingCoolingState.HEAT);
        }
        if (this.hasCooler || this.hasEvap) {
            validStates.push(Characteristic.TargetHeatingCoolingState.COOL);
        }
        if (this.showAuto) {
            validStates.push(Characteristic.TargetHeatingCoolingState.AUTO);
        }

        return validStates;
    }

    async getCharacteristic(zone, getValue, callback) {
        try {
            if (this.debug) this.log(`RinnaiTouchPlatform.getCharacteristic('${zone}', getValue, callback)`);

            let status = await this.server.getStatus();
            let value = getValue(status, zone);

            callback(null, value);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }
    }

    getCurrentHeatingCoolingState(status, zone) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getCurrentHeatingCoolingState(status, '${zone}')`);

        let path = this.map.getPath('Active', status.mode, zone);
        let state = status.getState(path);

        if (state === undefined || state === 'N')
            return Characteristic.CurrentHeatingCoolingState.OFF;
        
        if (status.mode === 'HGOM')
            return Characteristic.CurrentHeatingCoolingState.HEAT;

        return Characteristic.CurrentHeatingCoolingState.COOL;
    }

    getTargetHeatingCoolingState(status) {
        if (this.debug) this.log('RinnaiTouchPlatform.getTargetHeatingCoolingState(status)');

        let path = this.map.getPath('State', status.mode);
        let state = status.getState(path);

        if (state === undefined || state !== 'N')
            return Characteristic.TargetHeatingCoolingState.OFF;

        if (status.mode === 'HGOM')
            return Characteristic.TargetHeatingCoolingState.HEAT;
        
        return Characteristic.TargetHeatingCoolingState.COOL;
    }

    getCurrentTemperature(status, zone) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getCurrentTemperature(status,'${zone}')`);

        let path = this.map.getPath('CurrentTemp', status.mode, zone);
        let state = status.getState(path);

        if (state === undefined || state === '999')
            return null;

        return parseFloat(state) / 10.0;
    }

    getTargetTemperature(status, zone) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getTargetTemperature(status,'${zone}')`);

        let path = this.map.getPath('TargetTemp', status.mode, zone);
        let state = status.getState(path);

        if (state === undefined)
            return null;

        return parseFloat(state);
    }

    getZoneSwitchOn(status, zone) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getZoneSwitchOn(status,'${zone}')`);

        let path = this.map.getPath('ZoneSwitch', status.mode, zone);
        let state = status.getState(path);

        if (state === undefined)
            return false;

        return state === 'Y';
    }

    getFanOn(status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getFanOn(status)`);

        let path = this.map.getPath('State', status.mode);
        let state = status.getState(path);

        if (state === undefined)
            return false;

        if ((status.mode !== 'ECOM' && state === 'Z') || (status.mode === 'ECOM' && state !== 'F'))
            return true;

        return false;
    }

    getFanRotationSpeed(status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getFanRotationSpeed(status)`);

        let path = this.map.getPath('FanSpeed', status.mode);
        let state = status.getState(path);

        if (state === undefined)
            return 0;

        return parseFloat(state) / 16.0 * 100.0;
    }

    getPumpActive(status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getPumpActive(status)`);

        let path = this.map.getPath('Pump', status.mode);
        let state = status.getState(path);

        if (state === undefined)
            return Characteristic.Active.INACTIVE;

        if (state === 'N')
            return Characteristic.Active.ACTIVE;

        return Characteristic.Active.INACTIVE;
    }

    getPumpInUse(status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getPumpInUse(status)`);

        const active = this.getPumpActive(status);

        return active === Characteristic.Active.ACTIVE
            ? Characteristic.InUse.IN_USE
            : Characteristic.InUse.NOT_IN_USE;
    }

    getAdvanceSwitchOn(status) {
        if (this.debug) this.log('RinnaiTouchPlatform.getAdvanceSwitchOn(status)');

        let path = this.map.getPath('ScheduledPeriod', status.mode);
        let state = status.getState(path);

        if (state === undefined)
            return false;

        return state === 'A';
    }

    async setCharacteristic(zone, setValue, value, callback) {
        try {
            if (this.debug) this.log(`RinnaiTouchPlatform.setCharacteristic('${zone}',setValue,'${value}',callback)`);
            
            let status = await this.server.getStatus();
            let commands = setValue(value, status, zone);

            for(let command of commands) {
                if (command !== undefined) {
                    status = await this.server.sendCommand(command);
                }
            }

            setTimeout(() => {
                this.updateAll(status);
            }, 500);
            
            callback();
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }
    }

    setTargetHeatingCoolingState(value, status, zone) {
        if (this.debug) this.log(`RinnaiTouchPlatform.setTargetHeatingCoolingState(${value},status,'${zone}')`);

        let commands = [];

        let currentValue = this.getTargetHeatingCoolingState(status);
        if (currentValue === value)
            return commands;

        let path = undefined;
        let state = undefined;
        let expect = {};

        // If not turning off and fan is on then turn off first
        if (value !== Characteristic.TargetHeatingCoolingState.OFF) {
            path = this.map.getPath('State', status.mode);
            if (status.getState(path) === 'Z') {
                commands.push(this.getCommand(path, 'F'));
            }
        }

        if (currentValue === Characteristic.TargetHeatingCoolingState.OFF) {
            path = this.map.getPath('State', status.mode);
            commands.push(this.getCommand(path, 'N'));
        }

        switch(value) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                path = this.map.getPath('State', status.mode);
                commands.push(this.getCommand(path, 'F'));
                break;
            case Characteristic.TargetHeatingCoolingState.HEAT:
                path = this.map.getPath('Mode');
                expect = {
                    path: this.map.getPath('HeatState'),
                    state: 'N'
                };
                commands.push(this.getCommand(path, 'H', expect));
                break;
            case Characteristic.TargetHeatingCoolingState.COOL:
                path = this.map.getPath('Mode');
                expect = {
                    path: this.map.getPath(this.hasCooler ? 'CoolState' : 'EvapState'),
                    state: 'N'
                };
                commands.push(this.getCommand(path, this.hasCooler ? 'C' : 'E', expect));
                break;
            case Characteristic.TargetHeatingCoolingState.AUTO:
                path = this.map.getPath('Operation', status.mode, zone);
                state = status.getState(path);
                if (state !== 'A')
                    commands.push(this.getCommand(path, 'A'));
                path = this.map.getPath('ScheduledPeriod', status.mode, zone);
                state = status.getState(path);
                if (state !== 'N')
                    commands.push(this.getCommand(path, 'N'));
                break;
        }

        return commands;
    }

    setTargetTemperature(value, status, zone) {
        if (this.debug) this.log(`RinnaiTouchPlatform.setTargetTemperature(${value},status,'${zone}')`);

        let commands = [];

        let currentValue = this.getTargetTemperature(status, zone);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('TargetTemp', status.mode, zone);
        let state = ('0' + value).slice(-2);
        commands.push(this.getCommand(path, state));
        
        return commands;
    }

    setZoneSwitchOn(value, status, zone) {
        if (this.debug) this.log(`RinnaiTouchPlatform.setZoneSwitchOn(${value},status,'${zone}')`);

        let commands = [];

        let currentValue = this.getZoneSwitchOn(status, zone);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('ZoneSwitch', status.mode, zone);
        let state = value ? 'Y' : 'N';
        commands.push(this.getCommand(path, state));

        return commands;
    }

    setFanOn(value, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.setFanOn(${value},status)`);

        let commands = [];

        let currentValue = this.getFanOn(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('State', status.mode);

        // If turning on fan and heater/cooling currently on then turn off first
        if (value) {
            if (status.getState(path) === 'N' && status.mode !== 'ECOM') {
                commands.push(this.getCommand(path, 'F'));
            }
        }

        let state = 'F';
        if (value) {
            state = status.mode === 'ECOM' ? 'N' : 'Z';
        }
        commands.push(this.getCommand(path, state));

        return commands;
    }

    setFanRotationSpeed(value, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.setFanRotationSpeed(${value},status)`);

        let commands = [];

        let currentValue = this.getFanRotationSpeed(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('FanSpeed', status.mode);
        let state = ('0' + Math.round(value / 100.0 * 16.0)).slice(-2)
        
        commands.push(this.getCommand(path, state));

        return commands;    
    }

    setPumpActive(value, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.setPumpActive(${value},status)`);

        let commands = [];

        let currentValue = this.getPumpActive(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('Pump', status.mode);
        let state = value === Characteristic.Active.ACTIVE ? 'N' : 'F';

        commands.push(this.getCommand(path, state));

        return commands;
    }

    setAdvanceSwitchOn(value, status) {
        if (this.debug) this.log(`RinnaiTouchPlatform.setZoneSwitchOn(${value},status)`);

        let commands = [];

        let currentValue = this.getAdvanceSwitchOn(status);
        if (currentValue === value)
            return commands;

        let path = this.map.getPath('ScheduledPeriod', status.mode);
        let state = value ? 'A' : 'N';
        commands.push(this.getCommand(path, state));

        return commands;
    }

    getCommand(path, state, expect) {
        if (this.debug) this.log(`RinnaiTouchPlatform.getCommand('${path}','${state}',${JSON.stringify(expect)})`);

        if (path === undefined) {
            this.log('ERROR: Cannot determine path for command');
            return undefined;
        }

        if (state === undefined) {
            this.log('ERROR: Unable to determine state for command');
            return undefined;
        }

        if (expect === undefined) {
            expect = {
                path: path,
                state: state
            }
        }

        path = path.split('.');
        return {
            instruction: `N000001{"${path[0]}":{"${path[1]}":{"${path[2]}":"${state}"}}}`,
            expect: expect
        };
    }

    async postProcess() {
        try {
            if (this.debug) this.log('RinnaiTouchPlatform.postProcess()');

            // Clear the cached status
            this.server.status = undefined;

            // Close TCP connection
            await this.server.destroy();
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    updateAll(status) {
        if (this.debug) this.log('RinnaiTouchPlatform.updateAll(status)');

        // Check if zones have changed
        if (this.controllers === 1) {
            if (this.zones.length !== status.getZones().length) {
                this.zones = status.getZones();
                this.configureZoneSwitches(status);
            }
        }

        // Update values for all accesories
        for(let accessoryKey in this.accessories) {
            let accessory = this.accessories[accessoryKey];
            let type = accessory.context.type;
            let zone = accessory.context.zone;
            let service;

            switch(type) {
                case 'thermostat':
                    service = accessory.getService(Service.Thermostat);

                    service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                        .updateValue(this.getCurrentHeatingCoolingState(status, zone));
    
                    service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
                        .updateValue(this.getTargetHeatingCoolingState(status));
    
                    service.getCharacteristic(Characteristic.CurrentTemperature)
                        .updateValue(this.getCurrentTemperature(status, zone));
    
                    service.getCharacteristic(Characteristic.TargetTemperature)
                        .updateValue(this.getTargetTemperature(status, zone));
                    break;
                case 'zoneswitch':
                    service = accessory.getService(Service.Switch);

                    service.getCharacteristic(Characteristic.On)
                        .updateValue(this.getZoneSwitchOn(status, zone));
                    break;
                case 'fan':
                    service = accessory.getService(Service.Fan);

                    service.getCharacteristic(Characteristic.On)
                        .updateValue(this.getFanOn(status));

                    service.getCharacteristic(Characteristic.RotationSpeed)
                        .updateValue(this.getFanRotationSpeed(status));
                    
                    service.getCharacteristic(Characteristic.RotationDirection)
                        .updateValue(Characteristic.RotationDirection.CLOCKWISE);
                    break;
                case 'pump':
                    service = accessory.getService(Service.Valve);

                    service.getCharacteristic(Characteristic.Active)
                        .updateValue(this.getPumpActive(status));

                    service.getCharacteristic(Characteristic.InUse)
                        .updateValue(this.getPumpInUse(status));
                    break;
                case 'advanceswitch':
                    service = accessory.getService(Service.Switch);

                    service.getCharacteristic(Characteristic.On)
                        .updateValue(this.getAdvanceSwitchOn(status, zone));
                    break;
            }
        }
    }
}