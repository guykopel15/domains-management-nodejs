const fetch = require('node-fetch');
const FormData = require('form-data');
const { MongoClient } = require('mongodb');
const fs = require('fs');

const {
    MONGO_DB_URL,
    MONGO_DB_BOTS_DATABASE,
    MONGO_DB_BOTS_COLLECTION_NAME,
    MONGO_DB_TELEGRAM_USERS_DATABASE,
    MONGO_DB_TELEGRAM_USERS_COLLECTION_NAME
} = require('../CONSTS');

// Connect to MongoDB
async function connect_to_mongodb(databaseName, collectionName) {
    const client = new MongoClient(MONGO_DB_URL);
    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection(collectionName);
    return { client, collection };
}

// Fetch bots from MongoDB collection
async function fetch_bots_from_collection() {
    const { client, collection } = await connect_to_mongodb(MONGO_DB_BOTS_DATABASE, MONGO_DB_BOTS_COLLECTION_NAME);
    return await collection.find({}).toArray();
}

// Send a text message
async function send_text_message(bot_api_url, chat_id, message) {
    const url = `${bot_api_url}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: message }),
    });

    const data = await response.json();

    if (!data.ok) {
        // console.error(`Failed to send text message to chat ID ${chat_id}:`, data.description);
    }
}


// Send a document
async function send_document(bot_api_url, chat_id, file_path) {
    const url = `${bot_api_url}/sendDocument`;
    const file_data = new FormData();
    file_data.append('chat_id', chat_id);
    file_data.append('document', fs.createReadStream(file_path));

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: file_data,
        });

        const data = await response.json();

        if (!data.ok) {
            // console.error(`Failed to send file to chat ID ${chat_id}:`, data.description);
        }
    } catch (error) {
        console.error(`Error sending file to chat ID ${chat_id}:`, error.message);
    }
}

// Notify all connected users
async function notify_all_connected_users(message, unit_domain) {
    const bots = await fetch_bots_from_collection();

    // Filter relevant bots by domain
    const relevant_bots = bots.filter(bot =>
        bot.name === 'netiot_bot' || bot.domain === unit_domain
    );

    for (const bot of relevant_bots) {
        const { client, collection } = await connect_to_mongodb(MONGO_DB_TELEGRAM_USERS_DATABASE, MONGO_DB_TELEGRAM_USERS_COLLECTION_NAME);
        const chat_ids = await collection.find({}).toArray();
        await client.close();

        const bot_chat_ids = chat_ids.map(user => user.chat_id);

        // Send messages to all chat IDs for this bot
        for (const chat_id of bot_chat_ids) {
            await send_text_message(bot.api_url, chat_id, message);
        }
    }
}


module.exports = {
    notify_all_connected_users
};
