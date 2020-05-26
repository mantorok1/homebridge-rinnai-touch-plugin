const mqtt = require("async-mqtt");
const NativePayload = require('./NativePayload');
const SimplePayload = require('./SimplePayload');

class Client {
    #log;
    #settings;
    #payload;

    constructor(platform) {
        this.#log = platform.log;
        this.#log.debug(this.constructor.name, undefined, 'platform');

        if (platform.settings.mqtt.host === undefined) {
            this.#log.info('No MQTT broker defined');
            return;
        }

        this.#settings = platform.settings;
        this.#payload = this.#settings.mqtt.nativePayloads
            ? new NativePayload(platform)
            : new SimplePayload(platform);

        this.init();
    }

    async init() {
        this.#log.debug(this.constructor.name, 'connect');

        const client = await this.connect();

        // Publish
        if (this.#settings.mqtt.publishFrequency === 0) {
            this.#log.info(`MQTT Publish: Off`)
        } else {
            this.#log.info(`MQTT Publish: On`)
            setInterval(async() => {
                const payload = await this.#payload.getStatus();
                await client.publish(this.#settings.mqtt.publishTopic, payload);
                this.#log.info(`Published: ${this.#settings.mqtt.publishTopic}, Payload: ${payload}`);
    
            }, this.#settings.mqtt.publishFrequency * 1000);
        }

        // Subscribe
        await client.subscribe(this.#settings.mqtt.subscribeTopic);
        client.on('message', (topic, payload) => {
            if (topic === this.#settings.mqtt.subscribeTopic) {
                this.#payload.processCommand(payload);
            }
        });
    }

    async connect() {
        this.#log.debug(this.constructor.name, 'connect');

        try {
            const url = `${this.#settings.mqtt.host}:${this.#settings.mqtt.port}`;
            const options = {
                username: this.#settings.mqtt.username,
                password: this.#settings.mqtt.password
            };

            const client = await mqtt.connectAsync(url, options);
            this.#log.info(`Connected to MQTT broker at ${url}`);

            return client;
        }
        catch(error) {
            this.#log.error(error);
        }
    }
}

module.exports = Client;