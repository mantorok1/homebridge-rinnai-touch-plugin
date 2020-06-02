class Settings {
    #settings;

    constructor(config) {
        this.setConfigSettings(config);
    }

    setConfigSettings(config) {
        config = config ? config : {};

        this.#settings = {
            name: config.name || 'Rinnai Touch',
            useThermostat: (config.serviceType || 'thermostat') === 'thermostat',
            controllers: config.controllers,

            showZoneSwitches: config.showZoneSwitches,
            showFan: config.showFan === undefined ? true : config.showFan,
            showAuto: config.showAuto,
            showAdvanceSwitches: config.showAdvanceSwitches,
            showManualSwitches: config.showManualSwitches,
            
            closeConnectionDelay: config.closeConnectionDelay === undefined
                ? 1100
                : config.closeConnectionDelay,
            clearCache: config.clearCache === undefined ? false : config.clearCache,
            debug: config.debug === undefined ? false : config.debug,

            mqtt: this.getMqttSettings(config.mqtt),

            mapOverrides: config.maps || {}
        };
    }

    setStatusSettings(status) {
        const path = {
            HasHeater: 'SYST.AVM.HG',
            HasCooler: 'SYST.AVM.CG',
            HasEvap: 'SYST.AVM.EC',
            HasMultipleControllers: 'SYST.CFG.MTSP'
        };

        this.#settings.hasHeater = status.getState(path.HasHeater) === 'Y';
        this.#settings.hasCooler = status.getState(path.HasCooler) === 'Y';
        this.#settings.hasEvap = status.getState(path.HasEvap) === 'Y';
        const hasMultipleControllers = status.getState(path.HasMultipleControllers) === 'Y';
        
        const zones = status.getZones();
        if (this.#settings.controllers === undefined) {
            this.#settings.controllers = hasMultipleControllers ? zones.length : 1;
        } else {
            if (this.#settings.controllers > 1 && this.#settings.controllers !== zones.length) {
                // this.#log(`WARNING: Controllers specifed does not match number of zones. Setting controllers to ${zones.length}`);
                this.#settings.controllers = zones.length;
            }
        }
    }

    getMqttSettings(config) {
        let mqtt = {};

        if (config && config.host) {
            mqtt = {
                host: config.host,
                port: config.port === undefined ? 1883 : config.port,
                username: config.username,
                password: config.password,
                topicPrefix: config.topicPrefix,
                formatNative: config.formatNative || false,
                formatHomeAssistant: config.formatHomeAssistant || false,
                publishCommandProcessed: config.publishCommandProcessed || false,
                publishStatusChanged: config.publishStatusChanged || false,
                publishIntervals: config.publishIntervals || false,
                publishFrequency: config.publishFrequency === undefined ? 60 : config.publishFrequency
            }
        }

        return mqtt;
    }

    // Getters
    get name() {
        return this.#settings.name;
    }

    get useThermostat() {
        return this.#settings.useThermostat;
    }

    get controllers() {
        return this.#settings.controllers === undefined
            ? 1
            : this.#settings.controllers;
    }

    get showZoneSwitches() {
        return this.#settings.showZoneSwitches === undefined
            ? this.controllers === 1
            : this.#settings.showZoneSwitches;
    }

    get showFan() {
        return this.#settings.showFan;
    }

    get showAuto() {
        return this.#settings.showAuto === undefined
            ? this.controllers === 1 
            : this.#settings.showAuto;
    }

    get showAdvanceSwitches() {
        return this.#settings.showAdvanceSwitches === undefined
        ? this.controllers === 1
        : this.#settings.showAdvanceSwitches;
    }

    get showManualSwitches() {
        return this.#settings.showManualSwitches === undefined
        ? this.controllers === 1 
        : this.#settings.showManualSwitches;
    }

    get closeConnectionDelay() {
        return this.#settings.closeConnectionDelay;
    }

    get clearCache() {
        return this.#settings.clearCache;
    }

    get debug() {
        return this.#settings.debug;
    }

    get mapOverrides() {
        return this.#settings.mapOverrides;
    }

    get hasHeater() {
        return this.#settings.hasHeater;
    }

    get hasCooler() {
        return this.#settings.hasCooler;
    }

    get hasEvap() {
        return this.#settings.hasEvap;
    }

    get mqtt() {
        return this.#settings.mqtt;
    }

    toString() {
        return JSON.stringify(this.#settings);
    }
}

module.exports = Settings;