const path = require('path');
const fs = require('fs');
const sql = require(path.join(__dirname, '..', 'webapp', 'node_modules', 'mssql'));
require(path.join(__dirname, '..', 'webapp', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'webapp', '.env') });

async function takeBackup() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER || 'expense_user',
      password: process.env.DB_PASSWORD || 'ExpensePass@123',
      server: process.env.DB_SERVER || 'localhost',
      database: 'master',
      options: { encrypt: false, trustServerCertificate: true }
    });

    const backupDir = path.join(__dirname, '..', 'database_backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, 'ChaudryMessDB.bak');

    console.log('Backing up ChaudryMessDB to:', backupFile);
    await pool.request().input('path', sql.NVarChar(500), backupFile)
      .query("BACKUP DATABASE [ChaudryMessDB] TO DISK = @path WITH FORMAT, INIT, NAME = 'Full Backup of ChaudryMessDB'");
    
    console.log('Backup completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  }
}

takeBackup();
