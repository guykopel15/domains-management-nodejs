const { MongoClient } = require('mongodb');
const { MONGO_DB_URL, MONGO_DB_DATABASE, MONGO_UNIT_COLLECTION_NAME } = require('./CONSTS');

async function get_units_from_mongodb_and_insert_to_the_dictionary(dic) {
    const client = new MongoClient(MONGO_DB_URL);
    try {
        await client.connect();
        const db = client.db(MONGO_DB_DATABASE);
        const collection = db.collection(MONGO_UNIT_COLLECTION_NAME);
        const units = await collection.find().toArray();

        units.forEach(unit => {
            dic[unit.domain].units.push(unit);
        });

        console.log('Loaded units from MongoDB into dictionary.');
    } catch (error) {
        console.error('Error loading units from MongoDB:', error);
    } finally {
        await client.close();
    }
}

async function handle_units_from_mongodb_into_the_dictionary(dictionary) {
    const client = new MongoClient(MONGO_DB_URL);
    await client.connect();
    const db = client.db(MONGO_DB_DATABASE);
    const collection = db.collection(MONGO_UNIT_COLLECTION_NAME);

    for (const domain in dictionary) {
        await check_insert_or_update_domain(collection, domain, dictionary);
    }
    await client.close();
}

async function check_insert_or_update_domain(collection, domain, dictionary) {
    const units = Array.isArray(dictionary[domain].units) ? dictionary[domain].units : [];

    for (const unit of units) {
        const { _id, ...unit_without_Id } = unit;
        const existing_unit_in_the_collection = await collection.findOne({ device_serial: unit.device_serial });
        if (existing_unit_in_the_collection) {
            await collection.updateOne(
                { device_serial: unit.device_serial },
                { $set: { ...unit_without_Id } }
            );
        } else {
            await collection.insertOne({ ...unit_without_Id });
        }
    }
}

async function delete_all_data_from_mongodb() {
    const client = new MongoClient(MONGO_DB_URL);
    await client.connect();
    const db = client.db(MONGO_DB_DATABASE);
    const collection = db.collection(MONGO_UNIT_COLLECTION_NAME);
    await collection.deleteMany({});
    console.log('All data deleted from MongoDB collection.');
}

function convert_mysql_units_rows_to_dic(mysql_db_units) {
    const unit_dic = {};
    for (const key in mysql_db_units) {
        const db_unit_row = mysql_db_units[key];
        const mongo_row_format = convert_mysql_table_name_to_mongo_naming(db_unit_row);
        mongo_row_format.is_active = false;
        unit_dic[mongo_row_format.device_serial] = mongo_row_format;
    }

    return unit_dic;
}

function convert_mysql_table_name_to_mongo_naming(mysql_unit_row) {
    const mongo_row = {};

    for (const mysql_column_name in mysql_unit_row) {
        const convert_key = mysql_column_name
            // Convert camelCase to snake_case
            .replace(/([a-z])([A-Z])/g, "$1_$2")
            // Replace all spaces with underscores
            .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
            // Convert all letters to lowercase
            .toLowerCase();
        mongo_row[convert_key] = mysql_unit_row[mysql_column_name];
    }

    return mongo_row;
}

function add_domain_name_to_the_db_units_json(db_units, domain_name) {
    return db_units.map(unit => ({ ...unit, domain: domain_name }));
}

module.exports = {
    get_units_from_mongodb_and_insert_to_the_dictionary,
    handle_units_from_mongodb_into_the_dictionary,
    delete_all_data_from_mongodb,
    convert_mysql_row_to_mongo_rows: convert_mysql_units_rows_to_dic,
    convert_mysql_table_name_to_mongo_naming,
    add_domain_name_to_the_db_units_json
};
