const BROKER_URL = 'mqtt://localhost:1883';
const HEARTBEAT_TOPIC = 'internal-general-heartbeat';
const RED_ALERT_NOTIFY_TOPIC = 'red-alert-notify';
const OPEN_SAFEHOUSE_TOPIC = 'lock_open';
const GENERAL_LOCK_ACKNOWLEDGE_TOPIC = 'internal-lock-acknowledge';

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
    OPEN_ALL_SAFEHOUSES_TOPIC: OPEN_SAFEHOUSE_TOPIC,
    GENERAL_LOCK_ACKNOWLEDGE_TOPIC,
};
