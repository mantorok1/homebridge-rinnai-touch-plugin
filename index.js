const RinnaiTouchServer = require('./RinnaiTouchServer');

let Service, Characteristic;

/*  config.json
    {
      "accessory": "RinnaiHeaterCooler",
      "name": "Rinnai Touch",
      "hasHeater": true,
      "hasCooler": true,
      "zones": {
        "A": "Bedrooms",
        "B": "Living Areas"
      },
      "debug": true,
      "initialCoolTemp": 27,
      "initialHeatTemp": 22
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
        this.name = config['name'];
        this.hasHeater = config['hasHeater'] === undefined ? true : config['hasHeater'];
        this.hasCooler = config['hasCooler'] === undefined ? true : config['hasCooler'];
        this.zones = config['zones'] || {};
        let initialCoolTemp = parseFloat(config['initialCoolTemp']) || 27;
        let initialHeatTemp = parseFloat(config['initialHeatTemp']) || 22;

        if (this.debug) this.log('RinnaiHeaterCooler()');

        this.characteristics = {
            Active: undefined,
            CurrentHeaterCoolerState: undefined,
            TargetHeaterCoolerState: undefined,
            CurrentTemperature: undefined,
            CoolingThresholdTemperature: initialCoolTemp,
            HeatingThresholdTemperature: initialHeatTemp,
            ZoneAOn: undefined,
            ZoneBOn: undefined,
            ZoneCOn: undefined,
            ZoneDOn: undefined,
        };

        this.server = new RinnaiTouchServer({log: log, debug: this.debug});
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
            .setCharacteristic(Characteristic.FirmwareRevision, '')
            .setCharacteristic(Characteristic.SerialNumber, '');
        
        services.push(informationService);
        
        // Heater Cooler Service
        let heaterCoolerService = new Service.HeaterCooler(this.name);
        heaterCoolerService
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getCharacteristic.bind(this, 'Active'))
            .on('set', this.setCharacteristic.bind(this, 'Active'));
  
        let currentValidStates = [Characteristic.CurrentHeaterCoolerState.IDLE];
        if (this.hasHeater) {
            currentValidStates.push(Characteristic.CurrentHeaterCoolerState.HEATING);
        }
        if (this.hasCooler) {
            currentValidStates.push(Characteristic.CurrentHeaterCoolerState.COOLING);
        }

        heaterCoolerService
            .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .setProps({
                validValues: currentValidStates
            })
            .on('get', this.getCharacteristic.bind(this, 'CurrentHeaterCoolerState'));

        let targetValidStates = [];
        if (this.hasHeater) {
            targetValidStates.push(Characteristic.TargetHeaterCoolerState.HEAT);
        }
        if (this.hasCooler) {
            targetValidStates.push(Characteristic.TargetHeaterCoolerState.COOL);
        }

        heaterCoolerService
            .getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                validValues: targetValidStates
            })
            .on('get', this.getCharacteristic.bind(this, 'TargetHeaterCoolerState'))
            .on('set', this.setCharacteristic.bind(this, 'TargetHeaterCoolerState'));

        heaterCoolerService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCharacteristic.bind(this, 'CurrentTemperature'));
    
        heaterCoolerService
            .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: 8,
                maxValue: 30,
                minStep: 1,
            })
            .on('get', this.getCharacteristic.bind(this, 'CoolingThresholdTemperature'))
            .on('set', this.setCharacteristic.bind(this, 'CoolingThresholdTemperature'));

        heaterCoolerService
            .getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: 8,
                maxValue: 30,
                minStep: 1,
            })
            .on('get', this.getCharacteristic.bind(this, 'HeatingThresholdTemperature'))
            .on('set', this.setCharacteristic.bind(this, 'HeatingThresholdTemperature'));
        services.push(heaterCoolerService);

        // Zone Switches
        if (Object.keys(this.zones).length > 1) {
            for(let zone in this.zones) {
                let key = `Zone${zone}`;
                let zoneService = new Service.Switch(this.zones[zone], key);
                zoneService
                    .getCharacteristic(Characteristic.On)
                    .on('get', this.getCharacteristic.bind(this, `${key}On`))
                    .on('set', this.setCharacteristic.bind(this, `${key}On`));
                
                services.push(zoneService);
            }
        }

        return services;
    }

    async getCharacteristic(characteristic, callback) {
        try {
            if (this.debug) this.log(`RinnaiHeaterCooler.getCharacteristic('${characteristic}')`);
            let status = await this.server.getStatus();
            this.update(status);
            callback(null, this.characteristics[characteristic]);
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }
    }

    async setCharacteristic(characteristic, value, callback) {
        try {
            if (this.debug) this.log(`RinnaiHeaterCooler.setCharacteristic('${characteristic}', ${value})`);
            var command = this.constructCommand(characteristic, value);
            await this.server.sendCommand(command);
            callback();
        }
        catch(error) {
            this.log(`ERROR: ${error.message}`);
            callback(error);
        }        
    }

    constructCommand(characteristic, value) {
        if (this.debug) this.log(`RinnaiHeaterCooler.constructCommand('${characteristic}', ${value})`);

        let mode = this.characteristics.TargetHeaterCoolerState === Characteristic.TargetHeaterCoolerState.HEAT
            ? 'HGOM' : 'CGOM';
        let components = [];

        switch (characteristic) {
            case 'Active':
                // ["HGOM/CGOM", "OOP", "ST", "N/F"]
                components = [
                    mode,
                    'OOP',
                    'ST',
                    value === Characteristic.Active.ACTIVE ? 'N' : 'F'
                ]; 
                break;
            case 'TargetHeaterCoolerState':
                // ["SYST", "OSS", "MD", "H/C"]
                components = [
                    'SYST',
                    'OSS',
                    'MD',
                    value === Characteristic.TargetHeaterCoolerState.HEAT ? 'H' : 'C'
                ];

                // Explicitly set characteristic
                this.characteristics.TargetHeaterCoolerState = value;
                break;
            case 'CoolingThresholdTemperature':
            case 'HeatingThresholdTemperature':
                // ["HGOM/CGOM", "GSO", "SP", "NN"]
                components = [
                    mode,
                    'GSO',
                    'SP',
                    ('0' + value).slice(-2)
                ];
                break;
            case 'ZoneAOn':
            case 'ZoneBOn':
            case 'ZoneCOn':
            case 'ZoneDOn':
                // ["HGOM/CGOM", "ZXO", "UE", "Y/N"]
                components = [
                    mode,
                    `Z${characteristic.substr(4, 1)}O`,
                    'UE',
                    value ? 'Y' : 'N'
                ];
                break;
            default:
                throw new Error(`Unknown characteristic [${characteristic}] specified`);
        }

        return `N000001{"${components[0]}":{"${components[1]}":{"${components[2]}":"${components[3]}"}}}`;
    }

    update(status) {
        if (this.debug) this.log(`RinnaiHeaterCooler.update('${status}')`);

        const HEAT = 1;
        const COOL = 2;

        let statusObj = JSON.parse(status);
        let mode = HEAT;
        let modeObj = null;

        switch(Object.keys(statusObj[1])[0]) {
            case 'HGOM':
                mode = HEAT;
                modeObj = statusObj[1].HGOM;
                break;
            case 'CGOM':
                mode = COOL;
                modeObj = statusObj[1].CGOM;
                break;
            default:
                this.log("Mode not found");
                return;
        }

        // Features
        //this.hasHeater = statusObj[0].SYST.AVM.HG === 'Y';
        //this.hasCooler = statusObj[0].SYST.AVM.CG === 'Y';

        // Active
        this.characteristics.Active = modeObj.OOP.ST === 'N' // ON
            ? Characteristic.Active.ACTIVE
            : Characteristic.Active.INACTIVE;
        // CurrentHeaterCoolerState
        this.characteristics.CurrentHeaterCoolerState = Characteristic.CurrentHeaterCoolerState.IDLE;
        if ('GSS' in modeObj) {
            if ('HC' in modeObj.GSS && modeObj.GSS.HC === 'Y') {
                this.characteristics.CurrentHeaterCoolerState = Characteristic.CurrentHeaterCoolerState.HEATING;
            }
            else if ('CC' in modeObj.GSS && modeObj.GSS.CC === 'Y') {
                this.characteristics.CurrentHeaterCoolerState = Characteristic.CurrentHeaterCoolerState.COOLING;
            }
        }
        // TargetHeaterCoolerState
        this.characteristics.TargetHeaterCoolerState = mode === HEAT
            ? Characteristic.TargetHeaterCoolerState.HEAT
            : Characteristic.TargetHeaterCoolerState.COOL;
        // CurrentTemperature
        this.characteristics.CurrentTemperature = parseFloat(modeObj.ZUS.MT) / 10.0;
        // CoolingThresholdTemperature
        if (mode === COOL && 'GSO' in modeObj) {
            this.characteristics.CoolingThresholdTemperature = parseFloat(modeObj.GSO.SP);
        }
        // HeatingThresholdTemperature
        if (mode === HEAT && 'GSO' in modeObj) {
            this.characteristics.HeatingThresholdTemperature = parseFloat(modeObj.GSO.SP);
        }

        // Zones
        for(let zone in this.zones) {
            // On
            if (`Z${zone}O` in modeObj) {
                this.characteristics[`Zone${zone}On`] = modeObj[`Z${zone}O`].UE === 'Y';
            }
        }
    }
}