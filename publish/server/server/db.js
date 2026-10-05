const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'expense_user',
  password: process.env.DB_PASSWORD || 'ExpensePass@123',
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'ChaudryMessDB',
  options: {
    encrypt: false, // Required for SQL Server 2014 local instance
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config)
      .then(pool => {
        console.log(`Connected to Microsoft SQL Server 2014 database: [${config.database}] on [${config.server}:${config.port}]`);
        return pool;
      })
      .catch(err => {
        console.error('Database connection failed:', err);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

module.exports = {
  sql,
  getPool
};
