const path = require('path');
const fs = require('fs');
const { save_closed_units_to_file } = require('./telegram/telegram_bot');

const Units_Object = require('./units_obj');
const MqttClient_Obj = require('./mqtt_client');
const _emitter = require('./event_bus');

const {
    fetch_units_from_specific_sql_domain,
} = require('./mysql_handling');

const {
    handle_units_from_mongodb_into_the_dictionary,
    convert_mysql_row_to_mongo_rows,
    add_domain_name_to_the_db_units_json,
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
let _localhost_mqtt_client = null;

async function main() {
    console.log('Starting main function...');
    _mysql_servers.forEach(server => {
        _domain_objs[server.name] = new Units_Object(server.name, {});
    });

    _localhost_mqtt_client = new MqttClient_Obj(BOBO1_DOMAIN_NAME, LOCAL_BROKER_URL, 1883, LOCAL_SUBSCRIPTION_TOPICS);

    for (const mysql_server of _mysql_servers) {
        const db_units = await fetch_units_from_specific_sql_domain(mysql_server.host);
        const db_units_full_json = add_domain_name_to_the_db_units_json(db_units, mysql_server.name);
        const mongo_table = convert_mysql_row_to_mongo_rows(db_units_full_json);
        const domain_obj = _domain_objs[mysql_server.name];

        upsert_dictionary(domain_obj, mongo_table);
        handle_units_from_mongodb_into_the_dictionary(mongo_table);
        console.log(`Units from ${mysql_server.name} added to dictionary.`);
    }

    for (const mysql_server of _mysql_servers) {
        const domain_obj = _domain_objs[mysql_server.name];
        const mqtt_broker = `mqtt://${mysql_server.host}`;
        const mqtt_client = new MqttClient_Obj(mysql_server.name, mqtt_broker, 1883);

        domain_obj.set_mqtt_client(mqtt_client);
        console.log(`MQTT client for ${mysql_server.name} created.`);
    }

    interval_functions_every_30_seconds(_domain_objs);
}

function interval_functions_every_30_seconds(domain_objs) {
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

            console.log(`Units from ${mysql_server.name} updated.`);
        }
    }, 30 * 1000);
}

function set_non_active_units(domain_objects) {
    for (const domain_obj of Object.values(domain_objects)) {
        domain_obj.check_non_active_units_and_get_domain_units_state(_HEARTBEAT_THRESHOLD);
    }
}

_emitter.on('mqtt_message_received', (topic, message, domain_name) => {
    switch (topic) {
        case HEARTBEAT_TOPIC:
            const units = JSON.parse(message.toString());
            for (const unit of units) {
                if (unit.action !== 'heartbeat') continue;

                const domain_obj = _domain_objs[unit.domain];
                unit.is_active = true;
                domain_obj.upsert(unit);
                domain_obj.update_active_count();
                domain_obj.update_non_active_count();
            }
            break;
        case RED_ALERT_NOTIFY_TOPIC:
            console.log('Red alert notify received');
            const red_alert_message = JSON.parse(message.toString());
            const red_alert_poligon_arr = red_alert_message.alert.data;
            const poligon_unit_array = get_units_arr_that_match_poligon_alert(red_alert_poligon_arr, _domain_objs);

            console.log(poligon_unit_array.length);

            run_multiple_times_with_delay(poligon_unit_array, 3, 10 * 1000, _domain_objs).then(() => {
                console.log('3 times done');
                save_closed_units_to_file(_domain_objs, poligon_unit_array);
            });
            break;
    }
});

function is_part_of_polygon(unit_saved_location, red_alert_polygons) {
    const unit_saved_locations_array = Array.isArray(unit_saved_location) ? unit_saved_location : [unit_saved_location];

    const format_location = (str) => str.replace(/\s+/g, ' ').trim();

    for (const location of unit_saved_locations_array) {
        const formatted_location = format_location(location);

        for (const alert_polygon of red_alert_polygons) {
            const formatted_alert_polygon = format_location(alert_polygon);

            if (formatted_location.includes(formatted_alert_polygon) || formatted_alert_polygon.includes(formatted_location)) {
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
            if (!unit.is_active || !unit.saved_location || unit.saved_location === 'null') continue;

            if (is_part_of_polygon(unit.saved_location, red_alert_polygons)) {
                units.push(unit);
            }
        }
    });
    console.log(`Array length => ${units.length}`);
    return units;
}

async function run_multiple_times_with_delay(units_not_open, times, delay_between_runs, domain_objs) {
    for (let i = 0; i < times; i++) {
        console.log(`Opening units for ${i + 1} time`);
        await execute_open_with_delay(units_not_open, domain_objs);
        if (i < times - 1) {
            await delay(delay_between_runs);
        }
    }
}

async function execute_open_with_delay(need_to_open_unit_arr, domain_objs) {
    for (const unit of need_to_open_unit_arr) {
        const topic = `${unit.unique_id}/${OPEN_SAFEHOUSE_TOPIC}`;
        console.log(`Opening unit ${unit.device_serial} with topic: ${topic}`);
        await delay(100);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main();
