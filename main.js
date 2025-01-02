const Units_Object = require('./units_obj');
const MqttClient_Obj = require('./mqtt_client');
const _emitter = require('./event_bus');

const { notify_all_connected_users } = require('./telegram/telegram_bot');

const {
    fetch_units_from_specific_sql_domain,
    fetch_ids_and_addresses_from_specific_sql_domain,
} = require('./mysql_handling');

const {
    handle_units_from_mongodb_into_the_dictionary,
    convert_mysql_row_to_mongo_rows,
    add_domain_name_to_the_db_units_json,
    get_all_data_from_mongo,
    add_to_mongo
} = require('./mongo_handling');

const {
    upsert_dictionary,
} = require('./dictionary_functions');

const {
    HEARTBEAT_TOPIC,
    RED_ALERT_NOTIFY_TOPIC,
    GENERAL_LOCK_ACKNOWLEDGE_TOPIC,
    LOCAL_BROKER_URL,
    LOCAL_SUBSCRIPTION_TOPICS,
    BOBO1_DOMAIN_NAME,
    OPEN_SAFEHOUSE_TOPIC,
    CLOSE_SAFEHOUSE_TOPIC
} = require('./CONSTS');

// List of domains and their respective IP addresses
const _mysql_servers = [
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

const _HEARTBEAT_THRESHOLD = 30000;

const _domain_objs = {};
var _localhost_mqtt_client = null;

async function main() {
    console.log('Starting main function...');

    // Initialize domain objects
    _mysql_servers.forEach((server) => {
        _domain_objs[server.name] = new Units_Object(server.name, {});
    });

    // Process MySQL data for each domain
    for (const mysql_server of _mysql_servers) {
        const db_units = await fetch_units_from_specific_sql_domain(mysql_server.host);

        const db_units_full_json = add_domain_name_to_the_db_units_json(db_units, mysql_server.name);

        const mongo_table = convert_mysql_row_to_mongo_rows(db_units_full_json);

        const domain_obj = _domain_objs[mysql_server.name];

        const units_local_id_and_addresses_array = await fetch_ids_and_addresses_from_specific_sql_domain(mysql_server.host);

        const full_units_dictionary = generate_dictionary_with_local_id_and_address(mongo_table, units_local_id_and_addresses_array);

        upsert_dictionary(domain_obj, full_units_dictionary);

        add_to_mongo(domain_obj);

        handle_units_from_mongodb_into_the_dictionary(mongo_table);

        console.log(`Units from ${mysql_server.name} added to dictionary.`);
    }

    // Initialize MQTT clients for each domain
    _mysql_servers.forEach((server) => {
        const domain_obj = _domain_objs[server.name];
        const mqtt_broker = `mqtt://${server.host}`;
        const mqtt_client = new MqttClient_Obj(server.name, mqtt_broker, 1883, LOCAL_SUBSCRIPTION_TOPICS);

        domain_obj.set_mqtt_client(mqtt_client);
        console.log(`MQTT client for ${server.name} created.`);
    });

    interval_functions_every_60_seconds(_domain_objs);
}

function interval_functions_every_60_seconds(domain_objs) {
    setInterval(async () => {
        for (const mysql_server of _mysql_servers) {
            const mysql_all_units = await fetch_units_from_specific_sql_domain(mysql_server.host);

            const db_units_full_json = {};
            for (const [key, unit] of Object.entries(mysql_all_units)) {
                db_units_full_json[key] = { ...unit, domain: mysql_server.name };
            }

            const units_as_dic = convert_mysql_row_to_mongo_rows(db_units_full_json);
            const domain_obj = domain_objs[mysql_server.name];
            set_non_active_units(domain_objs);
            upsert_dictionary(domain_obj, units_as_dic);
            handle_units_from_mongodb_into_the_dictionary(units_as_dic);

            if (!domain_obj.is_time_to_execute_and_send_report()) {
                // console.log(`Skipping report for domain ${mysql_server.name}`);
                continue;
            }

            console.log(`It's time to execute and send report for domain ${mysql_server.name}`);
            let full_message = `בדיקה יומית של השעה ${new Date().toLocaleString('en-IL', { timeZone: 'Asia/Jerusalem', hour12: false })}:\n`;

            const units_in_domain = Object.values(domain_obj.units);
            const domain_objs_array = Object.values(domain_objs);

            // Open all units
            await run_multiple_times_with_delay(units_in_domain, 3, 10 * 1000, domain_objs_array, "open");
            console.log(`Units opened for domain ${mysql_server.name}`);
            const close_units = domain_obj.get_all_open_or_close_units("close");

            // Close all units
            await run_multiple_times_with_delay(units_in_domain, 3, 10 * 1000, domain_objs_array, "close");
            console.log(`Units closed for domain ${mysql_server.name}`);
            const open_units = domain_obj.get_all_open_or_close_units("open");

            // Identify faulty units
            const faulty_units = units_in_domain.filter(
                unit => !open_units.includes(unit) && !close_units.includes(unit)
            );

            // Build the report message
            full_message += `דומיין: ${mysql_server.name}\n`;
            full_message += `יחידות תקולות:\n היחידות שגם לא נפתחו בפתיחה וגם לא נסגרו בסגירה:\n`;
            full_message += `${generate_units_summary_message(faulty_units)}\n`;
            full_message += `\nסיכום דו"ח של השעה ${new Date().toLocaleString('en-IL', { timeZone: 'Asia/Jerusalem', hour12: false })}:\n`;
            full_message += `כמות היחידות התקולות: ${faulty_units.length} מתוך ${units_in_domain.length}\n`;

            notify_all_connected_users(full_message, domain_obj.get_domain_name());
            console.log(JSON.stringify(domain_objs_array, null, 4));
            console.log(`Report sent and last_report_time updated for domain ${mysql_server.name}`);
        }
    }, 60 * 1000);
}

function generate_units_summary_message(units_array) {
    if (units_array.length === 0) {
        return "אין יחידות תקולות במצב זה.\n";
    }

    let message = "";
    for (const unit of units_array) {
        message += `‏${unit.unit_local_id || "-"}, ${unit.device_serial.slice(-4)}, ${unit.address || "-"}, ${unit.domain}\n`;
    }
    return message;
}

_emitter.on('mqtt_message_received', (topic, message, domain_name) => {
    const units = JSON.parse(message.toString());
    const units_array = Array.isArray(units) ? units : [units];

    switch (topic) {
        case HEARTBEAT_TOPIC:
            for (const unit of units_array) {

                // Ensure the unit is associated with the correct domain
                const domain_obj = _domain_objs[domain_name];
                unit.is_active = true;
                unit.domain = domain_name;
                domain_obj.upsert(unit);
                domain_obj.update_active_count();
                domain_obj.update_non_active_count();
            }
            break;

        case RED_ALERT_NOTIFY_TOPIC:
            console.log('Red alert notify received');
            const red_alert_message = JSON.parse(message.toString());
            const red_alert_poligon_arr = red_alert_message.alert.data;
            const poligon_units_array = get_units_arr_that_match_poligon_alert(red_alert_poligon_arr, _domain_objs);
            console.log(red_alert_poligon_arr);

            const polygon_unit_domain = poligon_units_array[0].domain;
            run_multiple_times_with_delay(poligon_units_array, 3, 10 * 1000, _domain_objs, "open").then(() => {
                const close_units = _domain_objs[polygon_unit_domain].get_all_open_or_close_units("close");
                const file_content = generate_red_alert_message(red_alert_poligon_arr, close_units, poligon_units_array);
                notify_all_connected_users(file_content, polygon_unit_domain);
            });
            break;

        case GENERAL_LOCK_ACKNOWLEDGE_TOPIC:
            {
                const units = JSON.parse(message.toString());
                for (const incomming_unit of units) {
                    const domain_obj = _domain_objs[domain_name];
                    const unit = domain_obj.units[incomming_unit.device_serial];
                    if (unit) {
                        unit.lock_data = incomming_unit.extra_data;
                        domain_obj.upsert(unit);
                    }
                }
            }
            break;
    }
});

function is_part_of_polygon(unit_polygons, red_alert_polygons) {
    const unit_polygons_array = Array.isArray(unit_polygons) ? unit_polygons : [unit_polygons];

    for (const unit_polygon of unit_polygons_array) {
        if (!unit_polygon)
            return false;
        const formatted_unit_polygon = unit_polygon.replace(/\s+/g, ' ').trim();

        for (const red_alert_polygon of red_alert_polygons) {
            const formatted_alert_polygon = red_alert_polygon.replace(/\s+/g, ' ').trim();

            if (formatted_unit_polygon.includes(formatted_alert_polygon) || formatted_alert_polygon.includes(formatted_unit_polygon)) {
                return true;
            }
        }
    }

    return false;
}

function get_units_arr_that_match_poligon_alert(red_alert_polygons, domain_objs) {
    const units = [];

    Object.values(domain_objs).forEach(domain_obj => {
        for (const device_serial in domain_obj.units) {
            const unit = domain_obj.units[device_serial];
            if (!unit.is_active || (!unit.saved_location && !unit.red_alert_polygon) || unit.saved_location === 'null')
                continue;

            if (is_part_of_polygon(unit.saved_location, red_alert_polygons) || is_part_of_polygon(unit.red_alert_polygon, red_alert_polygons)) {
                units.push(unit);
            }
        }
    });

    console.log(`Array length => ${units.length}`);
    return units;
}

async function run_multiple_times_with_delay(units_not_open, times, delay_between_runs, domain_objs, action) {
    for (let i = 0; i < times; i++) {
        await execute_open_with_delay(units_not_open, domain_objs, action);
        if (i < times - 1) {
            await delay(delay_between_runs);
        }
    }
}

async function execute_open_with_delay(need_to_open_unit_arr, domain_objs, action) {
    const topic_action = action === "open" ? OPEN_SAFEHOUSE_TOPIC : CLOSE_SAFEHOUSE_TOPIC;

    for (const unit of need_to_open_unit_arr) {
        const topic = unit.unique_id + '/' + topic_action;
        // domain_objs[unit.domain].publish_mqtt_message(topic, '1');
        await delay(100);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generate_red_alert_message(red_alert_poligon_arr, closed_units, poligon_units_array) {
    const current_time = new Date().toLocaleString('en-IL', { hour12: false });

    let file_content = `\u200Fצבע אדום בשעה ${current_time} באזורים: ${red_alert_poligon_arr.join(', ')}\n\n`;
    file_content += `\u200Fהיחידות הפעילות שלא נפתחו באזורים:\n\n`;

    for (const unit of closed_units) {
        file_content += `\u200F${unit.unit_local_id},  ${unit.device_serial.slice(-4)},  ${unit.address},  ${unit.domain}\n`;
    }

    file_content += `\n\u200Fכמות היחידות שלא נפתחו: ${closed_units.length} מתוך ${poligon_units_array.length}.\n`;
    file_content += `\u200Fתאריך ושעה: ${current_time}\n`;

    return file_content;
}

function generate_dictionary_with_local_id_and_address(domain_objs, units_local_id_and_addresses_array) {
    const updated_units = {};
    Object.values(domain_objs).forEach(unit => {
        // Find the match in the units_local_id_and_addresses_array
        const match_units = units_local_id_and_addresses_array.find(
            item => item.DeviceSerial === unit.device_serial
        );

        unit.unit_address = match_units ? match_units.Address || '-' : '-';
        unit.unit_local_id = match_units ? match_units.Name || '-' : '-';
        unit.unit_system_type = unit.system_type_id === 1 ? 'panic-control' : 'safehouse';
        updated_units[unit.device_serial] = unit;
    });
    return updated_units;
}

function set_non_active_units(domain_objects) {
    for (const domain_obj of Object.values(domain_objects)) {
        domain_obj.check_non_active_units_and_get_domain_units_state(_HEARTBEAT_THRESHOLD);
    }
}

main();