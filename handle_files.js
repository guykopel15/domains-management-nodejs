const fs = require('fs');

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
    return [file_content, file_path];    
}

function get_current_time_plus_offset(hours = 2) {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toLocaleString('en-IL', { hour12: false });
}

module.exports = {
    save_closed_units_to_file,
}