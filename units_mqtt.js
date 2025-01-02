const mqtt = require('mqtt');
const eventBus = require('./eventBus');
const { MYSQL_SERVERS } = require('./CONSTS');

// Initialize and connect MQTT clients for each server
function initialize_mqtt_clients() {
    MYSQL_SERVERS.forEach((server) => {
        const mqtt_client = mqtt.connect(`mqtt://${server.host}`);

        mqtt_client.on('connect', () => {
            console.log(`Connected to MQTT broker for domain: ${server.name}`);
            mqtt_client.subscribe('#', (err) => {
                if (err) {
                    console.error(`Error subscribing to all topics for domain ${server.name}:`, err);
                } else {
                    console.log(`Subscribed to all topics for domain: ${server.name}`);
                }
            });
        });

        mqtt_client.on('message', (topic, message) => {
            const data = {
                domain_name: server.name,
                topic,
                message: message.toString(),
                timestamp: new Date(),
            };

            // Emit an event for the topic
            eventBus.emit(topic, data);

            // Emit a generic event for all messages
            eventBus.emit('mqtt_message_received', data);

            console.log(`Message received on topic "${topic}" from domain "${server.name}":`, data.message);
        });

        mqtt_client.on('error', (err) => {
            console.error(`Error in MQTT client for domain ${server.name}:`, err);
        });

        mqtt_client.on('close', () => {
            console.log(`MQTT connection closed for domain: ${server.name}`);
        });
    });
}

module.exports = { initialize_mqtt_clients };
