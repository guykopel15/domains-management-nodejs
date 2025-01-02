const mqtt = require('mqtt');
const readline = require('readline');
const { LOCAL_BROKER_URL, RED_ALERT_NOTIFY_TOPIC } = require('./CONSTS');

// Connect to MQTT broker
const mqtt_client = mqtt.connect(LOCAL_BROKER_URL);

// Set up readline for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Press Enter to inject a red alert...\n'
});

mqtt_client.on('connect', () => {
    console.log(`Connected to MQTT broker: ${LOCAL_BROKER_URL}`);
    rl.prompt();
});

rl.on('line', () => {
    // Example red alert message
    const demo_red_alert_message = {
        "alert": { 
            "id": "133437352440000000", 
            "cat": "1", 
            "title": "ירי רקטות וטילים", 
            "data": ["שדרות"], 
            "desc": "היכנסו למרחב המוגן ושהו בו 10 דקות"
        }, 
        "length": 198, 
        "message_ID": "133437352440000000"
    };

    const message = JSON.stringify(demo_red_alert_message);

    mqtt_client.publish(RED_ALERT_NOTIFY_TOPIC, message, err => {
        if (err) {
            console.error('Failed to inject red alert:', err);
        } else {
            console.log(`Red alert injected to topic "${RED_ALERT_NOTIFY_TOPIC}":`, message);
        }
    });

    rl.prompt();
});

mqtt_client.on('error', err => {
    console.error('MQTT Error:', err);
});
