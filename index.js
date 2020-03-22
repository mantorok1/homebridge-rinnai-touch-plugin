const RinnaiTouchServer = require('./RinnaiTouchServer');

let Service, Characteristic;

/*  config.json
    {
      "accessory": "RinnaiHeaterCooler",
      "name": "Rinnai Touch",
      "zones": {
        "A": "Bedrooms",
        "B": "Living Areas"
      },
      "map": {},
      "refresh": 60,
      "debug": true
    }
*/

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
  
    homebridge.registerAccessory(
      'homebridge-rinnai-touch-plugin',
      'RinnaiHeaterCooler',
      RinnaiHeaterCooler
    );
};

class RinnaiHeaterCooler {
    constructor(log, config) {
        this.log = log;
        this.debug = config['debug'] === undefined ? false : config['debug'];

        if (this.debug) this.log('RinnaiHeaterCooler()');

        this.name = config['name'] || 'Rinnai Touch';
        this.zones = config['zones'] || {};
        this.map = this.getMap(config['map'] || {});

        this.coolerValue = 'C';
        this.commandSent = false;
        this.currentMode = undefined;

        this.server = new RinnaiTouchServer({log: this.log, debug: this.debug});
        this.server.queue.drained(this.postProcess.bind(this));

        // Refresh characteristics
        if (config['refresh']) {
            this.log(`Refresh every ${config['refresh']} seconds`);
            let ms = parseInt(config['refresh']) * 1000;
            setInterval(this.updateAll.bind(this), 60000);
        }
    }

    getServices() {
        if (this.debug) this.log('RinnaiHeaterCooler.getServices()');

        this.services = {};
        let services = [];

        // Information Service
        let informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Rinnai')
            .setCharacteristic(Characteristic.Model, 'N-BW2')
            .setCharacteristic(Characteristic.FirmwareRevision, this.version) // What does this do?
            .setCharacteristic(Characteristic.SerialNumber, this.version);
        
        this.services['Information'] = informationService;
        services.push(informationService);

        // Heater Cooler Service
        let heaterCoolerService = new Service.HeaterCooler(this.name);
        heaterCoolerService
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getCharacteristic.bind(this, 'HeaterCooler_Active'))
            .on('set', this.setCharacteristic.bind(this, 'HeaterCooler_Active'));

        heaterCoolerService
            .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .on('get', this.getCharacteristic.bind(this, 'HeaterCooler_CurrentHeaterCoolerState'));

        heaterCoolerService
            .getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .on('get', this.getCharacteristic.bind(this, 'HeaterCooler_TargetHeaterCoolerState'))
            .on('set', this.setCharacteristic.bind(this, 'HeaterCooler_TargetHeaterCoolerState'));

