const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbType = (process.env.DB_TYPE || (process.env.DB_PORT == '1433' ? 'mssql' : 'tidb')).toLowerCase();

let poolInstance = null;

// =============================================================================
// TiDB / MySQL Adapter Implementation
// =============================================================================
const mysql = require('mysql2/promise');

// Build TiDB SSL Configuration
function getTiDBSSLConfig() {
  const sslMode = (process.env.DB_SSL || process.env.DB_SSL_MODE || 'true').toString().toLowerCase();
  if (sslMode === 'false' || sslMode === '0' || sslMode === 'disabled') {
    return false;
  }
  const caPath = process.env.DB_SSL_CA;
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

  const sslOptions = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: rejectUnauthorized
  };

  if (caPath && fs.existsSync(caPath)) {
    sslOptions.ca = fs.readFileSync(caPath);
  }

  return sslOptions;
}

// SQL Transformation helper for TiDB / MySQL compatibility
function transformSqlForTiDB(sqlQuery, inputs) {
  let query = sqlQuery;

  // 1. Remove dbo. prefix
  query = query.replace(/\bdbo\./gi, '');

  // 2. Replace SYSUTCDATETIME() / GETUTCDATE() with UTC_TIMESTAMP()
  query = query.replace(/\bSYSUTCDATETIME\(\)/gi, 'UTC_TIMESTAMP()');
  query = query.replace(/\bGETUTCDATE\(\)/gi, 'UTC_TIMESTAMP()');

  // 3. Transform SELECT TOP N to LIMIT N
  query = query.replace(/SELECT\s+TOP\s+(\d+)\s+(.+?)\s+FROM/i, (match, topCount, columns) => {
    return `SELECT ${columns} FROM`;
  });
  if (/SELECT\s+TOP\s+(\d+)/i.test(sqlQuery) && !/LIMIT\s+\d+/i.test(query)) {
    const match = sqlQuery.match(/SELECT\s+TOP\s+(\d+)/i);
    if (match) {
      query += ` LIMIT ${match[1]}`;
    }
  }

  // 4. Remove OUTPUT INSERTED.*
  query = query.replace(/\s+OUTPUT\s+INSERTED\.\w+/gi, '');

  // 5. Parameter replacements: match @paramName and replace with ? in order
  const values = [];
  const paramRegex = /@([a-zA-Z0-9_]+)/g;
  let hasNamedParams = false;

  const replacedQuery = query.replace(paramRegex, (match, paramName) => {
    hasNamedParams = true;
    if (inputs && Object.prototype.hasOwnProperty.call(inputs, paramName)) {
      values.push(inputs[paramName].value);
    } else {
      values.push(null);
    }
    return '?';
  });

  return {
    sql: hasNamedParams ? replacedQuery : query,
    values: hasNamedParams ? values : []
  };
}

class TiDBRequest {
  constructor(executor) {
    this.executor = executor; // either pool or connection
    this.inputs = {};
  }

  input(name, typeOrValue, value) {
    // Supports: .input('id', sql.Int, 5) OR .input('id', 5)
    const val = value !== undefined ? value : typeOrValue;
    this.inputs[name] = { value: val };
    return this;
  }

  async query(sqlText) {
    const { sql: formattedSql, values } = transformSqlForTiDB(sqlText, this.inputs);
    const [rows, fields] = await this.executor.query(formattedSql, values);

    let recordset = [];
    let insertId = null;
    let affectedRows = 0;

    if (Array.isArray(rows)) {
      recordset = rows;
    } else if (rows && typeof rows === 'object') {
      affectedRows = rows.affectedRows || 0;
      insertId = rows.insertId || null;
      if (insertId) {
        recordset = [{ id: insertId, ...rows }];
      }
    }

    return {
      recordset,
      recordsets: [recordset],
      rowsAffected: [affectedRows],
      insertId
    };
  }
}

class TiDBTransaction {
  constructor(pool) {
    this.pool = pool;
    this.connection = null;
    this._acquiredConnection = false;
  }

  async begin() {
    this.connection = await this.pool.getConnection();
    this._acquiredConnection = true;
    await this.connection.beginTransaction();
  }

  async commit() {
    if (this.connection) {
      await this.connection.commit();
      this.connection.release();
      this.connection = null;
      this._acquiredConnection = false;
    }
  }

  async rollback() {
    if (this.connection) {
      try {
        await this.connection.rollback();
      } catch (e) {
        // ignore rollback error on closed conn
      }
      this.connection.release();
      this.connection = null;
      this._acquiredConnection = false;
    }
  }
}

class TiDBPoolWrapper {
  constructor(pool, config) {
    this.pool = pool;
    this.config = config;
  }

  request() {
    return new TiDBRequest(this.pool);
  }

  async getConnection() {
    return await this.pool.getConnection();
  }
}

// SQL Type Mock to maintain syntax compatibility: sql.Int, sql.NVarChar, etc.
const sql = {
  Int: 'INT',
  BigInt: 'BIGINT',
  Decimal: (p, s) => `DECIMAL(${p},${s})`,
  NVarChar: (len) => `VARCHAR(${len})`,
  VarChar: (len) => `VARCHAR(${len})`,
  Bit: 'TINYINT',
  DateTime: 'DATETIME',
  DateTime2: 'DATETIME',
  Transaction: class {
    constructor(pool) {
      return new TiDBTransaction(pool.pool || pool);
    }
  },
  Request: class {
    constructor(transactionOrPool) {
      if (transactionOrPool && transactionOrPool.connection) {
        return new TiDBRequest(transactionOrPool.connection);
      }
      return new TiDBRequest(transactionOrPool.pool || transactionOrPool);
    }
  }
};

