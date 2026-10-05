const path = require('path');
const fs = require('fs');
const mysql = require(path.join(__dirname, '..', 'webapp', 'node_modules', 'mysql2', 'promise'));
require(path.join(__dirname, '..', 'webapp', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'webapp', '.env') });

async function testTiDBConnection() {
  console.log('Testing connection to TiDB Cloud...');
  console.log('Host:', process.env.DB_HOST);
  console.log('User:', process.env.DB_USER);
  console.log('Port:', process.env.DB_PORT);

  const ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  };

  try {
    // 1. Initial connection (without specifying database, in case ChaudryMessDB doesn't exist yet)
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '4000', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: ssl
    });

    console.log(' Successfully connected to TiDB Cloud gateway!');
    const [ver] = await conn.query('SELECT VERSION() as version');
    console.log(' TiDB Server Version:', ver[0].version);

    // 2. Create ChaudryMessDB database if it doesn't exist
    console.log(' Creating/Verifying database [ChaudryMessDB]...');
    await conn.query('CREATE DATABASE IF NOT EXISTS `ChaudryMessDB` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    await conn.query('USE `ChaudryMessDB`;');
    console.log(' Database [ChaudryMessDB] selected.');

    // 3. Run schema creation
    const schemaSql = fs.readFileSync(path.join(__dirname, 'tidb_schema.sql'), 'utf8');
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE ') && !s.startsWith('CREATE DATABASE'));

    for (const stmt of statements) {
      if (stmt.length > 5) {
        await conn.query(stmt);
      }
    }
    console.log(' All tables and initial seed data created in TiDB!');

    // 4. Verify tables
    const [tables] = await conn.query('SHOW TABLES;');
    console.log(' Tables in ChaudryMessDB:', tables.map(t => Object.values(t)[0]));

    const [users] = await conn.query('SELECT id, username, role, shopName FROM AppUser;');
    console.log(' AppUsers in database:', users);

    await conn.end();
    console.log(' TiDB Cloud Test & Setup completed 100% successfully!');
    process.exit(0);
  } catch (err) {
    console.error(' TiDB Connection/Setup Error:', err.message);
    process.exit(1);
  }
}

testTiDBConnection();
