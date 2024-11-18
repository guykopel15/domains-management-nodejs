const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data'); // Ensure this package is installed

// Telegram Bot Configuration
const bot_token = '7827859045:AAE1qo4WrbD0qytLDAuzU8PtPGlNc_FDLWw';
const chat_id = '5130398892';
const telegram_api_url = `https://api.telegram.org/bot${bot_token}`;

// Function to send a document to Telegram
async function send_document(file_path) {
    const url = `${telegram_api_url}/sendDocument`;
    const formData = new FormData();

    // Attach chat ID and the file
    formData.append('chat_id', chat_id);
    formData.append('document', fs.createReadStream(file_path));

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        // Parse the response from Telegram API
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

// Function to save unopened units to a file and send it to Telegram
function save_closed_units_to_file(domain_objs, poligon_unit_array) {
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

        // Send the file to Telegram
        console.log("Sending unopened units file to Telegram...");
        send_document(file_path);

    } catch (error) {
        console.error("Error saving or sending unopened units file:", error.message);
    }
}

// Export the save_closed_units_to_file function
module.exports = {
    save_closed_units_to_file
};