        heaterCoolerService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCharacteristic.bind(this, 'HeaterCooler_CurrentTemperature'));

        heaterCoolerService
            .getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: 8,
                maxValue: 30,
                minStep: 1,
            })
            .on('get', this.getCharacteristic.bind(this, 'HeaterCooler_HeatingThresholdTemperature'))
            .on('set', this.setCharacteristic.bind(this, 'HeaterCooler_HeatingThresholdTemperature'))
            .updateValue(8);
    
        heaterCoolerService
            .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: 8,
                maxValue: 30,
                minStep: 1,
            })
            .on('get', this.getCharacteristic.bind(this, 'HeaterCooler_CoolingThresholdTemperature'))
            .on('set', this.setCharacteristic.bind(this, 'HeaterCooler_CoolingThresholdTemperature'))
            .updateValue(8);

        this.services['HeaterCooler'] = heaterCoolerService;
        services.push(heaterCoolerService);

        // Zone Switches
        if (Object.keys(this.zones).length > 1) {
            for(let zone in this.zones) {
                let service = `SwitchZone${zone}`;
                let zoneSwitch = new Service.Switch(this.zones[zone], service);
                zoneSwitch
                    .getCharacteristic(Characteristic.On)
                    .on('get', this.getCharacteristic.bind(this, `${service}_On`))
                    .on('set', this.setCharacteristic.bind(this, `${service}_On`));
                   
                this.services[service] = zoneSwitch;
                services.push(zoneSwitch);
            }
        }

        setTimeout(this.init.bind(this), 1000);

        return services;
    }

    async init() {
        try {
            if (this.debug) this.log('RinnaiHeaterCooler.init()');
            let status = await this.server.getStatus();

            this.currentMode = ('HGOM' in status[1]) ? 'heat' : 'cool';
            let hasHeater = this.getState(this.map['init']['HasHeater'], status) === 'Y';
            let hasCooler = this.getState(this.map['init']['HasCooler'], status) === 'Y';
            let hasEvap = this.getState(this.map['init']['HasEvap'], status) === 'Y';

            if (hasHeater) this.log('Found Heater');
            if (hasCooler) this.log('Found Cooler');
            if (hasEvap) this.log('Found Evaporative Cooler');

            if (hasEvap) {
                this.coolerValue = 'E';
            }

            // CurrentHeaterCoolerState
            let currentValidStates = [Characteristic.CurrentHeaterCoolerState.IDLE];
            if (hasHeater) {
                currentValidStates.push(Characteristic.CurrentHeaterCoolerState.HEATING);
            }
            if (hasCooler || hasEvap) {
                currentValidStates.push(Characteristic.CurrentHeaterCoolerState.COOLING);
            }
            this.services['HeaterCooler']
                .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
                .setProps({
                    minValue: Math.min(...currentValidStates),
                    maxValue: Math.max(...currentValidStates),
                    validValues: currentValidStates
                })
                .updateValue(Characteristic.CurrentHeaterCoolerState.IDLE);

            // TargetHeaterCoolerState
            let targetValidStates = [];
            if (hasHeater) {
                targetValidStates.push(Characteristic.TargetHeaterCoolerState.HEAT);
            }
            if (hasCooler || hasEvap) {
                targetValidStates.push(Characteristic.TargetHeaterCoolerState.COOL);
            }
            this.services['HeaterCooler']
                .getCharacteristic(Characteristic.TargetHeaterCoolerState)
                .setProps({
                    minValue: Math.min(...targetValidStates),
                    maxValue: Math.max(...targetValidStates),
                    validValues: targetValidStates
                })
                .updateValue(Characteristic.TargetHeaterCoolerState.HEAT);

            // Zones
            const path1 = Object.keys(status[1])[0];
            for(const zone of ['A', 'B', 'C', 'D']) {
                let enabled = this.getState([1, path1, 'CFG', `Z${zone}IS`], status) === 'Y';
                let name = this.getState([0, 'SYST', 'CFG', `Z${zone}`], status).trim();
                this.log(`Zone ${zone}: Name: '${name}', Enabled: ${enabled}`);
            }
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    async postProcess() {
        try {
            if (this.debug) this.log('RinnaiHeaterCooler.postProcess()');

            // Clear the cached status
            this.server.status = undefined;

            if (this.commandSent) {
                this.commandSent = false;
                // Wait a few seconds to allow status to catch up with commands sent
                await new Promise((resolve) => {setTimeout(resolve, 4000)});
                this.updateAll();
            }
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }
    }

    async updateAll() {
        try {
            if (this.debug) this.log('RinnaiHeaterCooler.updateAll()');

            let status = await this.server.getStatus();
            this.currentMode = ('HGOM' in status[1]) ? 'heat' : 'cool';
            
            for(let key in this.map[this.currentMode]) {
                const [service, characteristic] = key.split('_');

                if (!(service in this.services)) {
                    continue;
                }

                let path = this.map[this.currentMode][key];
                let state = this.getState(path, status);
                let value = state === undefined
                    ? this.getDefaultValue(key)
                    : this.convertFromState(key, state);
            
                this.services[service]
                    .getCharacteristic(Characteristic[characteristic])
                    .updateValue(value);
            }
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }        
    }

    async getCharacteristic(characteristic, callback) {
        try {
            if (this.debug) this.log(`RinnaiHeaterCooler.getCharacteristic('${characteristic}')`);
            let status = await this.server.getStatus();

            this.currentMode = ('HGOM' in status[1]) ? 'heat' : 'cool';
            let path = this.map[this.currentMode][characteristic];
            let state = this.getState(path, status);

            let value = state === undefined
                ? this.getDefaultValue(characteristic)
                : this.convertFromState(characteristic, state);

            callback(null, value);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }
    }

    getState(path, status) {
        if (this.debug) this.log(`RinnaiHeaterCooler.getState('${path}', ${JSON.stringify(status)})`);

        if (path === undefined) {
            return undefined;
        }

        let state = undefined;
        if (path[2] in status[path[0]][path[1]]) {
            if (path[3] in status[path[0]][path[1]][path[2]]) {
                state = status[path[0]][path[1]][path[2]][path[3]];
            }
        }
        return state;
    }

    convertFromState(characteristic, state) {
        if (this.debug) this.log(`RinnaiHeaterCooler.convertFromState('${characteristic}', '${state}')`);

        switch(characteristic) {
            case 'HeaterCooler_Active':
                return state === 'N'
                    ? Characteristic.Active.ACTIVE
                    : Characteristic.Active.INACTIVE;
            case 'HeaterCooler_CurrentHeaterCoolerState':
                return state === 'N'
                    ? Characteristic.CurrentHeaterCoolerState.IDLE
                    : this.currentMode === 'heat'
                        ? Characteristic.CurrentHeaterCoolerState.HEATING
                        : Characteristic.CurrentHeaterCoolerState.COOLING;
            case 'HeaterCooler_TargetHeaterCoolerState':
                return state === 'H'
                    ? Characteristic.TargetHeaterCoolerState.HEAT
                    : Characteristic.TargetHeaterCoolerState.COOL;
            case 'HeaterCooler_CurrentTemperature':
                return parseFloat(state) / 10.0;
            case 'HeaterCooler_HeatingThresholdTemperature':
            case 'HeaterCooler_CoolingThresholdTemperature':
                return parseFloat(state);
            case 'SwitchZoneA_On':
            case 'SwitchZoneB_On':
            case 'SwitchZoneC_On':
            case 'SwitchZoneD_On':
                return state === 'Y';
            default:
                throw new Error(`Invalid characteristic: ${characteristic}`);
        }
    }

    getDefaultValue(characteristic) {
        if (this.debug) this.log(`RinnaiHeaterCooler.getDefaultValue('${characteristic}')`);

        switch(characteristic) {
            case 'HeaterCooler_CurrentHeaterCoolerState':
                return Characteristic.CurrentHeaterCoolerState.IDLE;
            case 'HeaterCooler_CurrentTemperature':
                return null;
            case 'HeaterCooler_HeatingThresholdTemperature':
            case 'HeaterCooler_CoolingThresholdTemperature':
                return null;
            case 'SwitchZoneA_On':
            case 'SwitchZoneB_On':
            case 'SwitchZoneC_On':
            case 'SwitchZoneD_On':
                return false;
            default:
                throw new Error(`No default value for characteristic: ${characteristic}`);
        }
    }

    async setCharacteristic(characteristic, value, callback) {
        try {
            if (this.debug) this.log(`RinnaiHeaterCooler.setCharacteristic('${characteristic}', ${value})`);
            
            var command = this.constructCommand(characteristic, value);
            await this.server.sendCommand(command);
            this.commandSent = true;

            callback();
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }        
    }

    constructCommand(characteristic, value) {
        if (this.debug) this.log(`RinnaiHeaterCooler.constructCommand('${characteristic}', ${value})`);

        if (characteristic === 'HeaterCooler_TargetHeaterCoolerState') {
            this.currentMode = 'heat';
            if (value === Characteristic.TargetHeaterCoolerState.COOL) {
                this.currentMode = 'cool';
            }
        }

        let path = this.map[this.currentMode][characteristic];
        let state = this.convertToState(characteristic, value);

        return `N000001{"${path[1]}":{"${path[2]}":{"${path[3]}":"${state}"}}}`;
    }

    convertToState(characteristic, value) {
        if (this.debug) this.log(`RinnaiHeaterCooler.convertToState('${characteristic}', ${value})`);

        switch (characteristic) {
            case 'HeaterCooler_Active':
                return value === Characteristic.Active.ACTIVE ? 'N' : 'F';
            case 'HeaterCooler_TargetHeaterCoolerState':
                return value === Characteristic.TargetHeaterCoolerState.HEAT ? 'H' : this.coolerValue;
            case 'HeaterCooler_HeatingThresholdTemperature':
            case 'HeaterCooler_CoolingThresholdTemperature':
                return ('0' + value).slice(-2);
            case 'SwitchZoneA_On':
            case 'SwitchZoneB_On':
            case 'SwitchZoneC_On':
            case 'SwitchZoneD_On':
                return value ? 'Y' : 'N';
            default:
                throw new Error(`Invalid characteristic: ${characteristic}`);
        }
    }

    getMap(override) {
        if (this.debug) this.log(`RinnaiHeaterCooler.getMap(${JSON.stringify(override)})`);

        let map = {
            "init": {
                "HasHeater": [0, "SYST", "AVM", "HG"],
                "HasCooler": [0, "SYST", "AVM", "CG"],
                "HasEvap": [0, "SYST", "AVM", "EC"],
            },
            "heat": {
                "HeaterCooler_Active": [1, "HGOM", "OOP", "ST"], // N/F
                "HeaterCooler_CurrentHeaterCoolerState": [1, "HGOM", "GSS", "HC"], // Y/N
                "HeaterCooler_TargetHeaterCoolerState":  [0, "SYST", "OSS", "MD"], // H/C/E
                "HeaterCooler_CurrentTemperature": [1, "HGOM", "ZUS", "MT"], // nn
                "HeaterCooler_HeatingThresholdTemperature": [1, "HGOM", "GSO", "SP"], // nn
                "SwitchZoneA_On": [1, "HGOM", "ZAO", "UE"], // Y/N
                "SwitchZoneB_On": [1, "HGOM", "ZBO", "UE"], // Y/N
                "SwitchZoneC_On": [1, "HGOM", "ZCO", "UE"], // Y/N
                "SwitchZoneD_On": [1, "HGOM", "ZDO", "UE"] // Y/N
            },
            "cool": {
                "HeaterCooler_Active": [1, "CGOM", "OOP", "ST"],
                "HeaterCooler_CurrentHeaterCoolerState": [1, "CGOM", "GSS", "CC"],
                "HeaterCooler_TargetHeaterCoolerState":  [0, "SYST", "OSS", "MD"],
                "HeaterCooler_CurrentTemperature": [1, "CGOM", "ZUS", "MT"],
                "HeaterCooler_CoolingThresholdTemperature": [1, "CGOM", "GSO", "SP"],
                "SwitchZoneA_On": [1, "CGOM", "ZAO", "UE"],
                "SwitchZoneB_On": [1, "CGOM", "ZBO", "UE"],
                "SwitchZoneC_On": [1, "CGOM", "ZCO", "UE"],
                "SwitchZoneD_On": [1, "CGOM", "ZDO", "UE"]
            }        
        };

        // Apply the overrides
        for(let mode in override) {
            for(let characteristic in override[mode]) {
                if (override[mode][characteristic].length === 0) {
                    delete map[mode][characteristic];
                } else {
                    map[mode][characteristic] = override[mode][characteristic];
                }
            }
        }

        return map;
    }
}