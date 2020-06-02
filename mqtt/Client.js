const mqtt = require("async-mqtt");
const NativeFormat = require('./NativeFormat');
const HomeAssistantFormat = require('./HomeAssistantFormat');

class Client {
    #log;
    #settings;
    #topicPrefix = '';
    #formats = [];

    constructor(platform) {
        this.#log = platform.log;
        this.#log.debug(this.constructor.name, undefined, 'platform');

        if (platform.settings.mqtt.host === undefined) {
            this.#log.info('No MQTT broker defined');
            return;
        }

        this.#settings = platform.settings;

        if (this.#settings.mqtt.topicPrefix) {
            this.#topicPrefix = `${this.#settings.mqtt.topicPrefix}/`;
        }

        this.#log.info(this.#settings.mqtt.formatNative);
        this.#log.info(this.#settings.mqtt.formatHomeAssistant);

        if (this.#settings.mqtt.formatNative) {
            this.#formats.push(new NativeFormat(platform));
        }
        if (this.#settings.mqtt.formatHomeAssistant) {
            this.#formats.push(new HomeAssistantFormat(platform));
        }

        this.init();
    }

    async init() {
        try {
            this.#log.debug(this.constructor.name, 'init');

            const client = await this.connect();
    
            // Publish at intervals
            if (this.#settings.mqtt.publishIntervals) {
                setInterval(async() => {
                    this.publish(client);
                }, this.#settings.mqtt.publishFrequency * 1000);
            }

            // Subscribe
            for(let i in this.#formats) {
                const topics = this.#formats[i].subscriptionTopics;
                for(let j in topics) {
                    let topic = `${this.#topicPrefix}${topics[j]}`;
                    this.#log.info(`Subscribe: ${topic}`);
                    await client.subscribe(topic);
                }               
            }

            client.on('message', (topic, payload) => {
                this.#log.info(`Received: ${topic}, Payload: ${payload}`);
                topic = topic.replace(this.#topicPrefix, '');
                
                for(let i in this.#formats) {
                    const topics = this.#formats[i].subscriptionTopics;

                    if (topics.includes(topic)) {
                        this.#formats[i].processCommandMessage(topic, payload.toString());

                        if (this.#settings.mqtt.publishCommandProcessed) {
                            this.publish(client);
                        } 
                    }
                }
            });
        }
        catch(error) {
            this.#log.error(error);
        }
    }

    async publish(client) {
        this.#log.debug(this.constructor.name, 'publish', 'client');

        try {
            for(let i in this.#formats) {
                const messages = await this.#formats[i].getStatusMessages();
                for(let i in messages) {
                    let topic = `${this.#topicPrefix}${messages[i].topic}`;
                    this.#log.info(`Publish: ${topic}, Payload: ${messages[i].payload}`);
                    await client.publish(topic, messages[i].payload);
                }
            }
        }
        catch(error) {
            this.#log.error(error);
        }
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