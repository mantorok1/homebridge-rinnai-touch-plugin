const RinnaiTouchServer = require('./RinnaiTouchServer');

let Service, Characteristic;

/*  config.json
    {
      "accessory": "RinnaiHeaterCooler",
      "name": "Rinnai Touch",
      "controllers": [
            {
                "name": "Rinnai Touch",
                "map": {},
            }
      ],
      "zones": [
            {
                "name": "Bedrooms",
                "map": {}
            },
            {
                "name": "Living Areas",
                "map": {}
            }
        ],
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
        this.controllers = config['controllers'] || [{ "name": this.name }];
        this.zones = config['zones'] || [];

        this.services = {
            "HeaterCooler": [],
            "ZoneSwitch": []
        };

        this.maps = this.getMaps();

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

        let services = [];

        // Information Service
        let informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Rinnai')
            .setCharacteristic(Characteristic.Model, 'N-BW2')
            .setCharacteristic(Characteristic.FirmwareRevision, this.version) // What does this do?
            .setCharacteristic(Characteristic.SerialNumber, this.version);
        
        services.push(informationService);

        // Heater Cooler Service(s)
        for(let index in this.controllers) {
            index = parseInt(index);
            if (index > 3) {
                break;
            }

            let subType = `HeaterCooler${index}`;
            let heaterCoolerService = new Service.HeaterCooler(this.controllers[index].name, subType);

            heaterCoolerService
                .getCharacteristic(Characteristic.Active)
                .on('get', this.getCharacteristic.bind(this, index, 'HeaterCooler_Active'))
                .on('set', this.setCharacteristic.bind(this, index, 'HeaterCooler_Active'));

            heaterCoolerService
                .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
                .on('get', this.getCharacteristic.bind(this, index, 'HeaterCooler_CurrentHeaterCoolerState'));

            heaterCoolerService
                .getCharacteristic(Characteristic.TargetHeaterCoolerState)
                .setProps({
                    minValue: Characteristic.TargetHeaterCoolerState.HEAT
                })
                .on('get', this.getCharacteristic.bind(this, index, 'HeaterCooler_TargetHeaterCoolerState'))
                .on('set', this.setCharacteristic.bind(this, index, 'HeaterCooler_TargetHeaterCoolerState'))
                .updateValue(Characteristic.TargetHeaterCoolerState.HEAT);

            heaterCoolerService
                .getCharacteristic(Characteristic.CurrentTemperature)
                .on('get', this.getCharacteristic.bind(this, index, 'HeaterCooler_CurrentTemperature'));

            heaterCoolerService
                .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .setProps({
                    minValue: 8,
                    maxValue: 30,
                    minStep: 1,
                })
                .on('get', this.getCharacteristic.bind(this, index, 'HeaterCooler_HeatingThresholdTemperature'))
                .on('set', this.setCharacteristic.bind(this, index, 'HeaterCooler_HeatingThresholdTemperature'))
                .updateValue(8);
    
            heaterCoolerService
                .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .setProps({
                    minValue: 8,
                    maxValue: 30,
                    minStep: 1,
                })
                .on('get', this.getCharacteristic.bind(this, index, 'HeaterCooler_CoolingThresholdTemperature'))
                .on('set', this.setCharacteristic.bind(this, index, 'HeaterCooler_CoolingThresholdTemperature'))
                .updateValue(8);

            this.services.HeaterCooler.push(heaterCoolerService);
            services.push(heaterCoolerService);
        }

        // Zone Switches
        for(let index in this.zones) {
            index = parseInt(index);
            if (parseInt(index) > 3) {
                break;
            }

            let subType = `ZoneSwitch${index}`;
            let zoneSwitch = new Service.Switch(this.zones[index].name, subType);
            zoneSwitch
                .getCharacteristic(Characteristic.On)
                .on('get', this.getCharacteristic.bind(this, index, 'ZoneSwitch_On'))
                .on('set', this.setCharacteristic.bind(this, index, 'ZoneSwitch_On'));

            this.services.ZoneSwitch.push(zoneSwitch);
            services.push(zoneSwitch);
        }

        setTimeout(this.init.bind(this), 1000);

        return services;
    }

    async init() {
        try {
            if (this.debug) this.log('RinnaiHeaterCooler.init()');
            let status = await this.server.getStatus();

            const path = {
                "HasHeater": [0, "SYST", "AVM", "HG"],
                "HasCooler": [0, "SYST", "AVM", "CG"],
                "HasEvap": [0, "SYST", "AVM", "EC"],  
            };

            this.currentMode = ('HGOM' in status[1]) ? 'heat' : 'cool';
            let hasHeater = this.getState(path['HasHeater'], status) === 'Y';
            let hasCooler = this.getState(path['HasCooler'], status) === 'Y';
            let hasEvap = this.getState(path['HasEvap'], status) === 'Y';

            if (hasHeater) this.log('Found Heater');
            if (hasCooler) this.log('Found Cooler');
            if (hasEvap) this.log('Found Evaporative Cooler');

            if (hasEvap) {
                this.coolerValue = 'E';
            }

            // CurrentHeaterCoolerState - Valid States
            let currentValidStates = [Characteristic.CurrentHeaterCoolerState.IDLE];
            if (hasHeater) {
                currentValidStates.push(Characteristic.CurrentHeaterCoolerState.HEATING);
            }
            if (hasCooler || hasEvap) {
                currentValidStates.push(Characteristic.CurrentHeaterCoolerState.COOLING);
            }

            // TargetHeaterCoolerState - Valid States
            let targetValidStates = [];
            if (hasHeater) {
                targetValidStates.push(Characteristic.TargetHeaterCoolerState.HEAT);
            }
            if (hasCooler || hasEvap) {
                targetValidStates.push(Characteristic.TargetHeaterCoolerState.COOL);
            }

            for(let index in this.controllers) {
                index = parseInt(index);
                this.services.HeaterCooler[index]
                    .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
                    .setProps({
                        minValue: Math.min(...currentValidStates),
                        maxValue: Math.max(...currentValidStates),
                        validValues: currentValidStates
                    })
                    .updateValue(currentValidStates[0]);

                this.services.HeaterCooler[index]
                    .getCharacteristic(Characteristic.TargetHeaterCoolerState)
                    .setProps({
                        minValue: Math.min(...targetValidStates),
                        maxValue: Math.max(...targetValidStates),
                        validValues: targetValidStates
                    })
                    .updateValue(targetValidStates[0]);
            }

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
            
            for(let index in this.maps) {
                index = parseInt(index);
                let map = this.maps[index];
                for(let key in map[this.currentMode]) {
                    const [service, characteristic] = key.split('_');
    
                    if (index >= this.services[service].length) {
                        continue;
                    }
    
                    let path = map[this.currentMode][key];
                    let state = this.getState(path, status);
                    let value = state === undefined
                        ? this.getDefaultValue(key)
                        : this.convertFromState(key, state);
                
                    this.services[service][index]
                        .getCharacteristic(Characteristic[characteristic])
                        .updateValue(value);
                }
            }
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
        }        
    }

    async getCharacteristic(index, characteristic, callback) {
        try {
            if (this.debug) this.log(`RinnaiHeaterCooler.getCharacteristic(${index}, '${characteristic}')`);
            let status = await this.server.getStatus();

            this.currentMode = ('HGOM' in status[1]) ? 'heat' : 'cool';
            let path = this.maps[index][this.currentMode][characteristic];
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
            case 'ZoneSwitch_On':
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
            case 'ZoneSwitch_On':
                return false;
            default:
                throw new Error(`No default value for characteristic: ${characteristic}`);
        }
    }

    async setCharacteristic(index, characteristic, value, callback) {
        try {
            if (this.debug) this.log(`RinnaiHeaterCooler.setCharacteristic(${index}, '${characteristic}', ${value})`);
            
            var command = this.constructCommand(index, characteristic, value);
            await this.server.sendCommand(command);
            this.commandSent = true;

            callback();
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }        
    }

    constructCommand(index, characteristic, value) {
        if (this.debug) this.log(`RinnaiHeaterCooler.constructCommand(${index}, '${characteristic}', ${value})`);

        if (characteristic === 'HeaterCooler_TargetHeaterCoolerState') {
            this.currentMode = 'heat';
            if (value === Characteristic.TargetHeaterCoolerState.COOL) {
                this.currentMode = 'cool';
            }
        }

        let path = this.maps[index][this.currentMode][characteristic];
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
            case 'ZoneSwitch_On':
                return value ? 'Y' : 'N';
            default:
                throw new Error(`Invalid characteristic: ${characteristic}`);
        }
    }

    getMaps() {
        if (this.debug) this.log('RinnaiHeaterCooler.getMaps()');
        let maps = [];

        for(let index in this.controllers) {
            index = parseInt(index);
            if (maps.length === index) {
                maps.push(this.getMapDefault(index));
            }
            if ("map" in this.controllers[index]) {
                this.applyMapOverride(maps[index], this.controllers[index].map);
            }
        }

        for(let index in this.zones) {
            index = parseInt(index);
            if (maps.length === index) {
                maps.push(this.getMapDefault(index));
            }
            if ("map" in this.zones[index]) {
                this.applyMapOverride(maps[index], this.zones[index].map);
            }
        }

        return maps;
    }

    getMapDefault(index) {
        if (this.debug) this.log(`RinnaiHeaterCooler.getMapDefault(${index})`);

        let zone = String.fromCharCode(65 + index); // A, B, C or D
        let map = {
            "heat": {
                "HeaterCooler_Active": [1, "HGOM", "OOP", "ST"], // N/F
                "HeaterCooler_CurrentHeaterCoolerState": [1, "HGOM", "GSS", "HC"], // Y/N
                "HeaterCooler_TargetHeaterCoolerState":  [0, "SYST", "OSS", "MD"], // H/C/E
                "HeaterCooler_CurrentTemperature": [1, "HGOM", "ZUS", "MT"], // nn
                "HeaterCooler_HeatingThresholdTemperature": [1, "HGOM", "GSO", "SP"], // nn
                "ZoneSwitch_On": [1, "HGOM", `Z${zone}O`, "UE"], // Y/N
            },
            "cool": {
                "HeaterCooler_Active": [1, "CGOM", "OOP", "ST"],
                "HeaterCooler_CurrentHeaterCoolerState": [1, "CGOM", "GSS", "CC"],
                "HeaterCooler_TargetHeaterCoolerState":  [0, "SYST", "OSS", "MD"],
                "HeaterCooler_CurrentTemperature": [1, "CGOM", "ZUS", "MT"],
                "HeaterCooler_CoolingThresholdTemperature": [1, "CGOM", "GSO", "SP"],
                "ZoneSwitch_On": [1, "CGOM", `Z${zone}O`, "UE"],
            }        
        };

        return map;
    }

    applyMapOverride(map, override) {
        if (this.debug) this.log(`RinnaiHeaterCooler.applyMapOverride(${JSON.stringify(map)}, ${JSON.stringify(override)})`);

        for(let mode in override) {
            for(let characteristic in override[mode]) {
                if (override[mode][characteristic].length === 0) {
                    delete map[mode][characteristic];
                } else {
                    map[mode][characteristic] = override[mode][characteristic];
                }
            }
        }
    }
}