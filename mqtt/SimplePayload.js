let Characteristic;

class SimplePayload {
    #log;
    #settings;
    #server;
    #accessories;

    constructor(platform) {
        this.#log = platform.log;
        this.#log.debug(this.constructor.name, undefined, 'platform');

        this.#settings = platform.settings;
        this.#server = platform.server;
        this.#accessories = platform.accessories;

        Characteristic = platform.Characteristic;
    }

    async getStatus() {
        this.#log.debug(this.constructor.name, 'getStatus');

        try {
            const status = await this.#server.getStatus();
            return this.convertStatus(status);
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    processCommand(payload) {
        this.#log.debug(this.constructor.name, 'processCommand', payload);

        try {
            this.#log.info(`MQTT Payload received: ${payload}`);

            let json = JSON.parse(payload);
            let key = Object.keys(json)[0];
            let value = json[key];
    
            switch(key) {
                case 'TargetState':
                    this.sendTargetStateCommand(value);
                    break;
                case 'TargetTemp':
                    this.sendTargetTempCommand(value);
                    break;
                case 'ZoneOn':
                    this.sendZoneOnCommand(value);
                    break;
                case 'ManualOn':
                    this.sendManualOnCommand(value);
                    break;
                case 'AdvancePeriodOn':
                    this.sendAdvancePeriodOnCommand(value);
                    break;
                case 'FanOn':
                    this.sendFanOnCommand(value);
                    break;
                case 'FanSpeed':
                    this.sendFanSpeedCommand(value);
                    break;
                case 'PumpOn':
                    this.sendPumpOnCommand(value);
                    break;
                default:
                    this.#log.warn(`Unknown command: ${payload}`);
            }
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    convertStatus(status) {
        this.#log.debug(this.constructor.name, 'convertStatus', 'status');

        let payload = {
            TargetState: {},
            CurrentState: {},
            TargetTemp: {},
            CurrentTemp: {},
            ZoneOn: {},
            ManualOn: {},
            AdvancePeriodOn: {},
            FanOn: {},
            FanSpeed: {},
            PumpOn: {}
        };

        for(let key in this.#accessories) {
            let type = this.#accessories[key].accessory.context.type;

            switch(type) {
                case 'thermostat':
                    this.getThermostatStates(this.#accessories[key], status, payload);
                    break;
                case 'heatercooler':
                    this.getHeaterCoolerStates(this.#accessories[key], status, payload);
                    break;
                case 'zoneswitch':
                    this.getZoneSwitchStates(this.#accessories[key], status, payload);
                    break;
                case 'manualswitch':
                    this.getManualSwitchStates(this.#accessories[key], status, payload);
                    break;
                case 'advanceswitch':
                    this.getAdvanceSwitchStates(this.#accessories[key], status, payload);
                    break;
                case 'fan':
                    this.getFanStates(this.#accessories[key], status, payload);
                    break;
                case 'pump:':
                    this.getPumpStates(this.#accessories[key], status, payload);
                    break;
                default:
                    this.#log.warn(`Unknown accessory type: ${type}`);
            }
        }

        // Clean up payload
        for(let key in payload) {
            let zones = Object.keys(payload[key]).length;
            if (zones === 0) {
                delete payload[key];
                continue;
            }
            if (zones === 1) {
                payload[key] = payload[key]['A'];
            }
        }

        return JSON.stringify(payload);
    }

    getThermostatStates(accessory, status, payload) {
        this.#log.debug(this.constructor.name, 'getThermostatStates', 'status', 'payload');

        let zone = accessory.accessory.context.zone;

        // TargetState
        let value = accessory.getTargetHeatingCoolingState(status);
        switch (value) {
            case Characteristic.TargetHeatingCoolingState.HEAT:
                payload.TargetState[zone] = 'heat';
                break;
            case Characteristic.TargetHeatingCoolingState.HEAT:
                payload.TargetState[zone] = 'cool';
                break;
            default:
                payload.TargetState[zone] = 'off';
        };

        // CurrentState
        value = accessory.getCurrentHeatingCoolingState(status);
        switch(value) {
            case Characteristic.CurrentHeatingCoolingState.HEAT:
                payload.CurrentState[zone] = 'heating';
                break;
            case Characteristic.CurrentHeatingCoolingState.COOL:
                payload.CurrentState[zone] = 'cooling';
                break;
            default:
                payload.CurrentState[zone] = 'idle';
        }

        // Target Temp
        value = accessory.getTargetTemperature(status);
        payload.TargetTemp[zone] = value;

        // Current Temp
        value = accessory.getCurrentTemperature(status);
        payload.CurrentTemp[zone] = value;
    }

    getHeaterCoolerStates(accessory, status, payload) {
        this.#log.debug(this.constructor.name, 'getHeaterCoolerStates', 'status', 'payload');

        let zone = accessory.accessory.context.zone;

        // TargetState
        let value = accessory.getActive(status);
        if (value === Characteristic.Active.INACTIVE) {
            payload.TargetState[zone] = 'off';
        } else {
            value = accessory.getTargetHeaterCoolerState(status);
            if (value === Characteristic.TargetHeaterCoolerState.HEAT) {
                payload.TargetState[zone] = 'heat';
            } else {
                payload.TargetState[zone] = 'cool';
            }
        }

        // CurrentState
        value = accessory.getCurrentHeaterCoolerState(status);
        switch(value) {
            case Characteristic.CurrentHeaterCoolerState.HEATING:
                payload.CurrentState[zone] = 'heating';
                break;
            case Characteristic.CurrentHeaterCoolerState.COOLING:
                payload.CurrentState[zone] = 'cooling';
                break;
            default:
                payload.CurrentState[zone] = 'idle';
        }

        // Target Temp
        value = accessory.getThresholdTemperature(status);
        payload.TargetTemp[zone] = value;

        // Current Temp
        value = accessory.getCurrentTemperature(status);
        payload.CurrentTemp[zone] = value;
    }

    getZoneSwitchStates(accessory, status, payload) {
        this.#log.debug(this.constructor.name, 'getZoneSwitchStates', 'status', 'payload');

        let zone = accessory.accessory.context.zone;
        let value = accessory.getZoneSwitchOn(status);
        payload.ZoneOn[zone] = value;
    }

    getManualSwitchStates(accessory, status, payload) {
        this.#log.debug(this.constructor.name, 'getManualSwitchStates', 'status', 'payload');

        let zone = accessory.accessory.context.zone;
        let value = accessory.getManualSwitchOn(status);
        payload.ManualOn[zone] = value;
    }

    getAdvanceSwitchStates(accessory, status, payload) {
        this.#log.debug(this.constructor.name, 'getAdvanceSwitchStates', 'status', 'payload');

        let zone = accessory.accessory.context.zone;
        let value = accessory.getAdvanceSwitchOn(status);
        payload.AdvancePeriodOn[zone] = value;
    }

    getFanStates(accessory, status, payload) {
        this.#log.debug(this.constructor.name, 'getFanStates', 'status', 'payload');

        // FanOn
        let value = accessory.getFanOn(status);
        payload.FanOn['A'] = value;

        //FanSpeed
        value = accessory.getFanRotationSpeed(status);
        payload.FanSpeed['A'] = parseInt(value);
    }

    getPumpStates(accessory, status, payload) {
        this.#log.debug(this.constructor.name, 'getPumpStates', 'status', 'payload');

        let value = accessory.getPumpActive(status);
        payload.PumpOn['A'] = value === Characteristic.Active.ACTIVE;
    }

    sendTargetStateCommand(value) {
        this.#log.debug(this.constructor.name, 'sendTargetStateCommand', value);

        try {
            let zones = this.getZoneValues(value, this.#settings.controllers);

            for(let zone in zones) {
                let accessory = this.getAccessory('thermostat', zone);
                if (accessory === undefined)
                    continue;

                if (this.#settings.useThermostat) {
                    this.sendTargetStateThermostat(accessory, zones[zone]);
                } else {
                    this.sendTargetStateHeaterCooler(accessory, zones[zone]);
                }

                if (zones[zone] !== 'auto') {
                    break;
                }
            }
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendTargetStateThermostat(accessory, state) {
        this.#log.debug(this.constructor.name, 'sendTargetStateThermostat', state);

        try {
            let value;
            let setValue = accessory.setTargetHeatingCoolingState.bind(accessory);

            switch(state) {
                case 'off':
                    value = Characteristic.TargetHeatingCoolingState.OFF;
                    break;
                case 'heat':
                    value = Characteristic.TargetHeatingCoolingState.HEAT;
                    break;
                case 'cool':
                    value = Characteristic.TargetHeatingCoolingState.COOL;
                    break;
                case 'auto':
                    value = Characteristic.TargetHeatingCoolingState.AUTO;
                    break;
            }

            await accessory.setCharacteristicValue(setValue, value, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendTargetStateHeaterCooler(accessory, state) {
        this.#log.debug(this.constructor.name, 'sendTargetStateHeaterCooler', state);

        try {
            // SetActive
            let setValue = accessory.setActive.bind(accessory);
            let value = state === 'off'
                ? Characteristic.Active.INACTIVE
                : Characteristic.Active.ACTIVE;

            await accessory.setCharacteristicValue(setValue, value, () => {});

            if (state === 'off') {
                return;
            }

            // TargetState
            setValue = accessory.setTargetHeaterCoolerState.bind(accessory);
            switch(state) {
                case 'heat':
                    value = Characteristic.TargetHeaterCoolerState.HEAT;
                    break;
                case 'cool':
                    value = Characteristic.TargetHeaterCoolerState.COOL;
                    break;
                case 'auto':
                    value = Characteristic.TargetHeaterCoolerState.AUTO;
                    break;
            }

            await accessory.setCharacteristicValue(setValue, value, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendTargetTempCommand(value) {
        this.#log.debug(this.constructor.name, 'sendTargetTempCommand', value);

        try {
            let zones = this.getZoneValues(value, this.#settings.controllers);

            for(let zone in zones) {
                let accessory = this.getAccessory('thermostat', zone);
                if (accessory === undefined)
                    continue;

                let setValue = this.#settings.useThermostat
                    ? accessory.setTargetTemperature.bind(accessory)
                    : accessory.setThresholdTemperature.bind(accessory);

                await accessory.setCharacteristicValue(setValue, zones[zone], () => {});
            }
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendZoneOnCommand(value) {
        this.#log.debug(this.constructor.name, 'sendZoneOnCommand', value);

        try {
            let status = await this.#server.getStatus();
            let zones = this.getZoneValues(value, status.getZones().length);

            for(let zone in zones) {
                let accessory = this.getAccessory('zone', zone);
                if (accessory === undefined)
                    continue;

                let setValue = accessory.setZoneSwitchOn.bind(accessory);

                await accessory.setCharacteristicValue(setValue, zones[zone], () => {});
            }
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendManualOnCommand(value) {
        this.#log.debug(this.constructor.name, 'sendManualOnCommand', value);

        try {
            let zones = this.getZoneValues(value, this.#settings.controllers);

            for(let zone in zones) {
                let accessory = this.getAccessory('manual', zone);
                if (accessory === undefined)
                    continue;

                let setValue = accessory.setManualSwitchOn.bind(accessory);

                await accessory.setCharacteristicValue(setValue, zones[zone], () => {});
            }
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendAdvancePeriodOnCommand(value) {
        this.#log.debug(this.constructor.name, 'sendAdvancePeriodOnCommand', value);

        try {
            let zones = this.getZoneValues(value, this.#settings.controllers);

            for(let zone in zones) {
                let accessory = this.getAccessory('advance', zone);
                if (accessory === undefined)
                    continue;

                let setValue = accessory.setAdvanceSwitchOn.bind(accessory);

                await accessory.setCharacteristicValue(setValue, zones[zone], () => {});
            }
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendFanOnCommand(value) {
        this.#log.debug(this.constructor.name, 'sendFanOnCommand', value);

        try {
            let accessory = this.getAccessory('fan');
            if (accessory === undefined)
                return;
    
            let setValue = accessory.setFanOn.bind(accessory);

            await accessory.setCharacteristicValue(setValue, value, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendFanSpeedCommand(value) {
        this.#log.debug(this.constructor.name, 'sendFanSpeedCommand', value);

        try {
            let accessory = this.getAccessory('fan');
            if (accessory === undefined)
                return;
    
            let setValue = accessory.setFanRotationSpeed.bind(accessory);

            await accessory.setCharacteristicValue(setValue, value, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async sendPumpOnCommand(value) {
        this.#log.debug(this.constructor.name, 'sendPumpOnCommand', value);

        try {
            let accessory = this.getAccessory('pump');
            if (accessory === undefined)
                return;
    
            let setValue = accessory.setPumpActive.bind(accessory);

            value = value
                ? Characteristic.Active.ACTIVE
                : Characteristic.Active.INACTIVE;

            await accessory.setCharacteristicValue(setValue, value, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    getAccessory(type, zone) {
        this.#log.debug(this.constructor.name, 'getAccessory', type, zone);

        let key = undefined;
        switch(type) {
            case 'thermostat':
                key = this.#settings.useThermostat ? 'Thermostat' : 'HeaterCooler';
                break;
            case 'zone':
                key = 'ZoneSwitch'
                break;
            case 'fan':
                key = 'Fan';
                break;
            case 'advance':
                key = 'AdvanceSwitch';
                break;
            case 'manual':
                key = 'ManualSwitch';
                break;
            case 'pump':
                key = 'Pump';
                break;
            default:
                this.#log.warn(`Unknown type: ${type}`);
        }

        if (key === undefined)
            return;

        if (zone) {
            key += `_${zone}`;
        }

        return this.#accessories[key];
    }

    getZoneValues(value, count) {
        this.#log.debug(this.constructor.name, 'getZoneValues', value, count);

        if (typeof value === 'object')
            return value;

        let zones = {};
        for (let i = 0; i < count; i++) {
            let zone = String.fromCharCode(65 + i);
            zones[zone] = value;
        }
        return zones;
    }
}

module.exports = SimplePayload;