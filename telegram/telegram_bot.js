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

// MongoDB Connection Helper
async function connect_to_mongodb() {
    const client = new MongoClient(MONGO_DB_URL);
    await client.connect();
    const db = client.db(MONGO_DB_TELEGRAM_USERS_DATABASE);
    const collection = db.collection(MONGO_DB_TELEGRAM_USERS_COLLECTION_NAME);
    return { client, collection };
}

// Save Chat ID to MongoDB
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

function get_current_time_plus_offset(hours = 2) {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toLocaleString('en-IL', { hour12: false });
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

// Notify All Users with a Message and File
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

// Format Units Message Text
function units_text_format(red_alert_poligon_arr, poligon_unit_array, unopened_units) {
    const current_time = get_current_time_plus_offset();

    let file_content = `\u200Fצבע אדום בשעה ${current_time} באזורים: ${red_alert_poligon_arr.join(', ')}\n\n`;
    file_content += `\u200Fהיחידות הפעילות שלא נפתחו באזורים:\n\n`;

    for (const unit of unopened_units) {
        file_content += `\u200F${unit.local},  ${unit.device_serial.slice(-4)},  ${unit.address},  ${unit.domain}\n`;
    }

    file_content += `\n\u200Fכמות היחידות שלא נפתחו: ${unopened_units.length} מתוך ${poligon_unit_array.length}.\n`;
    file_content += `\u200Fתאריך ושעה: ${current_time}\n`;

    return file_content;
}

// Save Unopened Units to File and Notify Users
function save_closed_units_to_file(domain_objs, poligon_unit_array, red_alert_poligon_arr) {
    const unopened_units = [];

    for (const unit of poligon_unit_array) {
        const domain_obj = domain_objs[unit.domain];
        const unit_in_domain = domain_obj && domain_obj.units[unit.device_serial];
        if (unit_in_domain && !unit_in_domain.is_open) {
            unopened_units.push({
                device_serial: unit_in_domain.device_serial,
                address: unit_in_domain.unit_address || "-",
                unique_id: unit_in_domain.unique_id,
                local: unit_in_domain.unit_local_id || "-",
                domain: unit_in_domain.domain,
            });
        }
    }

    const file_content = units_text_format(red_alert_poligon_arr, poligon_unit_array, unopened_units);

    const file_path = './closed_units.txt';
    fs.writeFileSync(file_path, file_content, 'utf8');

    notify_all_connected_users(file_content, file_path);
}

// Process Updates from Telegram and Save Chat IDs
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

// Main Function
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
    save_closed_units_to_file
};
