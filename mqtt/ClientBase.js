const mqtt = require("async-mqtt");

class ClientBase {
    #topicPrefix = '';
    #client;
    #payloads = {};

    constructor(log, settings) {
        this.log = log;
        this.log.debug('ClientBase', undefined, 'log', 'settings');

        if (settings.host === undefined) {
            this.log.info('No MQTT broker defined');
            return;
        }

        this.settings = settings;

        if (this.settings.topicPrefix) {
            this.#topicPrefix = `${this.settings.topicPrefix}/`;
        }

        this.init();
    }

    get client() {
        return this.#client;
    }

    async init() {
        try {
            this.log.debug('ClientBase', 'init');

            await this.connect();

            for(let topic of this.subscriptionTopics) {
                await this.subscribe(topic);
            }

            this.#client.on('message', (topic, payload) => {
                this.log.info(`Received: ${topic}, Payload: ${payload}`);
                topic = topic.replace(this.#topicPrefix, '');
                
                if (this.subscriptionTopics.includes(topic)) {
                    this.process(topic, payload.toString());
                }
            });
        }
        catch(error) {
            this.log.error(error);
        }
    }

    async subscribe(topic) {
        this.log.debug('ClientBase', 'subscribe', topic);

        try {
            topic = `${this.#topicPrefix}${topic}`;
            this.log.info(`Subscribe: ${topic}`);
            await this.#client.subscribe(topic);
        }
        catch(error) {
            this.log.error(error);
        }
    }

    async publish(topic, payload) {
        this.log.debug('ClientBase', 'publish', topic, JSON.stringify(payload));

        try {
            if (payload === undefined) {
                return;
            }
            if (typeof payload === 'object') {
                if (Object.keys(payload).length === 0) {
                    return;
                }
                payload = JSON.stringify(payload);
            } else {
                payload = payload.toString();
            }
            if (this.#payloads[topic] === payload) {
                return;
            }
            this.#payloads[topic] = payload;

            topic = `${this.#topicPrefix}${topic}`;
            this.log.info(`Publish: ${topic}, Payload: ${payload}`);
            await this.#client.publish(topic, payload, {retain: true});
        }
        catch(error) {
            this.log.error(error);
        }
    }

    async connect() {
        this.log.debug('ClientBase', 'connect');

        try {
            const url = `${this.settings.host}:${this.settings.port}`;
            const options = {
                username: this.settings.username,
                password: this.settings.password
            };

            this.#client = await mqtt.connectAsync(url, options);
            this.log.info(`Connected to MQTT broker at ${url}`);
        }
        catch(error) {
            this.log.error(error);
        }
    }
}

module.exports = ClientBase;