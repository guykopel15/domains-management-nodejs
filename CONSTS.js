
const LOCAL_BROKER_URL = 'mqtt://127.0.0.1';
const BOBO1_DOMAIN_NAME = 'bobo';
const HEARTBEAT_TOPIC = 'internal-general-heartbeat';
const RED_ALERT_NOTIFY_TOPIC = 'red-alert-notify';
const OPEN_SAFEHOUSE_TOPIC = 'lock-open';
const GENERAL_LOCK_ACKNOWLEDGE_TOPIC = 'internal-lock-acknowledge';

const LOCAL_SUBSCRIPTION_TOPICS = [
    HEARTBEAT_TOPIC,
    RED_ALERT_NOTIFY_TOPIC,
    OPEN_SAFEHOUSE_TOPIC,
    GENERAL_LOCK_ACKNOWLEDGE_TOPIC,
];

const MONGO_DB_URL = 'mongodb://localhost:27017';
const MONGO_DB_DATABASE = 'unit_management';
const MONGO_DB_TELEGRAM_USERS_DATABASE= "telegram_users";
const MONGO_DB_TELEGRAM_USERS_COLLECTION_NAME = 'chat_ids';
const MONGO_UNIT_COLLECTION_NAME = 'units';

const MYSQL_SERVERS = [
    { name: 'bobo', host: '34.0.38.195', url: 'bobo.admin.netiotil.com' },
    { name: 'bobo2', host: '34.0.86.50', url: 'bobo2.admin.netiotil.com' },
    { name: 'bobo3', host: '34.0.81.173', url: 'bobo3.admin.netiotil.com' },
    { name: 'haifa', host: '34.0.67.198', url: 'haifa.admin.netiotil.com' },
    { name: 'RM', host: '34.0.64.99', url: 'rm.admin.netiotil.com' },
    { name: 'bat-yam', host: '34.0.66.222', url: 'bat-yam.admin.netiotil.com' },
    { name: 'rotem', host: '34.0.64.86', url: 'rotem.admin.netiotil.com' },
    { name: 'omer', host: '34.0.65.119', url: 'omer.admin.netiotil.com' },
    { name: 'periclass', host: '34.0.68.29', url: 'periclass.admin.netiotil.com' },
    { name: 'sderot', host: '34.0.71.210', url: 'sderot.admin.netiotil.com' },
    { name: 'kyair', host: '34.0.71.199', url: 'kyair.admin.netiotil.com' },
    { name: 'kiryat-yam', host: '34.0.78.144', url: 'kiryat-yam.admin.netiotil.com' },
    { name: 'netivot', host: '34.165.229.167', url: 'netivot.admin.netiotil.com' },
    { name: 'rshva', host: '34.0.85.25', url: 'rshva.admin.netiotil.com' },
    { name: 'eilat', host: '34.0.67.230', url: 'eilat.admin.netiotil.com' },
    { name: 'clalit', host: '34.0.66.228', url: 'clalit.admin.netiotil.com' },
    { name: 'lod', host: '34.0.65.91', url: 'lod.admin.netiotil.com' },
    { name: 'redport', host: '34.0.70.52', url: 'redport.admin.netiotil.com' }
];



module.exports = {
    HEARTBEAT_TOPIC,
    MONGO_DB_URL,
    MONGO_DB_DATABASE,
    MONGO_UNIT_COLLECTION_NAME,  
    RED_ALERT_NOTIFY_TOPIC,
    OPEN_SAFEHOUSE_TOPIC,
    GENERAL_LOCK_ACKNOWLEDGE_TOPIC,
    LOCAL_BROKER_URL,
    LOCAL_SUBSCRIPTION_TOPICS,
    MONGO_DB_TELEGRAM_USERS_DATABASE,
    MONGO_DB_TELEGRAM_USERS_COLLECTION_NAME,
    BOBO1_DOMAIN_NAME,
    MYSQL_SERVERS
};
