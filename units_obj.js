class Units_Object {
    #domain_name = "";
    #total_unit_count = -1;
    #active_units = -1;
    #non_active_units = -1;
    #need_update = true;
    units = {};
    last_report_time = {};
    time = [ "14:01", "14:07", "17:00"];
    date_timestamp_arr = [];
    #mqtt_client = null;

    constructor(domain_name, units_json_dict = {}) {
        this.#domain_name = domain_name;
        this.init(domain_name, units_json_dict);
        this.update_date_timestamps();
    }

    // Initialize the domain and units
    init(domain_name, units_json_dict) {
        this.#domain_name = domain_name;
        const units_array = Object.values(units_json_dict);
        units_array.forEach(item => {
            item.is_active = false;
            this.upsert(item);
        });

        this.#total_unit_count = units_array.length;
    }

    // Generate and set timestamps for the current day
    update_date_timestamps() {
        const current_date = new Date();
        this.date_timestamp_arr = this.time.map(time => {
            const [hours, minutes] = time.split(':');
            return new Date(
                current_date.getFullYear(),
                current_date.getMonth(),
                current_date.getDate(),
                parseInt(hours),
                parseInt(minutes)
            ).getTime();
        });

        // Initialize the last report times
        this.date_timestamp_arr.forEach(timestamp => {
            if (!this.last_report_time[timestamp]) {
                this.last_report_time[timestamp] = null; 
            }
        });
    }

    is_time_to_execute_and_send_report() {
        const current_time = new Date().getTime() + (2 * 60 * 60 * 1000); 
    
        for (const timestamp of this.date_timestamp_arr) {
            if (current_time >= timestamp && (!this.last_report_time[timestamp])) {
                this.last_report_time[timestamp] = current_time; 
                return true;
            }
        }
    
        return false;
    }
    
    update_last_report_time(current_time) {
        const current_timestamp = this.date_timestamp_arr.find(
            timestamp => current_time > timestamp && (!this.last_report_time[timestamp] || current_time > this.last_report_time[timestamp])
        );
    
        if (current_timestamp) {
            this.last_report_time[current_timestamp] = current_time; // Use the passed `current_time`
            console.log(`Updated last_report_time for domain ${this.#domain_name}:`, this.last_report_time);
        } else {
            console.log(`No valid timestamp to update for domain ${this.#domain_name}`);
        }
    }

    set_domain_name(domain_name) {
        this.#domain_name = domain_name;
    }

    /////////////////////////////////////////////// mqtt ///////////////////////////////////////////////
    set_mqtt_client(mqtt_client) {
        this.#mqtt_client = mqtt_client;
    }

    publish_mqtt_message(topic, message) {
        this.#mqtt_client.publish_mqtt_message(topic, message);
    }

    /////////////////////////////////////////////// end mqtt ///////////////////////////////////////////////

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
