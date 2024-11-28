const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { MongoClient } = require('mongodb');

const {
    MONGO_DB_URL,
    MONGO_DB_TELEGRAM_USERS_DATABASE,
    MONGO_DB_TELEGRAM_USERS_COLLECTION_NAME
} = require('../CONSTS');


const TELEGRAM_BOT_TOKEN = '7827859045:AAE1qo4WrbD0qytLDAuzU8PtPGlNc_FDLWw';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function connect_to_mongodb() {
    const client = new MongoClient(MONGO_DB_URL);
    await client.connect();
    const db = client.db(MONGO_DB_TELEGRAM_USERS_DATABASE);
    const collection = db.collection(MONGO_DB_TELEGRAM_USERS_COLLECTION_NAME);
    return { client, collection };
}

async function save_user_chat_id(chat_id, username) {
    const { client, collection } = await connect_to_mongodb();
    const existing_chat = await collection.findOne({ chat_id });
    if (!existing_chat) {
        await collection.insertOne({ chat_id, username });
        console.log(`Saved chat ID ${chat_id} for user ${username}`);
    }
}

async function get_all_users_chat_ids() {
    const { client, collection } = await connect_to_mongodb();
    const chat_ids = await collection.find({}).toArray();
    return chat_ids.map(doc => doc.chat_id);
}

async function send_text_message(chat_id, message) {
    const url = `${TELEGRAM_API_URL}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id, text: message }),
        });

        const data = await response.json();

        if (!data.ok) {
            console.error(`Failed to send text message to chat ID ${chat_id}:`, data.description);
        } else {
            console.log(`Text message sent successfully to chat ID ${chat_id}!`);
        }
    } catch (error) {
        console.error(`Error sending text message to chat ID ${chat_id}:`, error.message);
    }
}

async function send_document(chat_id, file_path) {
    const url = `${TELEGRAM_API_URL}/sendDocument`;
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
            console.error(`Failed to send file to chat ID ${chat_id}:`, data.description);
        } else {
            console.log(`File sent successfully to chat ID ${chat_id}!`);
        }
    } catch (error) {
        console.error(`Error sending file to chat ID ${chat_id}:`, error.message);
    }
}

async function notify_all_connected_users(message, file_path = null) {
    const chat_ids = await get_all_users_chat_ids();

    if (chat_ids.length === 0) {
        console.log("No chat IDs available to send notifications.");
        return;
    }

    const split_message_into_chunks = (msg, chunk_size = 4000) => {
        const chunks = [];
        while (msg.length > 0) {
            chunks.push(msg.substring(0, chunk_size));
            msg = msg.substring(chunk_size);
        }
        return chunks;
    };

    const message_chunks = split_message_into_chunks(message);

    for (const chat_id of chat_ids) {
        for (const chunk of message_chunks) {
            await send_text_message(chat_id, chunk);
        }

        if (file_path) {
            await send_document(chat_id, file_path);
        }
    }
}

async function get_updates_from_telegram() {
    const url = `${TELEGRAM_API_URL}/getUpdates`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.ok) {
            console.error("Failed to get updates from Telegram:", data.description);
            return;
        }

        let last_update_id = 0;
        for (const update of data.result) {
            const chat_id = update.message?.chat?.id;
            const username = update.message?.from?.username || update.message?.from?.first_name || "Unknown";

            console.log(`Message from ${username} (Chat ID: ${chat_id}): ${update.message.text || "[Non-text message]"}`);

            await save_user_chat_id(chat_id, username);
            last_update_id = update.update_id;
        }

        if (last_update_id > 0) {
            await fetch(`${TELEGRAM_API_URL}/getUpdates?offset=${last_update_id + 1}`);
        }
    } catch (error) {
        console.error("Error getting updates from Telegram:", error.message);
    }
}

async function main() {
    console.log("Starting Telegram bot...");
    const users_chat_ids = await get_all_users_chat_ids();
    console.log(`Found ${users_chat_ids.length} chat IDs in the database.`);
    users_chat_ids.forEach(chat_id => console.log(`Chat ID: ${chat_id}`));

    setInterval(() => {
        get_updates_from_telegram();
    }, 5000);
}

main()

module.exports = {
    notify_all_connected_users
};
