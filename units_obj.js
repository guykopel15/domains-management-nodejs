const { MongoClient } = require('mongodb');
const { MONGO_DB_URL, MONGO_DB_DATABASE } = require('./CONSTS');


class Units_Object {
    #domain_name = "";
    #total_unit_count = -1;
    #active_units = -1;
    #non_active_units = -1;
    #need_update = true;
    #report_in_progress = false;
    units = {};
    #mqtt_client = null;
    scheduler = {
        last_report_time: {},
        scheduler_time_str_arr: ["11:00", "12:40", "12:55", "13:26", "19:00", "23:00"],
        scheduler_timestamp_arr: [],
    };

    constructor(domain_name, units_json_dict = {}) {
        this.#domain_name = domain_name;
        this.init(domain_name, units_json_dict);
        this.update_date_timestamps();
    }

    init(domain_name, units_json_dict) {
        this.#domain_name = domain_name;
        const units_array = Object.values(units_json_dict);
        units_array.forEach(item => {
            item.is_active = false;
            this.upsert(item);
        });

        this.#total_unit_count = units_array.length;
    }

    async load_last_report_times() {
        const client = new MongoClient(MONGO_DB_URL);
        await client.connect();
        const db = client.db(MONGO_DB_DATABASE);
        const collection = db.collection('report_times');

        const report_data = await collection.findOne({ domain_name: this.#domain_name });
        if (report_data?.scheduler?.last_report_time) {
            this.scheduler.last_report_time = Object.fromEntries(
                Object.entries(report_data.scheduler.last_report_time).map(([key, value]) => [key, value || null])
            );
            console.log(`Loaded last report times for domain: ${this.#domain_name}`);
        } else {
            console.log(`No previous report times found for domain: ${this.#domain_name}, initializing.`);
            this.scheduler.scheduler_timestamp_arr.forEach(timestamp => {
                this.scheduler.last_report_time[timestamp] = null;
            });
        }
    }


    async is_time_to_execute_and_send_report() {
        // Adjusted for Israel timezone (UTC+2)
        const current_time = Date.now() + (2 * 60 * 60 * 1000);

        // Check if report is already in progress for this domain name and return false
        if (this.#report_in_progress) {
            return false;
        }

        // Find overdue timestamps
        const overdue_timestamps = this.scheduler.scheduler_timestamp_arr.filter(
            timestamp => current_time >= timestamp && !this.scheduler.last_report_time[timestamp]
        );

        // If there are overdue timestamps, start the report and return true to send the report
        if (overdue_timestamps.length > 0) {
            const most_recent_timestamp = Math.max(...overdue_timestamps);

            // Check in MongoDB if the report was already sent
            const client = new MongoClient(MONGO_DB_URL);
            await client.connect();
            const db = client.db(MONGO_DB_DATABASE);
            const collection = db.collection('report_times');
            const report_data = await collection.findOne({ domain_name: this.#domain_name });

            // If report already exists, return false
            if (report_data.scheduler.last_report_time[most_recent_timestamp]) {
                console.log(`Report for domain: ${this.#domain_name} at timestamp: ${most_recent_timestamp} already exists.`);
                return false;
            }

            // Mark report as in progress and save the timestamp
            this.#report_in_progress = true;
            this.scheduler.last_report_time[most_recent_timestamp] = current_time;
            await this.save_last_report_time(most_recent_timestamp);
            return true;

        }

        return false;
    }

    mark_report_complete() {
        if (this.#report_in_progress) {
            this.#report_in_progress = false;
            console.log(`Report marked as complete for domain: ${this.#domain_name}`);
        } else {
            console.log(`No report in progress to mark complete for domain: ${this.#domain_name}`);
        }
    }

    update_date_timestamps() {
        const current_date = new Date();
        this.scheduler.scheduler_timestamp_arr = this.scheduler.scheduler_time_str_arr.map(time => {
            const [hours, minutes] = time.split(':');
            return new Date(
                current_date.getFullYear(),
                current_date.getMonth(),
                current_date.getDate(),
                parseInt(hours, 10),
                parseInt(minutes, 10)
            ).getTime();
        });

        this.scheduler.scheduler_timestamp_arr.forEach(timestamp => {
            if (!this.scheduler.last_report_time[timestamp]) {
                this.scheduler.last_report_time[timestamp] = null;
            }
        });
    }

    async update_last_report_time(timestamp) {
        const current_time = new Date().getTime();
        if (this.scheduler.last_report_time[timestamp] === null || this.scheduler.last_report_time[timestamp] < current_time) {
            this.scheduler.last_report_time[timestamp] = current_time;
            await this.save_last_report_time(timestamp);
            console.log(`Updated last_report_time for timestamp ${timestamp} to ${current_time}`);
        }
    }

    async save_last_report_time(timestamp) {
        const client = new MongoClient(MONGO_DB_URL);
        await client.connect();
        const db = client.db(MONGO_DB_DATABASE);
        const collection = db.collection('report_times');

        const current_time = Date.now() + (2 * 60 * 60 * 1000); 
        this.scheduler.last_report_time[timestamp] = current_time;

        await collection.updateOne(
            { domain_name: this.#domain_name },
            {
                $set: {
                    [`scheduler.last_report_time.${timestamp}`]: current_time,
                },
            },
            { upsert: true }
        );

        console.log(`Saved last report time for domain: ${this.#domain_name} at timestamp: ${timestamp}`);
    }
    /////////////////////////////////////////////// mqtt ///////////////////////////////////////////////
    set_mqtt_client(mqtt_client) {
        this.#mqtt_client = mqtt_client;
    }

    publish_mqtt_message(topic, message) {
        this.#mqtt_client.publish_mqtt_message(topic, message);
    }

    /////////////////////////////////////////////// end mqtt ///////////////////////////////////////////////
    set_domain_name(domain_name) {
        this.#domain_name = domain_name;
    }

    add_unit(unit) {
        this.units[unit.device_serial] = unit;
    }

    upsert(unit) {
        const existing_unit = this.units[unit.device_serial];
        if (existing_unit) {
            unit = {
                ...existing_unit,
                ...unit,
                unit_address: unit.unit_address || existing_unit.unit_address || '-',
                unit_local_id: unit.unit_local_id || existing_unit.unit_local_id || '-',
                unit_system_type: unit.system_type_id === 1 ? 'panic-control' : 'safehouse',
            };
        }
        this.units[unit.device_serial] = unit;
    }

    upsert_last_report_time(new_time) {
        this.last_report_time = new_time;
    }

    update_non_active_count() {
        const last_count = this.#non_active_units;
        this.#non_active_units = 0;
        Object.values(this.units).forEach(item => { if (!item.is_active) this.#non_active_units++; });
        if (last_count !== this.#non_active_units) this.#need_update = true;
    }

    update_active_count() {
        const last_count = this.#active_units;
        this.#active_units = 0;
        Object.values(this.units).forEach(item => { if (item.is_active) this.#active_units++; });
        if (last_count !== this.#active_units) this.#need_update = true;
    }

    check_non_active_units_and_get_domain_units_state(not_active_threshold_in_milli) {
        const current_time = Date.now();
        const non_active_units = {};

        Object.entries(this.units).forEach(([device_serial, unit]) => {
            const time_diff = current_time - unit.inactive_unixtime_milli;
            if (time_diff >= not_active_threshold_in_milli) {
                unit.is_active = false;
                unit.inactive_unixtime_milli = undefined;
                non_active_units[device_serial] = unit;
            }
        });

        // Update the active and non-active counts
        this.update_active_count();
        this.update_non_active_count();

        return {
            domain_name: this.get_domain_name(),
            active_units: this.active_units_count,
            non_active_units: this.non_active_units_count,
        };
    }

    //////////////////////////// GETTERS ////////////////////////////

    get_unit_by_device_serial(device_serial) {
        return this.units[device_serial] || null;
    }

    get_all_units() {
        return Object.values(this.units);
    }

    get_domain_name() {
        return this.#domain_name;
    }

    get_total_unit_count() {
        return this.#total_unit_count;
    }

    get active_units_count() {
        return this.#active_units;
    }

    get non_active_units_count() {
        return this.#non_active_units;
    }

    get is_update_needed() {
        return this.#need_update;
    }

    get non_active_units() {
        const non_active_units = {};
        Object.entries(this.units).forEach(([device_serial, unit]) => {
            if (!unit.is_active) non_active_units[device_serial] = unit;
        });
        return non_active_units;
    }

    get active_units() {
        const active_units = {};
        Object.entries(this.units).forEach(([device_serial, unit]) => {
            if (unit.is_active) active_units[device_serial] = unit;
        });
        return active_units;
    }

    get is_open_count() {
        let count = 0;
        Object.values(this.units).forEach(unit => { if (unit.is_open) count++; });
        return count;
    }

    get is_not_open_count() {
        let count = 0;
        Object.values(this.units).forEach(unit => { if (!unit.is_open) count++; });
        return count;
    }

    get_all_units() {
        return Object.values(this.units);
    }

    get_all_open_or_close_units(status) {
        return Object.values(this.units).filter(unit =>
            (status === 'open' && unit.is_open) || (status === 'close' && !unit.is_open)
        );
    }
}

module.exports = Units_Object;