async function createTiDBPool() {
  const host = process.env.DB_HOST || process.env.DB_SERVER || 'localhost';
  const port = parseInt(process.env.DB_PORT || '4000', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || process.env.DB_DATABASE || 'ChaudryMessDB';
  const ssl = getTiDBSSLConfig();

  console.log(`----------------------------------------------------`);
  console.log(` Initializing TiDB / MySQL Database Connection...`);
  console.log(` Host     : ${host}:${port}`);
  console.log(` Database : ${database}`);
  console.log(` User     : ${user}`);
  console.log(` SSL Mode : ${ssl ? 'Enabled (Secure TLS)' : 'Disabled'}`);
  console.log(`----------------------------------------------------`);

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    ssl,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    decimalNumbers: true,
    timezone: '+00:00'
  });

  // Verify connection
  const conn = await pool.getConnection();
  const [versionRes] = await conn.query('SELECT VERSION() AS ver, DATABASE() AS db');
  conn.release();

  console.log(` Connected to TiDB / MySQL successfully! Version: ${versionRes[0].ver}`);

  // Ensure tables exist on startup
  await initTiDBTables(pool);

  return new TiDBPoolWrapper(pool, { host, port, user, database });
}

// Auto-create TiDB tables on startup if they don't exist
async function initTiDBTables(pool) {
  try {
    // 1. AppUser
    await pool.query(`
      CREATE TABLE IF NOT EXISTS AppUser (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        shopName VARCHAR(200) NOT NULL DEFAULT 'Chaudry Mess System',
        passwordHash VARCHAR(255) NOT NULL,
        passwordSalt VARCHAR(255) NOT NULL,
        shopAddress VARCHAR(500) NOT NULL DEFAULT '',
        hasLoggedInOnce TINYINT(1) NOT NULL DEFAULT 0,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Persons
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Persons (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        mobileNumber VARCHAR(50) NOT NULL DEFAULT '',
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX IX_Persons_Name (name),
        INDEX IX_Persons_IsActive (isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Expenses
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Expenses (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        expenseDate BIGINT NOT NULL,
        description VARCHAR(500) NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        paidByPersonId BIGINT NOT NULL,
        category VARCHAR(50) NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX IX_Expenses_Date (expenseDate),
        INDEX IX_Expenses_PaidBy (paidByPersonId),
        INDEX IX_Expenses_Category (category),
        CONSTRAINT FK_Expenses_PaidBy FOREIGN KEY (paidByPersonId) REFERENCES Persons (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. ExpenseShares
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ExpenseShares (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        expenseId BIGINT NOT NULL,
        personId BIGINT NOT NULL,
        shareAmount DECIMAL(18,2) NOT NULL,
        INDEX IX_ExpenseShares_Expense (expenseId),
        INDEX IX_ExpenseShares_Person (personId),
        CONSTRAINT FK_ExpenseShares_Expense FOREIGN KEY (expenseId) REFERENCES Expenses (id) ON DELETE CASCADE,
        CONSTRAINT FK_ExpenseShares_Person FOREIGN KEY (personId) REFERENCES Persons (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. ExpensePayers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ExpensePayers (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        expenseId BIGINT NOT NULL,
        personId BIGINT NOT NULL,
        amountPaid DECIMAL(18,2) NOT NULL,
        INDEX IX_ExpensePayers_Expense (expenseId),
        INDEX IX_ExpensePayers_Person (personId),
        CONSTRAINT FK_ExpensePayers_Expense FOREIGN KEY (expenseId) REFERENCES Expenses (id) ON DELETE CASCADE,
        CONSTRAINT FK_ExpensePayers_Person FOREIGN KEY (personId) REFERENCES Persons (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. GoogleAccount
    await pool.query(`
      CREATE TABLE IF NOT EXISTS GoogleAccount (
        id INT NOT NULL PRIMARY KEY DEFAULT 1,
        email VARCHAR(255) NOT NULL DEFAULT '',
        lastBackupTimestamp BIGINT NULL,
        lastRestoreTimestamp BIGINT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default Admin and User if not present
    await pool.query(`
      INSERT INTO AppUser (id, username, shopName, passwordHash, passwordSalt, shopAddress, hasLoggedInOnce, role)
      VALUES 
      (1, 'admin', 'Chaudry Mess System', 'c0cb14de0ca2817bbf5a6b4be3a071e39c751d7d39f7a006712b43cf3b56028a', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'Main Road, Lahore', 0, 'admin')
      ON DUPLICATE KEY UPDATE id=id;
    `);

    await pool.query(`
      INSERT INTO AppUser (id, username, shopName, passwordHash, passwordSalt, shopAddress, hasLoggedInOnce, role)
      VALUES 
      (2, 'user', 'Chaudry Mess System', '7856b764ca46162fa6ec593d7c4ba4a8d56b07f9ed2089f55c70fa7dedb84558', 'd7cf84e77be767536cdd17d57dc719e6', '', 1, 'user')
      ON DUPLICATE KEY UPDATE id=id;
    `);

    await pool.query(`
      INSERT INTO GoogleAccount (id, email, lastBackupTimestamp, lastRestoreTimestamp)
      VALUES (1, 'chaudrymess@gmail.com', NULL, NULL)
      ON DUPLICATE KEY UPDATE id=id;
    `);

    console.log(' TiDB tables & seed records verified successfully.');
  } catch (err) {
    console.error(' Error initializing TiDB tables:', err.message);
  }
}

async function getPool() {
  if (!poolInstance) {
    poolInstance = await createTiDBPool();
  }
  return poolInstance;
}

module.exports = {
  sql,
  getPool
};
