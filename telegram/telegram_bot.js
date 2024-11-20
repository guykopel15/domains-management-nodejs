const fs = require('fs'); // Import fs module
const fetch = require('node-fetch');
const FormData = require('form-data');

const TELEGRAM_BOT_TOKEN = '7827859045:AAE1qo4WrbD0qytLDAuzU8PtPGlNc_FDLWw';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

var _chat_ids = [];

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
    const data = new FormData();
    data.append('chat_id', chat_id);
    data.append('document', fs.createReadStream(file_path));

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: data,
        });

        const responseData = await response.json();

        if (!responseData.ok) {
            console.error(`Failed to send file to chat ID ${chat_id}:`, responseData.description);
        } else {
            console.log(`File sent successfully to chat ID ${chat_id}!`);
        }
    } catch (error) {
        console.error(`Error sending file to chat ID ${chat_id}:`, error.message);
    }
}

async function notify_all_connected_users(message, file_path = null) {
    if (_chat_ids.length === 0) {
        console.log("No chat IDs available to send notifications.");
        return;
    }

    // Function to split the message into chunks
    const split_message_into_chunks = (msg, chunk_size = 4000) => {
        const chunks = [];
        while (msg.length > 0) {
            chunks.push(msg.substring(0, chunk_size));
            msg = msg.substring(chunk_size);
        }
        return chunks;
    };

    // Split the message into manageable chunks
    const message_chunks = split_message_into_chunks(message);

    for (const { chat_id } of _chat_ids) {
        // Send each chunk of the message
        for (const chunk of message_chunks) {
            await send_text_message(chat_id, chunk);
        }

        // Send the file if provided
        if (file_path) {
            await send_document(chat_id, file_path);
        }
    }
}
function save_closed_units_to_file(domain_objs, poligon_unit_array) {
    const unopened_units = [];
    const unique_areas = new Set();

    for (const unit of poligon_unit_array) {
        const domain_obj = domain_objs[unit.domain];
        const unit_in_domain = domain_obj && domain_obj.units[unit.device_serial];
        if (unit_in_domain && !unit_in_domain.is_open) {
            unopened_units.push({
                device_serial: unit_in_domain.device_serial,
                address: unit_in_domain.unit_address || "-",
                unique_id: unit_in_domain.unique_id,
                unit_polygone: unit_in_domain.saved_location || "-",
                is_open: unit_in_domain.is_open,
                local: unit_in_domain.unit_local_id || "-",
                unit_red_alert_polygons: unit_in_domain.red_alert_polygons || "-",
                domain: unit_in_domain.domain,
            });
        }

        // Add area to the unique set
        if (unit.saved_location) {
            if (Array.isArray(unit.saved_location)) {
                unit.saved_location.forEach(location => unique_areas.add(location));
            } else {
                unique_areas.add(unit.saved_location);
            }
        }
    }

    const file_path = './closed_units.txt'; // Change file extension to .txt

    // Build the file content
    const current_time = get_current_time_plus_offset();
    const unique_areas_list = Array.from(unique_areas).join(', ');

    let file_content = `צבע אדום בשעה ${current_time} באזורים: ${unique_areas_list}\n\n`;
    file_content += `היחידות שלא נפתחו באזורים:\n\n`;

    for (const unit of unopened_units) {
        file_content += `${unit.device_serial}, ${unit.local}, ${unit.address}, ${unit.domain}\n`;
    }

    file_content += `\nכמות היחידות שלא נפתחו: ${unopened_units.length} מתוך ${poligon_unit_array.length}.\n`;
    file_content += `תאריך ושעה: ${current_time}\n`;

    // Write content to a .txt file
    fs.writeFileSync(file_path, file_content, 'utf8');

    // Send the message and the file
    notify_all_connected_users(file_content, file_path);
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
            const chat_id = update.message.chat.id;
            const username = update.message.from.username || update.message.from.first_name || "Unknown";
            const text = update.message.text || "[Non-text message]";

            console.log(`Message from ${username}: ${text}`);

            if (!_chat_ids.some(chat => chat.chat_id === chat_id)) {
                _chat_ids.push({ username, chat_id });
                console.log(`New chat ID ${chat_id} added for user ${username}.`);
            }

            last_update_id = update.update_id;
        }

        if (last_update_id > 0) {
            await fetch(`${TELEGRAM_API_URL}/getUpdates?offset=${last_update_id + 1}`);
        }
    } catch (error) {
        console.error("Error getting updates from Telegram:", error.message);
    }
}

setInterval(() => {
    get_updates_from_telegram();
}, 5000);

module.exports = {
    save_closed_units_to_file,
};
