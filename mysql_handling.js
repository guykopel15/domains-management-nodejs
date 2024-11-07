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

function execute_query(connection, query) {
    return new Promise((resolve, reject) => {
        connection.query(query, (err, results) => {
            if (err)
                return reject(err);

            resolve(results);
        });
    });
};

module.exports = {
    fetch_units_from_specific_sql_domain
};