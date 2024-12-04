const MqttClient_Obj = require('./mqtt_client');
const { MYSQL_SERVERS, HEARTBEAT_TOPIC } = require('./CONSTS');
const emitter = require('./event_bus');

var _units_array = [];

async function main() {
    console.log('Starting main function...');
    initialize_mqtt_clients();
    setup_message_listener();
    start_returning_messages();
}

function initialize_mqtt_clients() {
    MYSQL_SERVERS.forEach((server) => {
        const mqtt_client_obj = new MqttClient_Obj(
            server.name,
            `mqtt://${server.host}`,
            1883,
            [HEARTBEAT_TOPIC]
        );
    });
}

function setup_message_listener() {
    emitter.on('mqtt_message_received', (topic, message, domain_name) => {
        if (topic === HEARTBEAT_TOPIC) {
            _units_array.push({
                domain_name,
                topic,
                message: message.toString(),
                timestamp: new Date(),
            });
        }
    });
}

function start_returning_messages() {
    setInterval(() => {
        console.log('Returning heartbeat messages...');
        console.log(_units_array);
    }, 5000);
}

main().catch((error) => {
    console.error('Error in main function:', error);
});
