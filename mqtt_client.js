const mqtt = require('mqtt');
const emitter = require('./event_bus');

class MqttClient_Obj {
    #_mqtt_client = null;
    mqtt_broker_url = "";
    domain_name = "";

    constructor(domain_name, mqtt_broker_url, port, subscription_topics = []) {
        this.domain_name = domain_name;
        this.mqtt_broker_url = mqtt_broker_url;
        this.#setup_mqtt_listener(mqtt_broker_url, port, subscription_topics);
    }
 
    #setup_mqtt_listener(mqtt_broker_url, port, subscription_topics) {
        this.#_mqtt_client = mqtt.connect(`${mqtt_broker_url}:${port}`);
        this.#_mqtt_client.on('connect', () => this.#subscribe_after_connect(this.#_mqtt_client, subscription_topics));
        this.#_mqtt_client.on('message', (topic, message) => this.#handle_mqtt_message(topic, message));
        this.#_mqtt_client.on('error', this.handle_mqtt_error);
    }

    #subscribe_after_connect(mqtt_client, subscription_topics) {
        console.log(`Connected to MQTT broker at ${this.domain_name}`);
        for (const topic of subscription_topics) {
            mqtt_client.subscribe(topic, (err) => {
                if (err) console.log(`Failed to subscribe to topic "${topic}":`, err);
                else console.log(`Subscribed to topic "${topic}"`);
            });
        }
    }

    publish_mqtt_message(topic, message) {
        this.#_mqtt_client.publish(topic, message, (err) => {
            if (err) console.error(`Failed to publish message to topic "${topic}":`, err);
            else console.log(`Message published to "${topic}":`, message);
        });
    }

    #handle_mqtt_message(topic, message) {
        emitter.emit('mqtt_message_received', topic, message, this.domain_name);
    }

    handle_mqtt_error(error) {
        console.error('Error in MQTT connection:', error);
    }
}

module.exports = MqttClient_Obj;
