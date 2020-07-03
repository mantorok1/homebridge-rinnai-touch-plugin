const ClientBase = require('./ClientBase');

class NativeClient extends ClientBase {
    #repository;

    constructor(log, settings, repository) {
        super(log, settings);
        this.log.debug(this.constructor.name, undefined, 'log', 'settings', 'repository');

        this.#repository = repository;
    }

    get subscriptionTopics() {
        return ['native/set'];
    }

    setPublications() {
        this.log.debug(this.constructor.name, 'setPublications');

        // Publish at intervals
        if (this.settings.publishIntervals) {
            setInterval(async () => {
                this.log.info('MQTT Publish Event: Scheduled Interval (native)');
                let status = await this.#repository.execute({type: 'get'});
                this.publish('native/get', JSON.stringify(status)); 
            }, this.settings.publishFrequency * 1000);
        }

        // Publish on status change
        if (this.settings.publishStatusChanged) {
            this.#repository.on('status', (status) => {
                this.log.info('MQTT Publish Event: Status Changed (native)');
                this.publish('native/get', status);
            });
        }
    }

    async initialPublish() {
        this.log.debug(this.constructor.name, 'initialPublish');

        this.log.info('MQTT Publish Event: Initial (native)');
        let status = await this.#repository.execute({type: 'get'});
        this.publish('native/get', JSON.stringify(status)); 
    }

    process(topic, payload) {
        this.log.debug(this.constructor.name, 'process', topic, payload);

        try {
            var request = {
                type: 'send',
                command: payload
            };

            this.#repository.execute(request);
        }
        catch(error) {
            this.log.error(error);
        }
    }
}

module.exports = NativeClient;