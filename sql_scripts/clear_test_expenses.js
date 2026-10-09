const path = require('path');
const mysql = require(path.join(__dirname, '..', 'webapp', 'node_modules', 'mysql2', 'promise'));
require(path.join(__dirname, '..', 'webapp', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'webapp', '.env') });

async function clearExpenseData() {
  console.log('Connecting to TiDB Cloud database: ChaudryMessDB...');

  const ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  };

  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: parseInt(process.env.DB_PORT || '4000', 10),
      user: process.env.DB_USER || '3YVo31KzxKYfe1q.root',
      password: process.env.DB_PASSWORD || 'n46M8KNMHV60dTMP',
      database: process.env.DB_NAME || 'ChaudryMessDB',
      ssl: ssl
    });

    console.log('Connected to TiDB Cloud successfully.');

    // 1. Check current counts
    const [expCount] = await conn.query('SELECT COUNT(*) as count FROM Expenses;');
    const [shareCount] = await conn.query('SELECT COUNT(*) as count FROM ExpenseShares;');
    const [payerCount] = await conn.query('SELECT COUNT(*) as count FROM ExpensePayers;');
    const [personCount] = await conn.query('SELECT COUNT(*) as count FROM Persons;');
    const [userCount] = await conn.query('SELECT COUNT(*) as count FROM AppUser;');

    console.log(`Before cleanup:`);
    console.log(`- Expenses: ${expCount[0].count}`);
    console.log(`- ExpenseShares: ${shareCount[0].count}`);
    console.log(`- ExpensePayers: ${payerCount[0].count}`);
    console.log(`- Persons (Members): ${personCount[0].count}`);
    console.log(`- AppUsers: ${userCount[0].count}`);

    // 2. Clear Expense data only (ExpensePayers, ExpenseShares, Expenses)
    console.log('\nClearing test expense records...');
    await conn.query('DELETE FROM ExpensePayers;');
    await conn.query('DELETE FROM ExpenseShares;');
    await conn.query('DELETE FROM Expenses;');

    // 3. Verify
    const [expCountAfter] = await conn.query('SELECT COUNT(*) as count FROM Expenses;');
    const [shareCountAfter] = await conn.query('SELECT COUNT(*) as count FROM ExpenseShares;');
    const [payerCountAfter] = await conn.query('SELECT COUNT(*) as count FROM ExpensePayers;');
    const [personList] = await conn.query('SELECT id, name, mobileNumber, isActive FROM Persons;');
    const [userList] = await conn.query('SELECT id, username, role, shopName FROM AppUser;');

    console.log(`\nAfter cleanup:`);
    console.log(`- Expenses remaining: ${expCountAfter[0].count}`);
    console.log(`- ExpenseShares remaining: ${shareCountAfter[0].count}`);
    console.log(`- ExpensePayers remaining: ${payerCountAfter[0].count}`);
    console.log(`\nPreserved Master Data:`);
    console.log(`- AppUsers:`, userList);
    console.log(`- Persons (Members):`, personList);

    await conn.end();
    console.log('\nTest expenses successfully cleared. Master data preserved 100%!');
    process.exit(0);
  } catch (err) {
    console.error('Error clearing expense data:', err.message);
    process.exit(1);
  }
}

clearExpenseData();
