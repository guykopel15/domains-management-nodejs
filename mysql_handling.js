const mysql = require('mysql2');

function create_mysql_connection(mysql_host) {
    return mysql.createConnection({
        host: mysql_host,
        user: 'safehouse_man',
        password: 'Ofer0223',
        database: 'SafeHouseDB1'
    });
};

const SELECT_ALL_UNITS = 'SELECT * FROM Units';
function fetch_units_from_specific_sql_domain(mysql_host) {
    const sql_connection = create_mysql_connection(mysql_host);
    const mysql_db_units = execute_query(sql_connection, SELECT_ALL_UNITS);
    return mysql_db_units;
}

const SELECT_ALL_LOCAL_ID = 'select u.DeviceSerial, l.Name, l.ID, a.Address from Units as u inner join Locations as l on u.LocationID = l.ID inner join Addresses as a on a.ID = l.AddressID';
function fetch_ids_and_addresses_from_specific_sql_domain(mysql_host) {
    const sql_connection = create_mysql_connection(mysql_host);
    const mysql_db_units = execute_query(sql_connection, SELECT_ALL_LOCAL_ID);
    return mysql_db_units;
}

function execute_query(connection, query) {
    return new Promise((resolve, reject) => {
        connection.query(query, (err, results) => {
            if (err) {
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    console.log(`Table does not exist: ${err.sqlMessage}`);
                    return resolve([]);
                }
                return reject(err);
            }

            resolve(results);
        });
    });
};

module.exports = {
    fetch_units_from_specific_sql_domain,
    fetch_ids_and_addresses_from_specific_sql_domain
};