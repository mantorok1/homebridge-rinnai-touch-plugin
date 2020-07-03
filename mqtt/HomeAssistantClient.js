const ClientBase = require('./ClientBase');

class HomeAssistantClient extends ClientBase {
    #service;

    constructor(log, settings, service) {
        super(log, settings);
        this.log.debug(this.constructor.name, undefined, 'log', 'settings', 'service');

        this.#service = service;

        this.setPublications();
    }

    get subscriptionTopics() {
        return [
            'hvac/fan_mode/set',
            'hvac/mode/set',
            'hvac/temperature/set',
            'switch/zone/a/set',
            'switch/zone/b/set',
            'switch/zone/c/set',
            'switch/zone/d/set',
            'switch/heat/set',
            'switch/cool/set',
            'switch/evap/set',
            'switch/fan/set',
            'switch/manual/set',
            'switch/manual/a/set',
            'switch/manual/b/set',
            'switch/manual/c/set',
            'switch/manual/d/set'
        ];
    }

    setPublications() {
        this.log.debug(this.constructor.name, 'setPublications');

        // Publish at intervals
        if (this.settings.publishIntervals) {
            setInterval(async () => {
                this.log.info('MQTT Publish Event: Scheduled Interval');
                await this.#service.updateStates();
                if (!this.settings.publishStatusChanged) {
                    this.publishChanges();
                }
            }, this.settings.publishFrequency * 1000);
        }

        // Publish on status changed
        if (this.settings.publishStatusChanged) {
            this.#service.on('updated', () => {
                this.log.info('MQTT Publish Event: Status Changed')
                this.publishChanges();
            });
        }

        // Initial publication
        if (this.settings.publishIntervals || this.settings.publishStatusChanged) {
            setTimeout(async () => {
                await this.#service.updateStates();
                this.publishChanges();
            }, 1000);
        }
    }

    publishChanges() {
        this.log.debug(this.constructor.name, 'publishChanges');

        this.publishAction();
        this.publishCurrentTemperature();
        this.publishFanMode();
        this.publishMode();
        this.publishTemperature();
        this.publishZoneSwitches();
        this.publishHeatCoolEvapSwitches();
        this.publishFanSwitch();
        this.publishManualSwitches();
    }

    publishAction() {
        this.log.debug(this.constructor.name, 'publishAction');

        let payload = {};
        for(let zone of this.#service.zones) {
            if (!this.#service.getUserEnabled(zone)) {
                payload[zone] = 'off';
            }
            if (this.#service.getFanState()) {
                payload[zone] = 'fan';
                continue;
            }
            if (!this.#service.getState()) {
                payload[zone] = 'off';
                continue;
            }
            if (!this.#service.getAutoEnabled(zone)) {
                payload[zone] = 'idle';
                continue;
            }
            payload[zone] = this.#service.mode === this.#service.Modes.HEAT
                ? 'heating'
                : 'cooling';
        }
        this.publish('hvac/action/get', payload);
    }

    publishCurrentTemperature() {
        this.log.debug(this.constructor.name, 'publishCurrentTemperature');

        let payload = {};
        for(let zone of this.#service.zones) {
            if (this.#service.getCurrentTemperature(zone) !== undefined) {
                payload[zone] = this.#service.getCurrentTemperature(zone);
            }
        }
        this.publish('hvac/current_temperature/get', payload);
    }

    publishFanMode() {
        this.log.debug(this.constructor.name, 'publishFanMode');

        let fanSpeed = this.#service.getFanSpeed();

        let payload = 'low';
        if (fanSpeed > 5) {
            payload = 'medium';
        }
        if (fanSpeed > 10) {
            payload = 'high';
        }

        this.publish('hvac/fan_mode/get', payload);
    }

    publishMode() {
        this.log.debug(this.constructor.name, 'publishMode');

        let payload;
        if (this.#service.getFanState()) {
            payload = 'fan_only';
        }
        else if (!this.#service.getState()) {
            payload = 'off';
        }
        else if (this.#service.mode === this.#service.Modes.HEAT) {
            payload = 'heat';
        }
        else {
            payload = 'cool';

        }
        this.publish('hvac/mode/get', payload);
    }

    publishTemperature() {
        this.log.debug(this.constructor.name, 'publishCurrentTemperature');

        let payload;
        if (this.#service.hasMultiSetPoint) {
            payload = {};
            for(let zone of this.#service.controllers) {
                if (this.#service.getTargetTemperature(zone) !== undefined) {
                    payload[zone] = this.#service.getTargetTemperature(zone);
                }
            }
        } else {
            payload = this.#service.getTargetTemperature();
        }

        this.publish('hvac/temperature/get', payload);
    }

    publishZoneSwitches() {
        this.log.debug(this.constructor.name, 'publishZoneSwitches');

        for(let zone of ['A','B','C','D']) {
            if (this.#service.zones.includes(zone)) {
                let payload = this.#service.getUserEnabled(zone) ? 'on' : 'off';
                this.publish(`switch/zone/${zone.toLowerCase()}/get`, payload);
            }
        }
    }

    publishHeatCoolEvapSwitches() {
        this.log.debug(this.constructor.name, 'publishHeatCoolEvapSwitches');

        let payload;
        for(let mode of ['heat','cool','evap']) {
            if (this.#service.getState()) {
                payload = this.#service.mode === this.#service.Modes[mode.toUpperCase()] ? 'on' : 'off';
            } else {
                payload = 'off';
            }
            this.publish(`switch/${mode}/get`, payload);
        }
    }

    publishFanSwitch() {
        this.log.debug(this.constructor.name, 'publishFanSwitch');

        let payload = this.#service.getFanState() ? 'on' : 'off';
        this.publish('switch/fan/get', payload);
    }

    publishManualSwitches() {
        this.log.debug(this.constructor.name, 'publishManualSwitches');

        if (this.#service.hasMultiSetPoint) {
            for(let zone of this.#service.controllers) {
                if (this.#service.getControlMode(zone) !== undefined) {
                    let payload = this.#service.getControlMode(zone) === this.#service.ControlModes.MANUAL ? 'on' : 'off';
                    this.publish(`switch/manual/${zone.toLowerCase()}/get`, payload);
                }
            }
        } else {
            let payload = this.#service.getControlMode() === this.#service.ControlModes.MANUAL ? 'on' : 'off';
            this.publish('switch/manual/get', payload);
        }
    }

    process(topic, payload) {
        this.log.debug(this.constructor.name, 'process', topic, payload);

        try {
            switch(topic) {
                case 'hvac/fan_mode/set':
                    this.setFanMode(payload);
                    break;
                case 'hvac/mode/set':
                    this.setMode(payload);
                    break;
                case 'hvac/temperature/set':
                    this.setTemperature(payload);
                    break;
                case 'switch/zone/a/set':
                case 'switch/zone/b/set':
                case 'switch/zone/c/set':
                case 'switch/zone/d/set':
                    this.setZoneSwitch(topic, payload);
                    break;
                case 'switch/heat/set':
                case 'switch/cool/set':
                case 'switch/evap/set':
                    this.setModeSwitch(topic, payload);
                    break;
                case 'switch/fan/set':
                    this.setFanState(payload);
                    break;
                case 'switch/manual/set':
                case 'switch/manual/a/set':
                case 'switch/manual/b/set':
                case 'switch/manual/c/set':
                case 'switch/manual/d/set':
                    this.setControlMode(topic, payload);
                    break;
                default:
                    this.log.warn(`Invalid topic in MQTT message: ${topic}`);
                    return;
            } 
        }
        catch(error) {
            this.log.error(error);
        }
    }

    async setFanMode(payload) {
        this.log.debug(this.constructor.name, 'setFanMode', payload);

        let fanSpeed;
        switch(payload) {
            case 'low':
                fanSpeed = 5;
                break;
            case 'medium':
                fanSpeed = 10;
                break;
            case 'high':
                fanSpeed = 15;
                break;
            default:
                this.log.warn(`Invalid fan mode '${payload}' in payload`);
                return;
        }

        await this.#service.setFanSpeed(fanSpeed);
    }

    async setMode(payload) {
        this.log.debug(this.constructor.name, 'setMode', payload);

        switch(payload) {
            case 'fan_only':
                await this.#service.setState(false);
                await this.#service.setFanState(true);
                break;
            case 'off':
                await this.#service.setState(false);
                await this.#service.setFanState(false);
                break;
            case 'heat':
                await this.#service.setFanState(false);
                await this.#service.setMode(this.#service.Modes.HEAT);
                await this.#service.setState(true);
                break;
            case 'cool':
                await this.#service.setFanState(false);
                let mode = this.#service.hasEvaporative
                    ? this.#service.Modes.EVAP
                    : this.#service.Modes.COOL;
                await this.#service.setMode(mode);
                await this.#service.setState(true);
                break;
            default:
                this.log.warn(`Invalid mode '${payload}' in payload`);
                return;
        }
    }

    async setTemperature(payload) {
        this.log.debug(this.constructor.name, 'setTemperature', payload);

        try {
            payload = JSON.parse(payload);
            if (typeof payload === 'object') {
                for(let zone in payload) {
                    if (this.isValidTemperature(payload[zone])) {
                        await this.#service.setTargetTemperature(payload[zone], zone);
                    }
                }
            } else {
                if (this.isValidTemperature(payload)) {
                    await this.#service.setTargetTemperature(payload);
                }
            }
        }
        catch(error) {
            this.log.error(error);
        }
    }

    isValidTemperature(temp) {
        this.log.debug(this.constructor.name, 'isValidTemperature', temp);

        let value = parseInt(temp);
        if (value === NaN) {
            this.log.warn(`Invalid temperature specified: ${temp}`);
            return false;
        }
        if (value < 8 || value > 30) {
            this.log.warn(`Temperature ${temp} not between 8 and 30`);
            return false;
        }
        return true;
    }

    async setZoneSwitch(topic, payload) {
        this.log.debug(this.constructor.name, 'setZoneSwitch', topic, payload);

        try {
            let zone = topic.split('/')[2].toUpperCase();
            let value = payload.toLowerCase() === 'on';
            await this.#service.setUserEnabled(value, zone);
        }
        catch(error) {
            this.log.error(error);
        }
    }

    async setModeSwitch(topic, payload) {
        this.log.debug(this.constructor.name, 'setModeSwitch', topic, payload);

        try {
            let mode = topic.split('/')[1].toUpperCase();
            mode = this.#service.Modes[mode];

            let state = payload.toLowerCase() === 'on';

            if (this.#service.getFanState()) {
                await this.#service.setFanState(false);
            }

            if (state) {
                await this.#service.setMode(mode);
                await this.#service.setState(true);
            } else {
                await this.#service.setState(false);
            }
        }
        catch(error) {
            this.log.error(error);
        }
    }

    async setFanState(payload) {
        this.log.debug(this.constructor.name, 'setFanState', payload);

        try {
            let state = payload.toLowerCase() === 'on';

            if (state && this.#service.getState()) {
                await this.#service.setState(false);
            }

            await this.#service.setFanState(state);
        }
        catch(error) {
            this.log.error(error);
        }
    }

    async setControlMode(topic, payload) {
        this.log.debug(this.constructor.name, 'setControlMode', topic, payload);

        try {
            let parts = topic.split('/');
            let zone = parts.length === 3
                ? 'U'
                : parts[2].toUpperCase();

            let state = payload.toLowerCase() === 'on'
                ? this.#service.ControlModes.MANUAL
                : this.#service.ControlModes.SCHEDULE;

            this.#service.setControlMode(state, zone);
        }
        catch(error) {
            this.log.error(error);
        }
    }
}

module.exports = HomeAssistantClient;