const BROKER_URL = 'mqtt://localhost:1883';
const HEARTBEAT_TOPIC = 'general-heartbeat';
const RED_ALERT_NOTIFY_TOPIC = 'red-alert-notify';

const MONGO_DB_URL = 'mongodb://localhost:27017';
const MONGO_DB_DATABASE = 'unit_management';
const MONGO_UNIT_COLLECTION_NAME = 'units';

// Export all constants as a single object
module.exports = {
    BROKER_URL,
    HEARTBEAT_TOPIC,
    MONGO_DB_URL,
    MONGO_DB_DATABASE,
    MONGO_UNIT_COLLECTION_NAME,  
    RED_ALERT_NOTIFY_TOPIC,
};
