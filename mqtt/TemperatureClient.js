const ClientBase = require('./ClientBase');

class TemperatureClient extends ClientBase {
    #service;

    constructor(log, settings, service) {
        super(log, settings);
        this.log.debug(this.constructor.name, undefined, 'log', 'settings', 'service');

        this.#service = service;
    }

    get subscriptionTopics() {
        let topics = [...new Set(Object.values(this.settings.subscribeTemperature))];
        return topics;
    }

    async subscribe(topic) {
        this.log.debug('ClientBase', 'subscribe', topic);

        try {
            this.log.info(`Subscribe: ${topic}`);
            await this.client.subscribe(topic);
        }
        catch(error) {
            this.log.error(error);
        }
    }

    process(topic, payload) {
        this.log.debug(this.constructor.name, 'process', topic, payload);

        try {
            for(let zone in this.settings.subscribeTemperature) {
                if (this.settings.subscribeTemperature[zone] === topic) {
                    this.#service.setCurrentTemperatureOverride(parseFloat(payload), zone);
                }
            }
        }
        catch(error) {
            this.log.error(error);
        }
    }
}

module.exports = TemperatureClient;