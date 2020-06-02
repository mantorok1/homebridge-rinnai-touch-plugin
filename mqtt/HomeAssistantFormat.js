let Characteristic;

class HomeAssistantFormat {
    #log;
    #server;
    #map;
    #settings;
    #accessories;

    constructor(platform) {
        this.#log = platform.log;
        this.#log.debug(this.constructor.name, undefined, 'platform');

        this.#server = platform.server;
        this.#map = platform.map;
        this.#settings = platform.settings;
        this.#accessories = platform.accessories;

        Characteristic = platform.Characteristic;
    }

    get subscriptionTopics() {
        return [
            'ha/fan_mode/set',
            'ha/mode/set',
            'ha/temperature/set'
        ];
    }

    async getStatusMessages() {
        this.#log.debug(this.constructor.name, 'getStatusMessages');

        try {
            const status = await this.#server.getStatus();
            let messages = [];
            messages.push(this.getActionMessage(status));
            messages.push(this.getCurrentTemperatureMessage(status));
            messages.push(this.getFanModeMessage(status));
            messages.push(this.getModeMessage(status));
            messages.push(this.getTemperatureMessage(status));

            return messages.filter((value) => {return value !== undefined});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async processCommandMessage(topic, payload) {
        this.#log.debug(this.constructor.name, 'processCommand', payload);

        try {
            switch(topic) {
                case 'ha/fan_mode/set':
                    this.setFanMode(payload);
                    break;
                case 'ha/mode/set':
                    this.setMode(payload);
                    break;
                case 'ha/temperature/set':
                    this.setTemperature(payload);
                    break;
                default:
                    this.#log.warn(`Invalid topic in MQTT message: ${topic}`);
                    return;
            } 
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    getActionMessage(status) {
        this.#log.debug(this.constructor.name, 'getActionMessage', 'status');

        let payload;
        if (status.getZones().length === 1) {
            payload = this.getAction(status, 'A');
        } else {
            payload = {};
            for(let i = 0; i < status.getZones().length; i++) {
                let zone = String.fromCharCode(65 + i);
                payload[zone] = this.getAction(status, zone);
            }
        }

        if (this.isPayloadUndefined(payload)) {
            return;
        }

        return {
            topic: 'ha/action/get',
            payload: JSON.stringify(payload)
        };
    }

    getAction(status, zone) {
        this.#log.debug(this.constructor.name, 'getAction', 'status', zone);

        let path = this.#map.getPath('State', status.mode, zone);
        let state = status.getState(path);
        if (state === undefined) {
            return;
        }
        if (state === 'F') {
            return 'off';
        }
        if (state === 'Z') {
            return 'fan';
        }

        path = this.#map.getPath('Active', status.mode, zone);
        state = status.getState(path);
        if (state === undefined) {
            return undefined;
        }
        return state === 'N'
            ? 'idle'
            : status.mode === 'HGOM' ? 'heating' : 'cooling';
    }

    getCurrentTemperatureMessage(status) {
        this.#log.debug(this.constructor.name, 'getCurrentTemperatureMessage', 'status');

        let payload;
        if (status.getZones().length === 1) {
            payload = this.getCurrentTemperature(status, 'A');
        } else {
            payload = {};
            for(let i = 0; i < status.getZones().length; i++) {
                let zone = String.fromCharCode(65 + i);
                payload[zone] = this.getCurrentTemperature(status, zone);
            }
        }

        if (this.isPayloadUndefined(payload)) {
            return;
        }

        return {
            topic: 'ha/current_temperature/get',
            payload: JSON.stringify(payload)
        };
    }

    getCurrentTemperature(status, zone) {
        this.#log.debug(this.constructor.name, 'getCurrentTemperature', 'status', zone);

        let path = this.#map.getPath('CurrentTemp', status.mode, zone);
        let state = status.getState(path);
        return state === undefined || state === '999'
            ? undefined
            : `${parseFloat(state) / 10.0}`;
    }

    getFanModeMessage(status) {
        this.#log.debug(this.constructor.name, 'getFanModeMessage', 'status');

        let path = this.#map.getPath('FanSpeed', status.mode);
        let state = status.getState(path);

        if (state === undefined) {
            return;
        }

        let speed = parseInt(state);

        let payload = 'low';
        if (speed > 5) {
            payload = 'medium';
        }
        if (speed > 10) {
            payload = 'high';
        }

        return {
            topic: 'ha/fan_mode/get',
            payload: JSON.stringify(payload)
        };
    }

    getModeMessage(status) {
        this.#log.debug(this.constructor.name, 'getModeMessage', 'status');

        let payload;

        let path = this.#map.getPath('State', status.mode);
        let state = status.getState(path);
        path = this.#map.getPath('Mode');
        let mode = status.getState(path);

        if (state === 'F') {
            payload = 'off';
        }
        else if (state === 'Z') {
            payload = 'fan_only';
        }
        else {
            if (mode === 'H') {
                payload = 'heat';
            } else {
                payload = 'cool';
            }
        }

        return {
            topic: 'ha/mode/get',
            payload: JSON.stringify(payload)
        };
    }

    getTemperatureMessage(status) {
        this.#log.debug(this.constructor.name, 'getTemperatureMessage', 'status');

        let payload;
        if (this.#settings.controllers === 1) {
            payload = this.getTemperature(status);
        } else {
            payload = {};
            for(let i = 0; i < this.#settings.controllers; i++) {
                let zone = String.fromCharCode(65 + i);
                payload[zone] = this.getTemperature(status, zone);
            }
        }

        if (this.isPayloadUndefined(payload)) {
            return;
        }

        return {
            topic: 'ha/temperature/get',
            payload: JSON.stringify(payload)
        };
    }

    getTemperature(status, zone) {
        this.#log.debug(this.constructor.name, 'getTemperature', 'status', zone);

        let path = this.#map.getPath('TargetTemp', status.mode, zone);
        return status.getState(path);
    }

    async setFanMode(fanMode) {
        this.#log.debug(this.constructor.name, 'setMode', fanMode);

        try {
            let accessory = this.getAccessory('fan');
            if (accessory === undefined)
                return;
    
            let setValue = accessory.setFanRotationSpeed.bind(accessory);
            let value;

            switch (fanMode) {
                case 'low':
                    value = 31.25;
                    break;
                case 'medium':
                    value = 62.5;
                    break;
                default:
                    value = 100;
            }

            await accessory.setCharacteristicValue(setValue, value, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    setMode(mode) {
        this.#log.debug(this.constructor.name, 'setMode', mode);

        try {
            if (mode === 'fan_only') {
                this.setFanOn();
                return;
            }
            
            let accessory = this.getAccessory('thermostat', 'A');
            if (accessory === undefined)
                return;

            if (this.#settings.useThermostat) {
                this.setModeThermostat(accessory, mode);
            } else {
                this.setModeHeaterCooler(accessory, mode);
            }
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setFanOn() {
        this.#log.debug(this.constructor.name, 'setFanOn');

        try {
            let accessory = this.getAccessory('fan');
            if (accessory === undefined)
                return;
    
            let setValue = accessory.setFanOn.bind(accessory);

            await accessory.setCharacteristicValue(setValue, true, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setModeThermostat(accessory, mode) {
        this.#log.debug(this.constructor.name, 'setModeThermostat', 'accessory', mode);

        try {
            let value;
            let setValue = accessory.setTargetHeatingCoolingState.bind(accessory);

            switch(mode) {
                case 'off':
                    value = Characteristic.TargetHeatingCoolingState.OFF;
                    break;
                case 'heat':
                    value = Characteristic.TargetHeatingCoolingState.HEAT;
                    break;
                case 'cool':
                    value = Characteristic.TargetHeatingCoolingState.COOL;
                    break;
            }

            await accessory.setCharacteristicValue(setValue, value, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setModeHeaterCooler(accessory, mode) {
        this.#log.debug(this.constructor.name, 'setModeHeaterCooler', 'accessory', mode);

        try {
            // SetActive
            let setValue = accessory.setActive.bind(accessory);
            let value = mode === 'off'
                ? Characteristic.Active.INACTIVE
                : Characteristic.Active.ACTIVE;

            await accessory.setCharacteristicValue(setValue, value, () => {});

            if (mode === 'off') {
                return;
            }

            // TargetState
            setValue = accessory.setTargetHeaterCoolerState.bind(accessory);
            switch(mode) {
                case 'heat':
                    value = Characteristic.TargetHeaterCoolerState.HEAT;
                    break;
                case 'cool':
                    value = Characteristic.TargetHeaterCoolerState.COOL;
                    break;
            }

            await accessory.setCharacteristicValue(setValue, value, () => {});
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async setTemperature(temp) {
        this.#log.debug(this.constructor.name, 'setTemperature', temp);

        try {
            let zoneTemps = this.getZoneValues(temp, this.#settings.controllers);

            for(let zone in zoneTemps) {
                let accessory = this.getAccessory('thermostat', zone);
                if (accessory === undefined)
                    continue;

                let setValue = this.#settings.useThermostat
                    ? accessory.setTargetTemperature.bind(accessory)
                    : accessory.setThresholdTemperature.bind(accessory);

                let targetTemp = parseInt(zoneTemps[zone]);

                await accessory.setCharacteristicValue(setValue, targetTemp, () => {});
            }
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

    isPayloadUndefined(payload) {
        this.#log.debug(this.constructor.name, 'isPayloadUndefined', 'payload');

        if (payload === undefined) {
            return true;
        }

        if (typeof payload === 'object') {
            return Object.values(payload).some(x => (x === undefined));
        }

        return false;
    }
}

module.exports = HomeAssistantFormat;