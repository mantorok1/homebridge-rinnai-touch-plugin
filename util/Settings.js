class Settings {
    #settings;

    constructor(config) {
        this.setConfigSettings(config);
    }

    setConfigSettings(config) {
        config = config ? config : {};

        this.#settings = {
            name: config.name || 'Rinnai Touch',
            address: config.address,
            port: config.port,

            useHeaterCooler: config.useHeaterCooler === undefined
                ? false
                : config.useHeaterCooler,
            showZoneSwitches: config.showZoneSwitches,
            showFan: config.showFan === undefined ? true : config.showFan,
            showAuto: config.showAuto,
            showAdvanceSwitches: config.showAdvanceSwitches,
            showManualSwitches: config.showManualSwitches,
            
            closeConnectionDelay: config.closeConnectionDelay === undefined
                ? 1100
                : Math.min(config.closeConnectionDelay, 10000),
            connectionTimeout: config.connectionTimeout === undefined
                ? 5000
                : Math.min(config.connectionTimeout, 300000),
            clearCache: config.clearCache === undefined ? false : config.clearCache,
            debug: config.debug === undefined ? false : config.debug,

            mqtt: this.getMqttSettings(config.mqtt),

            mapOverrides: config.maps || {}
        };
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

    get address() {
        return this.#settings.address;
    }

    get port() {
        return this.#settings.port;
    }

    get useHeaterCooler() {
        return this.#settings.useHeaterCooler;
    }

    get showZoneSwitches() {
        return this.#settings.showZoneSwitches === undefined
            ? true
            : this.#settings.showZoneSwitches;
    }

    get showFan() {
        return this.#settings.showFan;
    }

    get showAuto() {
        return this.#settings.showAuto === undefined
            ? true 
            : this.#settings.showAuto;
    }

    get showAdvanceSwitches() {
        return this.#settings.showAdvanceSwitches === undefined
        ? true
        : this.#settings.showAdvanceSwitches;
    }

    get showManualSwitches() {
        return this.#settings.showManualSwitches === undefined
        ? true
        : this.#settings.showManualSwitches;
    }

    get closeConnectionDelay() {
        return this.#settings.closeConnectionDelay;
    }

    get connectionTimeout() {
        return this.#settings.connectionTimeout;
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

    get mqtt() {
        return this.#settings.mqtt;
    }

    toString() {
        return JSON.stringify(this.#settings);
    }
}

module.exports = Settings;