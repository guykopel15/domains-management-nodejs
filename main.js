const {
    fetch_units_from_specific_sql_domain,
} = require('./mysql_handling');

const {
    setup_mqtt_listener
} = require('./mqtt_client');

const {
    handle_units_from_mongodb_into_the_dictionary,
    convert_mysql_row_to_mongo_rows,
    add_domain_name_to_the_db_units_json,
    delete_all_data_from_mongodb
} = require('./mongo_handling');

const {
    upsert_dictionary,
} = require('./dictionary_functions');

const {
    HEARTBEAT_TOPIC,
    RED_ALERT_NOTIFY_TOPIC
} = require('./CONSTS');

const Units_Object = require('./units_obj');
const _emitter = require('./event_bus');


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
    { name: 'lod', host: '34.0.65.91', url: 'lodm.admin.netiotil.com' },
    { name: 'redport', host: '34.0.70.52', url: 'redport.admin.netiotil.com' }
];

const _HEARTBEAT_THRESHOLD = 30000;

// Initialize _domain_objs as instances of Units_Object
const _domain_objs = {};

_mysql_servers.forEach(server => {
    _domain_objs[server.name] = new Units_Object(server.name, {});
});

async function main() {
    for (const mysql_server of _mysql_servers) {
        const db_units = await fetch_units_from_specific_sql_domain(mysql_server.host);
        const db_units_full_json = add_domain_name_to_the_db_units_json(db_units, mysql_server.name);
        const mongo_table = convert_mysql_row_to_mongo_rows(db_units_full_json);
        const domain_obj = _domain_objs[mysql_server.name];
        upsert_dictionary(domain_obj, mongo_table);
        handle_units_from_mongodb_into_the_dictionary(mongo_table);
    }

    setup_mqtt_listener();

    // Call the interval function every 60 seconds to update the dictionary
    interval_functions_every_60_seconds(_domain_objs);

    // console.log(JSON.stringify(_domain_objs, null, 2));

}

// Function to handle interval tasks every 60 seconds
function interval_functions_every_60_seconds(domain_objs) {
    setInterval(async () => {
        for (const mysql_server of _mysql_servers) {
            const mysql_all_units = await fetch_units_from_specific_sql_domain(mysql_server.host);

            // Add domain name to each unit in the dictionary
            const db_units_full_json = {};
            for (const [key, unit] of Object.entries(mysql_all_units)) {
                db_units_full_json[key] = { ...unit, domain: mysql_server.name };
            }

            // Convert MySQL rows to MongoDB format (assuming this function returns a dictionary)
            const units_as_dic = convert_mysql_row_to_mongo_rows(db_units_full_json);
            const domain_obj = domain_objs[mysql_server.name];

            //set non active units(return dictionary of domain name, active_units, non_active_units)
            set_non_active_units(domain_objs);

            // Upsert dictionary entries
            upsert_dictionary(domain_obj, units_as_dic);
            handle_units_from_mongodb_into_the_dictionary(units_as_dic);
        }
    }, 60000);
}

function set_non_active_units(domain_objects) {
    for (const domain_obj of Object.values(domain_objects)) {
        // Update non-active units based on threshold (_HEARTBEAT_THRESHOLD)
        const domain_units_stats = domain_obj.check_non_active_units_and_get_domain_units_state(_HEARTBEAT_THRESHOLD);
    }
}

///////////////////////////////////////////// callbacks /////////////////////////////////////////////

// Listen for the MQTT message event and update the dictionary
_emitter.on('mqtt_message_received', (topic, message) => {
    switch (topic) {
        case HEARTBEAT_TOPIC:
            {
                const unit = JSON.parse(message.toString());
                unit.is_active = true;

                // Convert domain name to uppercase for consistent access with original casing in _domain_objs
                const domain_name = unit.domain;
                const domain_obj = _domain_objs[domain_name];

                //check how i get undefined on domains names
                if (domain_obj === undefined) {
                    console.log(`Domain not found in _domain_objs: ${domain_name}`);
                    console.log("Unit data:", unit);  
                    return;
                }
            }
            break;
        case RED_ALERT_NOTIFY_TOPIC:
            {
                const red_alert_message = JSON.parse(message.toString());
                console.log("Red Alert:", red_alert_message);
            }
            break;
    }
});




////////////////////////////////////////////////////////////////////////////////////////////////////

main();
