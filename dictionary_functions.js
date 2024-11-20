const Units_Object = require('./units_obj');

function upsert_dictionary(domain_obj, full_units_dictionary) {
    Object.entries(full_units_dictionary).forEach(([device_serial, unit_data]) => {
        domain_obj.upsert(unit_data); 
    });
}


function delete_all_units_from_dictionary(units_obj) {
    for (const domain in units_obj) {
        if (units_obj[domain] instanceof Units_Object) {
            units_obj[domain].units = [];
            console.log(`Deleted all units from domain ${domain} in dictionary.`);
        }
    }
    console.log("Deleted all units from dictionary.");
}

module.exports = {
    delete_all_units_from_dictionary,
    upsert_dictionary
};
