const { MongoClient } = require('mongodb');

const {
    MONGO_DB_URL,
    MONGO_DB_DATABASE
} = require('./CONSTS');


async function update_scheduler_times(domain_objects, domain_names, new_times) {
    if (domain_names.length !== new_times.length) {
        throw new Error("Domain names and times array must have the same length.");
    }

    domain_names.forEach((domain_name, index) => {
        const domain_obj = domain_objects[domain_name];
        if (!domain_obj) {
            console.error(`Domain ${domain_name} not found.`);
            return;
        }

        // Update the time strings
        domain_obj.scheduler.scheduler_time_str_arr = new_times[index];
        // Regenerate timestamps
        domain_obj.update_date_timestamps();

        console.log(`Scheduler times updated for domain: ${domain_name}`);
        console.log(`New time strings: ${JSON.stringify(domain_obj.scheduler.scheduler_time_str_arr)}`);
        console.log(`New timestamps: ${JSON.stringify(domain_obj.scheduler.scheduler_timestamp_arr)}`);
    });

    // Optionally persist changes to MongoDB
    await save_scheduler_times_to_mongo(domain_objects, domain_names);
}

async function save_scheduler_times_to_mongo(domain_objects, domain_names) {
    const client = new MongoClient(MONGO_DB_URL);
    try {
        await client.connect();
        const db = client.db(MONGO_DB_DATABASE);
        const collection = db.collection('scheduler_times');

        for (const domain_name of domain_names) {
            const domain_obj = domain_objects[domain_name];
            if (!domain_obj) 
                continue;

            await collection.updateOne(
                { domain_name },
                {
                    $set: {
                        scheduler_time_str_arr: domain_obj.scheduler.scheduler_time_str_arr,
                        scheduler_timestamp_arr: domain_obj.scheduler.scheduler_timestamp_arr,
                        last_report_time: domain_obj.scheduler.last_report_time
                    }
                },
                { upsert: true }
            );
        }

        console.log("Scheduler times saved to MongoDB.");
    } finally {
        await client.close();
    }
}

module.exports = {
    update_scheduler_times,
    save_scheduler_times_to_mongo
};