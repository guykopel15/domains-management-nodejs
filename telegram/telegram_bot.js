const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '7827859045:AAE1qo4WrbD0qytLDAuzU8PtPGlNc_FDLWw';
const TELEGRAM_CHAT_ID = '5130398892';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function send_text_message(message) {
    const url = `${TELEGRAM_API_URL}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
            }),
        });

        const data = await response.json();

        if (data.ok) {
            console.log("Text message sent successfully to Telegram!");
        } else {
            console.error("Failed to send text message to Telegram:", data.description);
        }
    } catch (error) {
        console.error("Error sending text message to Telegram:", error.message);
    }
}

async function send_document(file_path) {
    const url = `${TELEGRAM_API_URL}/sendDocument`;
    const formData = new FormData();

    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('document', fs.createReadStream(file_path));

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (data.ok) {
            console.log("File sent successfully to Telegram!");
        } else {
            console.error("Failed to send file to Telegram:", data.description);
        }
    } catch (error) {
        console.error("Error sending file to Telegram:", error.message);
    }
}

async function save_closed_units_to_file(domain_objs, poligon_unit_array) {
    const unopened_units = [];

    try {
        // Collect unopened units
        for (const unit of poligon_unit_array) {
            const domain_obj = domain_objs[unit.domain];
            const unit_in_domain = domain_obj && domain_obj.units[unit.device_serial];

            if (unit_in_domain && !unit_in_domain.is_open) {
                unopened_units.push({
                    device_serial: unit_in_domain.device_serial,
                    address: unit_in_domain.address || "-",
                    unique_id: unit_in_domain.unique_id,
                    unit_polygone: unit_in_domain.saved_location || "-",
                    is_open: unit_in_domain.is_open,
                    local_id: unit_in_domain.local_id || "-",
                    unit_red_alert_polygons: unit_in_domain.red_alert_polygons || "-",
                    domain: unit_in_domain.domain
                });
            }
        }

        // Define file path for saving data
        const file_path = path.join(__dirname, 'closed_units.json');

        // Write unopened units to file
        fs.writeFileSync(file_path, JSON.stringify(unopened_units, null, 2), 'utf8');

        // Add a summary to the file
        const summary = {
            timestamp: new Date(new Date().getTime() + 2 * 60 * 60 * 1000).toLocaleString('en-IL', { hour12: false }),
            unopened_units_count: unopened_units.length
        };

        fs.appendFileSync(file_path, `\n${JSON.stringify(summary, null, 2)}`, 'utf8');
        console.log(`Summary data appended to ${file_path}`);

        // Send individual text messages for each unopened unit
        for (const unit of unopened_units) {
            const message = `The unit ${unit.unique_id} in address ${unit.address} isn't open on the red alert.`;
            await send_text_message(message); 
        }

        console.log("All text messages sent to Telegram.");

        // Send the file to Telegram
        console.log("Sending unopened units file to Telegram...");
        await send_document(file_path);

    } catch (error) {
        console.error("Error saving or sending unopened units file:", error.message);
    }
}

module.exports = {
    save_closed_units_to_file
};
