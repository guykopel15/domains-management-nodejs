class Units_Object {
    #domain_name = "";
    #total_unit_count = -1;
    #active_units = -1;
    #non_active_units = -1;
    #need_update = true;
    units = {};

    constructor(domain_name = "", units_json_dict = {}) {
        this.#domain_name = domain_name;
        this.init(domain_name, units_json_dict);
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

    add_unit(unit) {
        this.units[unit.device_serial] = unit;
    }

    upsert(unit) {
        this.units[unit.device_serial] = unit;
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
}

module.exports = Units_Object;
