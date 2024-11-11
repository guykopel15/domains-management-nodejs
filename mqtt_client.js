const { 
    BROKER_URL,
    HEARTBEAT_TOPIC,
    RED_ALERT_NOTIFY_TOPIC,
    GENERAL_LOCK_ACKNOWLEDGE_TOPIC,
 } = require('./CONSTS');

const emitter = require('./event_bus');
const mqtt = require('mqtt');

function setup_mqtt_listener() {
    const mqtt_client = mqtt.connect(BROKER_URL);
    mqtt_client.on('connect', () => handle_mqtt_connect(mqtt_client));
    mqtt_client.on('message', (topic, message) => handle_mqtt_message(topic, message));
    mqtt_client.on('error', handle_mqtt_error);
};

function handle_mqtt_connect(mqtt_client) {
    mqtt_client.subscribe(HEARTBEAT_TOPIC, (err) => {
        if (err) {
            console.log(`Failed to subscribe to topic "${HEARTBEAT_TOPIC}":`, err);
        } else {
            console.log(`Subscribed to topic "${HEARTBEAT_TOPIC}"`);
        }
    });

    mqtt_client.subscribe(RED_ALERT_NOTIFY_TOPIC, (err) => {
        if (err) {
            console.log(`Failed to subscribe to topic "${RED_ALERT_NOTIFY_TOPIC}":`, err);
        } else {
            console.log(`Subscribed to topic "${RED_ALERT_NOTIFY_TOPIC}"`);
        }
    });

    mqtt_client.subscribe(GENERAL_LOCK_ACKNOWLEDGE_TOPIC, (err) => {
        if (err) {
            console.log(`Failed to subscribe to topic "${GENERAL_LOCK_ACKNOWLEDGE_TOPIC}":`, err);
        } else {
            console.log(`Subscribed to topic "${GENERAL_LOCK_ACKNOWLEDGE_TOPIC}"`);
        }
    });
}

function publish_mqtt_message(topic, message) {
    const mqtt_client = mqtt.connect(BROKER_URL);
    mqtt_client.publish(topic, message, (err) => {
        if (err) {
            console.error(`Failed to publish message to topic "${topic}":`, err);
        } else {
            console.log(`Message published to "${topic}":`, message);
        }
    });
}


function handle_mqtt_message(topic, message) {    
    emitter.emit('mqtt_message_received', topic, message);
}

function handle_mqtt_error(error) {
    console.error('Error in MQTT connection:', error);
}

module.exports = {
    setup_mqtt_listener,
    publish_mqtt_message
};
