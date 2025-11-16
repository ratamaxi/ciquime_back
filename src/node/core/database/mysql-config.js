const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '45.227.162.66',
  port: 3306,
  user: 'maxii',
  password: 'L@4zgmwR6J',
  database: 'test_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;