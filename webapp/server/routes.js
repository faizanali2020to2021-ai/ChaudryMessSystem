const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getPool, sql } = require('./db');
const { generateSalt, hash, verify } = require('./passwordHasher');
const { splitEqually } = require('./equalSplit');
const { computeSettlements } = require('./settlement');

// -----------------------------------------------------------------------------
// Auth & Identity
// -----------------------------------------------------------------------------

// POST /api/auth/login (supports username 'admin' or 'user')
router.post('/auth/login', async (req, res) => {
  try {
    const { username = 'admin', password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar(100), (username || 'admin').trim())
      .query('SELECT TOP 1 * FROM dbo.AppUser WHERE LOWER(username) = LOWER(@username)');
    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ success: false, message: `User '${username}' not found` });
    }

    const isValid = verify(password, user.passwordSalt, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    if (!user.hasLoggedInOnce) {
      await pool.request()
        .input('id', sql.Int, user.id)
        .query('UPDATE dbo.AppUser SET hasLoggedInOnce = 1, updatedAt = SYSUTCDATETIME() WHERE id = @id');
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'user',
        shopName: user.shopName,
        shopAddress: user.shopAddress,
        hasLoggedInOnce: true
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/system-info (Public info for initial login screen)
router.get('/auth/system-info', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT TOP 1 shopName, shopAddress FROM dbo.AppUser ORDER BY id ASC');
    const row = result.recordset[0] || { shopName: 'Chaudry Mess System', shopAddress: '' };
    res.json({ success: true, shopName: row.shopName, shopAddress: row.shopAddress });
  } catch (err) {
    res.json({ success: true, shopName: 'Chaudry Mess System', shopAddress: '' });
  }
});

// GET /api/auth/user
router.get('/auth/user', async (req, res) => {
  try {
    const username = req.headers['x-username'] || req.query.username;
    if (!username) {
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar(100), username.trim())
      .query('SELECT id, username, role, shopName, shopAddress, hasLoggedInOnce FROM dbo.AppUser WHERE LOWER(username) = LOWER(@username)');
    const user = result.recordset[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/change-password
router.post('/auth/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const username = (req.body.username || req.headers['x-username'] || 'admin').trim();
    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar(100), username)
      .query('SELECT TOP 1 * FROM dbo.AppUser WHERE LOWER(username) = LOWER(@username)');
    const user = result.recordset[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!verify(currentPassword, user.passwordSalt, user.passwordHash)) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const newSalt = generateSalt();
    const newHash = hash(newPassword, newSalt);

    await pool.request()
      .input('hash', sql.NVarChar(255), newHash)
      .input('salt', sql.NVarChar(255), newSalt)
      .input('id', sql.Int, user.id)
      .query('UPDATE dbo.AppUser SET passwordHash = @hash, passwordSalt = @salt, updatedAt = SYSUTCDATETIME() WHERE id = @id');

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/shop-identity (Update Company / Shop Name and Address)
router.post('/auth/shop-identity', async (req, res) => {
  try {
    const role = (req.headers['x-user-role'] || req.body.role || '').toLowerCase();
    if (role === 'user') {
      return res.status(403).json({ success: false, message: 'Permission denied: Only Admin can change company/shop identity.' });
    }

    const { shopName, address } = req.body;
    if (!shopName || !shopName.trim()) {
      return res.status(400).json({ success: false, message: 'Company / Shop name is required' });
    }

    const pool = await getPool();
    // Update all AppUser records (admin & user) with the new company name and address
    await pool.request()
      .input('name', sql.NVarChar(200), shopName.trim())
      .input('address', sql.NVarChar(500), (address || '').trim())
      .query(`
        UPDATE dbo.AppUser 
        SET shopName = @name, shopAddress = @address, updatedAt = SYSUTCDATETIME()
      `);

    // Dual-sync with FoodExpenseManagerDB if exists
    try {
      await pool.request()
        .input('name', sql.NVarChar(200), shopName.trim())
        .input('address', sql.NVarChar(500), (address || '').trim())
        .query(`
          IF OBJECT_ID('FoodExpenseManagerDB.dbo.AppUser', 'U') IS NOT NULL
          BEGIN
            UPDATE FoodExpenseManagerDB.dbo.AppUser 
            SET shopName = @name, shopAddress = @address, updatedAt = SYSUTCDATETIME()
          END
        `);
    } catch (syncErr) {
      console.warn('Dual-sync notice on shop-identity:', syncErr.message);
    }

    res.json({
      success: true,
      shopName: shopName.trim(),
      shopAddress: (address || '').trim(),
      message: 'Company / Shop details updated successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/shop-address (legacy alias)
router.post('/auth/shop-address', async (req, res) => {
  try {
    const { address, shopName } = req.body;
    const pool = await getPool();
    if (shopName) {
      await pool.request()
        .input('name', sql.NVarChar(200), shopName.trim())
        .input('address', sql.NVarChar(500), address || '')
        .query('UPDATE dbo.AppUser SET shopName = @name, shopAddress = @address, updatedAt = SYSUTCDATETIME()');
    } else {
      await pool.request()
        .input('address', sql.NVarChar(500), address || '')
        .query('UPDATE dbo.AppUser SET shopAddress = @address, updatedAt = SYSUTCDATETIME()');
    }

    res.json({ success: true, message: 'Shop details updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Persons Management
// -----------------------------------------------------------------------------

// GET /api/persons (active persons ordered by name)
router.get('/persons', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT id, name, mobileNumber, isActive FROM dbo.Persons WHERE isActive = 1 ORDER BY name ASC');
    res.json({ success: true, persons: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/persons
router.post('/persons', async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Person name is required' });
    }
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar(150), name.trim())
      .input('mobile', sql.NVarChar(50), (mobileNumber || '').trim())
      .query('INSERT INTO dbo.Persons (name, mobileNumber, isActive) OUTPUT INSERTED.id VALUES (@name, @mobile, 1)');

    const newId = result.recordset[0].id;

    // Dual-sync to FoodExpenseManagerDB if database exists
    try {
      await pool.request()
        .input('id', sql.Int, Number(newId))
        .input('name', sql.NVarChar(100), name.trim())
        .input('mobile', sql.NVarChar(20), (mobileNumber || '').trim())
        .query(`
          IF EXISTS (SELECT 1 FROM sys.databases WHERE name = 'FoodExpenseManagerDB')
          BEGIN
            SET IDENTITY_INSERT FoodExpenseManagerDB.dbo.Persons ON;
            INSERT INTO FoodExpenseManagerDB.dbo.Persons (PersonId, FullName, PhoneNumber, CreatedDate, IsActive)
            VALUES (@id, @name, @mobile, GETDATE(), 1);
            SET IDENTITY_INSERT FoodExpenseManagerDB.dbo.Persons OFF;
          END
        `);
    } catch (syncErr) {
      console.warn('FoodExpenseManagerDB sync notice:', syncErr.message);
    }

    res.json({ success: true, id: newId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/persons/:id
router.put('/persons/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, mobileNumber } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Person name is required' });
    }
    const pool = await getPool();
    await pool.request()
      .input('id', sql.BigInt, id)
      .input('name', sql.NVarChar(150), name.trim())
      .input('mobile', sql.NVarChar(50), (mobileNumber || '').trim())
      .query('UPDATE dbo.Persons SET name = @name, mobileNumber = @mobile WHERE id = @id');

    // Dual-sync to FoodExpenseManagerDB if database exists
    try {
      await pool.request()
        .input('id', sql.Int, Number(id))
        .input('name', sql.NVarChar(100), name.trim())
        .input('mobile', sql.NVarChar(20), (mobileNumber || '').trim())
        .query(`
          IF EXISTS (SELECT 1 FROM sys.databases WHERE name = 'FoodExpenseManagerDB')
          BEGIN
            UPDATE FoodExpenseManagerDB.dbo.Persons
            SET FullName = @name, PhoneNumber = @mobile
            WHERE PersonId = @id;
          END
        `);
    } catch (syncErr) {
      console.warn('FoodExpenseManagerDB sync update notice:', syncErr.message);
    }

    res.json({ success: true, message: 'Person updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/persons/:id/check-delete
router.get('/persons/:id/check-delete', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();

    const pRes = await pool.request().input('id', sql.BigInt, id).query('SELECT name FROM dbo.Persons WHERE id = @id');
    if (pRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Person not found' });
    }
    const personName = pRes.recordset[0].name;

    const countReq = pool.request().input('id', sql.BigInt, id);
    const paidCountRes = await countReq.query('SELECT COUNT(*) AS c FROM dbo.Expenses WHERE paidByPersonId = @id');
    const shareCountRes = await countReq.query('SELECT COUNT(*) AS c FROM dbo.ExpenseShares WHERE personId = @id');

    const paidCount = paidCountRes.recordset[0].c;
    const shareCount = shareCountRes.recordset[0].c;
    const hasData = paidCount > 0 || shareCount > 0;

    res.json({
      success: true,
      id,
      name: personName,
      hasData,
      canDelete: !hasData,
      paidCount,
      shareCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/persons/:id (strict: do NOT delete if data exists)
router.delete('/persons/:id', async (req, res) => {
  try {
    const role = (req.headers['x-user-role'] || req.query.role || '').toLowerCase();
    if (role === 'user') {
      return res.status(403).json({ success: false, message: 'Permission denied: Users cannot delete members. Only Admin can delete.' });
    }
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();

    const pRes = await pool.request().input('id', sql.BigInt, id).query('SELECT name FROM dbo.Persons WHERE id = @id');
    if (pRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Person not found' });
    }
    const personName = pRes.recordset[0].name;

    const countReq = pool.request().input('id', sql.BigInt, id);
    const paidCountRes = await countReq.query('SELECT COUNT(*) AS c FROM dbo.Expenses WHERE paidByPersonId = @id');
    const shareCountRes = await countReq.query('SELECT COUNT(*) AS c FROM dbo.ExpenseShares WHERE personId = @id');

    const paidCount = paidCountRes.recordset[0].c;
    const shareCount = shareCountRes.recordset[0].c;

    if (paidCount > 0 || shareCount > 0) {
      return res.status(400).json({
        success: false,
        cannotDelete: true,
        paidCount,
        shareCount,
        message: `Cannot delete "${personName}" because active data exists (${paidCount} expense(s) paid, ${shareCount} expense share(s)). Records cannot be deleted while data exists.`
      });
    }

    // Only delete if zero history
    await pool.request().input('id', sql.BigInt, id).query('DELETE FROM dbo.Persons WHERE id = @id');
    try {
      await pool.request().input('id', sql.Int, Number(id)).query(`
        IF EXISTS (SELECT 1 FROM sys.databases WHERE name = 'FoodExpenseManagerDB')
        BEGIN
          DELETE FROM FoodExpenseManagerDB.dbo.Persons WHERE PersonId = @id;
        END
      `);
    } catch (syncDelErr) {
      console.warn('FoodExpenseManagerDB sync delete notice:', syncDelErr.message);
    }

    res.json({ success: true, message: `"${personName}" has been deleted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Dashboard & Summary
// -----------------------------------------------------------------------------

// GET /api/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const pool = await getPool();

    // 1. Total expense
    const totalExpRes = await pool.request().query('SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM dbo.Expenses');
    const totalExpense = parseFloat(totalExpRes.recordset[0].totalExpense) || 0;

    // 2. Person balances (active persons)
    const balancesQuery = `
      SELECT p.id AS personId, p.name AS personName, p.mobileNumber AS mobileNumber,
             COALESCE(paid.total, 0) AS totalPaid,
             COALESCE(share.total, 0) AS totalShare
      FROM dbo.Persons p
      LEFT JOIN (
          SELECT personId AS pid, SUM(amountPaid) AS total
          FROM dbo.ExpensePayers GROUP BY personId
      ) paid ON paid.pid = p.id
      LEFT JOIN (
          SELECT personId AS pid, SUM(shareAmount) AS total
          FROM dbo.ExpenseShares GROUP BY personId
      ) share ON share.pid = p.id
      WHERE p.isActive = 1
      ORDER BY p.name ASC
    `;
    const balancesRes = await pool.request().query(balancesQuery);

    const personBalances = balancesRes.recordset.map(row => {
      const paid = parseFloat(row.totalPaid) || 0;
      const share = parseFloat(row.totalShare) || 0;
      return {
        personId: row.personId,
        personName: row.personName,
        mobileNumber: row.mobileNumber || '',
        totalPaid: paid,
        totalShare: share,
        remainingBalance: Math.round((paid - share) * 100) / 100
      };
    });

    const totalPaid = personBalances.reduce((sum, b) => sum + b.totalPaid, 0);

    res.json({
      success: true,
      overallSummary: {
        totalExpense,
        totalPaid
      },
      personBalances
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Expenses (List, Add, Edit, Delete)
// -----------------------------------------------------------------------------

// GET /api/expenses (search, filter, sort)
router.get('/expenses', async (req, res) => {
  try {
    const { searchQuery, personId, fromMillis, toMillis, sortBy } = req.query;
    const pool = await getPool();

    let query = `
      SELECT e.id AS id, e.expenseDate AS date, e.description AS description, e.amount AS amount,
             e.paidByPersonId AS paidByPersonId, p.name AS paidByName, e.category AS category
      FROM dbo.Expenses e
      JOIN dbo.Persons p ON p.id = e.paidByPersonId
      WHERE 1=1
    `;

    const request = pool.request();

    if (searchQuery && searchQuery.trim()) {
      request.input('search', sql.NVarChar(200), `%${searchQuery.trim()}%`);
      query += ` AND (e.description LIKE @search OR p.name LIKE @search)`;
    }

    if (personId && !isNaN(parseInt(personId, 10))) {
      request.input('personFilter', sql.BigInt, parseInt(personId, 10));
      query += ` AND e.paidByPersonId = @personFilter`;
    }

    if (fromMillis && toMillis) {
      request.input('fromM', sql.BigInt, parseInt(fromMillis, 10));
      request.input('toM', sql.BigInt, parseInt(toMillis, 10));
      query += ` AND e.expenseDate BETWEEN @fromM AND @toM`;
    }

    // Sort order
    switch (sortBy) {
      case 'date_asc':
        query += ` ORDER BY e.expenseDate ASC`;
        break;
      case 'amount_desc':
        query += ` ORDER BY e.amount DESC`;
        break;
      case 'amount_asc':
        query += ` ORDER BY e.amount ASC`;
        break;
      case 'date_desc':
      default:
        query += ` ORDER BY e.expenseDate DESC`;
        break;
    }

    const result = await request.query(query);
    res.json({ success: true, expenses: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/expenses/:id
router.get('/expenses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();

    const expRes = await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT e.id, e.expenseDate AS date, e.description, e.amount, e.paidByPersonId, e.category, p.name AS paidByName
        FROM dbo.Expenses e
        LEFT JOIN dbo.Persons p ON p.id = e.paidByPersonId
        WHERE e.id = @id
      `);

    if (expRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const sharesRes = await pool.request()
      .input('expenseId', sql.BigInt, id)
      .query(`
        SELECT s.id, s.personId, s.shareAmount, p.name AS personName
        FROM dbo.ExpenseShares s
        JOIN dbo.Persons p ON p.id = s.personId
        WHERE s.expenseId = @expenseId
      `);

    // Get payers from ExpensePayers table
    let payers = [];
    try {
      const payersRes = await pool.request()
        .input('expenseId', sql.BigInt, id)
        .query(`
          SELECT ep.personId, ep.amountPaid, p.name AS personName
          FROM dbo.ExpensePayers ep
          JOIN dbo.Persons p ON p.id = ep.personId
          WHERE ep.expenseId = @expenseId
        `);
      payers = payersRes.recordset;
    } catch (e) { /* Table may not exist yet */ }

    res.json({
      success: true,
      expense: expRes.recordset[0],
      shares: sharesRes.recordset,
      payers
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/expenses
router.post('/expenses', async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const { dateMillis, description, amount, paidByPersonId, multiPayers,
            selectedPersonIds, customSplits, splitMode, category } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    }

    // Resolve payers list: multi-payer array OR single paidByPersonId
    let payers;
    if (Array.isArray(multiPayers) && multiPayers.length > 0) {
      payers = multiPayers.map(mp => ({ personId: Number(mp.personId), amountPaid: parseFloat(mp.amountPaid) }))
                         .filter(mp => mp.amountPaid > 0);
      if (payers.length === 0) {
        return res.status(400).json({ success: false, message: 'Enter at least one payer amount' });
      }
    } else {
      if (!paidByPersonId) {
        return res.status(400).json({ success: false, message: 'Select who paid' });
      }
      payers = [{ personId: Number(paidByPersonId), amountPaid: numAmount }];
    }
    // Primary payer (for backward compat column)
    const primaryPayer = payers[0].personId;

    // Resolve shares
    let shares;
    if (splitMode === 'custom' && Array.isArray(customSplits) && customSplits.length > 0) {
      shares = customSplits.map(s => ({ personId: Number(s.personId), shareAmount: parseFloat(s.shareAmount) }));
    } else {
      if (!selectedPersonIds || !Array.isArray(selectedPersonIds) || selectedPersonIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Select at least one person for the split' });
      }
      shares = splitEqually(numAmount, selectedPersonIds.map(Number));
    }

    const dateVal = dateMillis ? parseInt(dateMillis, 10) : Date.now();
    await transaction.begin();

    // Insert expense
    const insertExpReq = new sql.Request(transaction);
    insertExpReq.input('expenseDate', sql.BigInt, dateVal);
    insertExpReq.input('description', sql.NVarChar(500), description.trim());
    insertExpReq.input('amount', sql.Decimal(18, 2), numAmount);
    insertExpReq.input('paidByPersonId', sql.BigInt, primaryPayer);
    insertExpReq.input('category', sql.NVarChar(50), category || null);

    const expResult = await insertExpReq.query(`
      INSERT INTO dbo.Expenses (expenseDate, description, amount, paidByPersonId, category)
      OUTPUT INSERTED.id
      VALUES (@expenseDate, @description, @amount, @paidByPersonId, @category)
    `);
    const expenseId = expResult.recordset[0].id;

    // Insert payers into ExpensePayers
    for (const p of payers) {
      const pReq = new sql.Request(transaction);
      pReq.input('expenseId', sql.BigInt, expenseId);
      pReq.input('personId', sql.BigInt, p.personId);
      pReq.input('amountPaid', sql.Decimal(18, 2), p.amountPaid);
      await pReq.query(`INSERT INTO dbo.ExpensePayers (expenseId, personId, amountPaid) VALUES (@expenseId, @personId, @amountPaid)`);
    }

    // Insert shares
    for (const s of shares) {
      const shareReq = new sql.Request(transaction);
      shareReq.input('expenseId', sql.BigInt, expenseId);
      shareReq.input('personId', sql.BigInt, s.personId);
      shareReq.input('shareAmount', sql.Decimal(18, 2), s.shareAmount);
      await shareReq.query(`INSERT INTO dbo.ExpenseShares (expenseId, personId, shareAmount) VALUES (@expenseId, @personId, @shareAmount)`);
    }

    await transaction.commit();
    res.json({ success: true, expenseId, message: 'Expense added successfully' });
  } catch (err) {
    if (transaction._acquiredConnection) await transaction.rollback();
    console.error('Error adding expense:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/payments (Direct Member to Member Payment / Settlement Transfer)
router.post('/payments', async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const { dateMillis, description, amount, paidByPersonId, receivedByPersonId } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid payment amount' });
    }
    const payerId = parseInt(paidByPersonId, 10);
    const receiverId = parseInt(receivedByPersonId, 10);

    if (!payerId || isNaN(payerId)) {
      return res.status(400).json({ success: false, message: 'Select who paid (Paid By)' });
    }
    if (!receiverId || isNaN(receiverId)) {
      return res.status(400).json({ success: false, message: 'Select who received (Received By)' });
    }
    if (payerId === receiverId) {
      return res.status(400).json({ success: false, message: 'Payer and Receiver cannot be the same person' });
    }

    // Get names for default description
    const pNamesRes = await pool.request()
      .input('payerId', sql.BigInt, payerId)
      .input('receiverId', sql.BigInt, receiverId)
      .query('SELECT id, name FROM dbo.Persons WHERE id IN (@payerId, @receiverId)');
    
    let payerName = 'Member';
    let receiverName = 'Member';
    for (const r of pNamesRes.recordset) {
      if (r.id == payerId) payerName = r.name;
      if (r.id == receiverId) receiverName = r.name;
    }

    const desc = (description && description.trim()) ? description.trim() : `Payment from ${payerName} to ${receiverName}`;
    const dateVal = dateMillis ? parseInt(dateMillis, 10) : Date.now();

    await transaction.begin();

    // 1. Insert payment record in Expenses table with category = 'Payment'
    const insertExpReq = new sql.Request(transaction);
    insertExpReq.input('expenseDate', sql.BigInt, dateVal);
    insertExpReq.input('description', sql.NVarChar(500), desc);
    insertExpReq.input('amount', sql.Decimal(18, 2), numAmount);
    insertExpReq.input('paidByPersonId', sql.BigInt, payerId);
    insertExpReq.input('category', sql.NVarChar(50), 'Payment');

    const expResult = await insertExpReq.query(`
      INSERT INTO dbo.Expenses (expenseDate, description, amount, paidByPersonId, category)
      OUTPUT INSERTED.id
      VALUES (@expenseDate, @description, @amount, @paidByPersonId, @category)
    `);
    const expenseId = expResult.recordset[0].id;

    // 2. Insert into ExpensePayers (Payer gets credit -> increases totalPaid)
    const pReq = new sql.Request(transaction);
    pReq.input('expenseId', sql.BigInt, expenseId);
    pReq.input('personId', sql.BigInt, payerId);
    pReq.input('amountPaid', sql.Decimal(18, 2), numAmount);
    await pReq.query(`INSERT INTO dbo.ExpensePayers (expenseId, personId, amountPaid) VALUES (@expenseId, @personId, @amountPaid)`);

    // 3. Insert into ExpenseShares (Receiver gets debit -> increases totalShare / expense)
    const shareReq = new sql.Request(transaction);
    shareReq.input('expenseId', sql.BigInt, expenseId);
    shareReq.input('personId', sql.BigInt, receiverId);
    shareReq.input('shareAmount', sql.Decimal(18, 2), numAmount);
    await shareReq.query(`INSERT INTO dbo.ExpenseShares (expenseId, personId, shareAmount) VALUES (@expenseId, @personId, @shareAmount)`);

    await transaction.commit();
    res.json({ success: true, expenseId, message: 'Payment recorded successfully' });
  } catch (err) {
    if (transaction._acquiredConnection) await transaction.rollback();
    console.error('Error recording payment:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/expenses/:id
router.put('/expenses/:id', async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const expenseId = parseInt(req.params.id, 10);
    const { dateMillis, description, amount, paidByPersonId, multiPayers,
            selectedPersonIds, customSplits, splitMode, category } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    }

    // Resolve payers
    let payers;
    if (Array.isArray(multiPayers) && multiPayers.length > 0) {
      payers = multiPayers.map(mp => ({ personId: Number(mp.personId), amountPaid: parseFloat(mp.amountPaid) }))
                         .filter(mp => mp.amountPaid > 0);
      if (payers.length === 0) {
        return res.status(400).json({ success: false, message: 'Enter at least one payer amount' });
      }
    } else {
      if (!paidByPersonId) {
        return res.status(400).json({ success: false, message: 'Select who paid' });
      }
      payers = [{ personId: Number(paidByPersonId), amountPaid: numAmount }];
    }
    const primaryPayer = payers[0].personId;

    // Resolve shares
    let shares;
    if (splitMode === 'custom' && Array.isArray(customSplits) && customSplits.length > 0) {
      shares = customSplits.map(s => ({ personId: Number(s.personId), shareAmount: parseFloat(s.shareAmount) }));
    } else {
      if (!selectedPersonIds || !Array.isArray(selectedPersonIds) || selectedPersonIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Select at least one person for the split' });
      }
      shares = splitEqually(numAmount, selectedPersonIds.map(Number));
    }

    const dateVal = dateMillis ? parseInt(dateMillis, 10) : Date.now();
    await transaction.begin();

    // Update expense
    const updateReq = new sql.Request(transaction);
    updateReq.input('id', sql.BigInt, expenseId);
    updateReq.input('expenseDate', sql.BigInt, dateVal);
    updateReq.input('description', sql.NVarChar(500), description.trim());
    updateReq.input('amount', sql.Decimal(18, 2), numAmount);
    updateReq.input('paidByPersonId', sql.BigInt, primaryPayer);
    updateReq.input('category', sql.NVarChar(50), category || null);

    await updateReq.query(`
      UPDATE dbo.Expenses
      SET expenseDate = @expenseDate, description = @description, amount = @amount,
          paidByPersonId = @paidByPersonId, category = @category
      WHERE id = @id
    `);

    // Delete old payers and shares
    const delPayersReq = new sql.Request(transaction);
    delPayersReq.input('expenseId', sql.BigInt, expenseId);
    await delPayersReq.query('DELETE FROM dbo.ExpensePayers WHERE expenseId = @expenseId');

    const delReq = new sql.Request(transaction);
    delReq.input('expenseId', sql.BigInt, expenseId);
    await delReq.query('DELETE FROM dbo.ExpenseShares WHERE expenseId = @expenseId');

    // Insert new payers
    for (const p of payers) {
      const pReq = new sql.Request(transaction);
      pReq.input('expenseId', sql.BigInt, expenseId);
      pReq.input('personId', sql.BigInt, p.personId);
      pReq.input('amountPaid', sql.Decimal(18, 2), p.amountPaid);
      await pReq.query(`INSERT INTO dbo.ExpensePayers (expenseId, personId, amountPaid) VALUES (@expenseId, @personId, @amountPaid)`);
    }

    // Insert new shares
    for (const s of shares) {
      const shareReq = new sql.Request(transaction);
      shareReq.input('expenseId', sql.BigInt, expenseId);
      shareReq.input('personId', sql.BigInt, s.personId);
      shareReq.input('shareAmount', sql.Decimal(18, 2), s.shareAmount);
      await shareReq.query(`INSERT INTO dbo.ExpenseShares (expenseId, personId, shareAmount) VALUES (@expenseId, @personId, @shareAmount)`);
    }

    await transaction.commit();
    res.json({ success: true, message: 'Expense updated successfully' });
  } catch (err) {
    if (transaction._acquiredConnection) await transaction.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
});



// DELETE /api/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
  try {
    const role = (req.headers['x-user-role'] || req.query.role || '').toLowerCase();
    if (role === 'user') {
      return res.status(403).json({ success: false, message: 'Permission denied: Users cannot delete expenses. Only Admin can delete.' });
    }
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    await pool.request()
      .input('id', sql.BigInt, id)
      .query('DELETE FROM dbo.Expenses WHERE id = @id');
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// The 6 Reports (Matching mobile app exactly)
// -----------------------------------------------------------------------------

// Helper to get shop identity for report headers
async function getShopIdentity(pool) {
  const res = await pool.request().query('SELECT shopName, shopAddress FROM dbo.AppUser WHERE id = 1');
  return res.recordset[0] || { shopName: 'Chaudry Mess System', shopAddress: '' };
}

// 1. Total Expense Report (date range)
router.get('/reports/total-expense', async (req, res) => {
  try {
    const { fromMillis, toMillis } = req.query;
    const fromM = parseInt(fromMillis, 10);
    const toM = parseInt(toMillis, 10);

    const pool = await getPool();
    const shop = await getShopIdentity(pool);

    const query = `
      SELECT e.id, e.expenseDate AS date, e.description, e.amount,
             e.paidByPersonId, p.name AS paidByName, e.category
      FROM dbo.Expenses e
      JOIN dbo.Persons p ON p.id = e.paidByPersonId
      WHERE e.expenseDate BETWEEN @fromM AND @toM
      ORDER BY e.expenseDate DESC
    `;

    const result = await pool.request()
      .input('fromM', sql.BigInt, fromM)
      .input('toM', sql.BigInt, toM)
      .query(query);

    const expenses = result.recordset;
    const totalExpense = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    res.json({
      success: true,
      shopName: shop.shopName,
      shopAddress: shop.shopAddress,
      fromMillis: fromM,
      toMillis: toM,
      totalExpense,
      totalTransactions: expenses.length,
      expenses
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Paid by Person Report (date range)
router.get('/reports/paid-by-person', async (req, res) => {
  try {
    const { fromMillis, toMillis } = req.query;
    const fromM = parseInt(fromMillis, 10);
    const toM = parseInt(toMillis, 10);

    const pool = await getPool();
    const shop = await getShopIdentity(pool);

    const query = `
      SELECT e.paidByPersonId AS personId, p.name AS personName, p.mobileNumber AS mobileNumber,
             SUM(e.amount) AS totalPaid
      FROM dbo.Expenses e
      JOIN dbo.Persons p ON p.id = e.paidByPersonId
      WHERE e.expenseDate BETWEEN @fromM AND @toM
      GROUP BY e.paidByPersonId, p.name, p.mobileNumber
      ORDER BY p.name ASC
    `;

    const result = await pool.request()
      .input('fromM', sql.BigInt, fromM)
      .input('toM', sql.BigInt, toM)
      .query(query);

    const totals = result.recordset.map(r => ({
      personId: r.personId,
      personName: r.personName,
      mobileNumber: r.mobileNumber || '',
      totalPaid: parseFloat(r.totalPaid) || 0
    }));

    const grandTotal = totals.reduce((sum, t) => sum + t.totalPaid, 0);

    res.json({
      success: true,
      shopName: shop.shopName,
      shopAddress: shop.shopAddress,
      fromMillis: fromM,
      toMillis: toM,
      totalMembers: totals.length,
      grandTotal,
      totals
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Individual Person Ledger Report (Summary card with Receivable/Payable)
router.get('/reports/person-ledger', async (req, res) => {
  try {
    const { personId } = req.query;
    const pId = parseInt(personId, 10);
    if (isNaN(pId)) return res.status(400).json({ success: false, message: 'Invalid personId' });

    const pool = await getPool();
    const shop = await getShopIdentity(pool);

    const query = `
      SELECT p.id AS personId, p.name AS personName, p.mobileNumber AS mobileNumber,
             COALESCE(paid.total, 0) AS totalPaid,
             COALESCE(share.total, 0) AS totalShare
      FROM dbo.Persons p
      LEFT JOIN (SELECT personId AS pid, SUM(amountPaid) AS total FROM dbo.ExpensePayers GROUP BY personId) paid ON paid.pid = p.id
      LEFT JOIN (SELECT personId AS pid, SUM(shareAmount) AS total FROM dbo.ExpenseShares GROUP BY personId) share ON share.pid = p.id
      WHERE p.id = @personId
    `;

    const result = await pool.request().input('personId', sql.BigInt, pId).query(query);
    const row = result.recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Person not found' });

    const totalPaid = parseFloat(row.totalPaid) || 0;
    const totalShare = parseFloat(row.totalShare) || 0;
    const remainingBalance = Math.round((totalPaid - totalShare) * 100) / 100;
    const isReceivable = remainingBalance >= 0;

    res.json({
      success: true,
      shopName: shop.shopName,
      shopAddress: shop.shopAddress,
      balance: {
        personId: row.personId,
        personName: row.personName,
        mobileNumber: row.mobileNumber || '',
        totalPaid,
        totalShare,
        remainingBalance,
        isReceivable
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Individual Person Detail Ledger Report (Every expense person shared in + split count + their share)
router.get('/reports/person-detail-ledger', async (req, res) => {
  try {
    const { personId } = req.query;
    const pId = parseInt(personId, 10);
    if (isNaN(pId)) return res.status(400).json({ success: false, message: 'Invalid personId' });

    const pool = await getPool();
    const shop = await getShopIdentity(pool);

    // Person info
    const pRes = await pool.request().input('id', sql.BigInt, pId).query('SELECT name, mobileNumber FROM dbo.Persons WHERE id = @id');
    const person = pRes.recordset[0];
    if (!person) return res.status(404).json({ success: false, message: 'Person not found' });

    // Person ledger rows matching ExpenseDao.getPersonLedgerDetail
    const detailQuery = `
      SELECT e.id AS expenseId, e.expenseDate AS date, e.description AS description, e.amount AS totalAmount,
             (SELECT COUNT(*) FROM dbo.ExpenseShares es2 WHERE es2.expenseId = e.id) AS dividedByCount,
             es.shareAmount AS yourShare
      FROM dbo.Expenses e
      JOIN dbo.ExpenseShares es ON es.expenseId = e.id
      WHERE es.personId = @personId
      ORDER BY e.expenseDate ASC
    `;

    const detailRes = await pool.request().input('personId', sql.BigInt, pId).query(detailQuery);
    const rows = detailRes.recordset.map(r => ({
      expenseId: r.expenseId,
      date: r.date,
      description: r.description,
      totalAmount: parseFloat(r.totalAmount) || 0,
      dividedByCount: parseInt(r.dividedByCount, 10) || 1,
      yourShare: parseFloat(r.yourShare) || 0
    }));

    // Total paid by this person overall
    const paidRes = await pool.request().input('personId', sql.BigInt, pId).query('SELECT COALESCE(SUM(amountPaid), 0) AS totalPaid FROM dbo.ExpensePayers WHERE personId = @personId');
    const totalPaid = parseFloat(paidRes.recordset[0].totalPaid) || 0;

    const yourTotalExpense = rows.reduce((sum, r) => sum + r.yourShare, 0);
    const remainingBalance = Math.round((totalPaid - yourTotalExpense) * 100) / 100;
    const isReceivable = remainingBalance >= 0;

    res.json({
      success: true,
      shopName: shop.shopName,
      shopAddress: shop.shopAddress,
      personName: person.name,
      mobileNumber: person.mobileNumber || '',
      rows,
      totalEntries: rows.length,
      yourTotalExpense: Math.round(yourTotalExpense * 100) / 100,
      totalPaid,
      remainingBalance,
      isReceivable
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Day-Wise Expense Report (Grouped by date, then category: Breakfast/Lunch/Dinner/Others)
router.get('/reports/day-wise', async (req, res) => {
  try {
    const { fromMillis, toMillis, personId } = req.query;
    const fromM = parseInt(fromMillis, 10);
    const toM = parseInt(toMillis, 10);
    const pId = personId && !isNaN(parseInt(personId, 10)) ? parseInt(personId, 10) : null;

    const pool = await getPool();
    const shop = await getShopIdentity(pool);

    let query = `
      SELECT e.id AS expenseId, e.expenseDate AS date, e.category AS category, e.amount AS amount,
             (SELECT COUNT(*) FROM dbo.ExpenseShares es2 WHERE es2.expenseId = e.id) AS dividedByCount
      FROM dbo.Expenses e
      WHERE e.category IS NOT NULL
        AND e.expenseDate BETWEEN @fromM AND @toM
    `;

    const request = pool.request()
      .input('fromM', sql.BigInt, fromM)
      .input('toM', sql.BigInt, toM);

    if (pId !== null) {
      request.input('personId', sql.BigInt, pId);
      query += ` AND EXISTS (SELECT 1 FROM dbo.ExpenseShares es WHERE es.expenseId = e.id AND es.personId = @personId)`;
    }

    query += ` ORDER BY e.expenseDate ASC`;

    const result = await request.query(query);
    const rows = result.recordset.map(r => ({
      expenseId: r.expenseId,
      date: Number(r.date),
      category: r.category,
      amount: parseFloat(r.amount) || 0,
      dividedByCount: parseInt(r.dividedByCount, 10) || 1
    }));

    // Group by start of day (midnight UTC / local day)
    function startOfDay(millis) {
      const d = new Date(millis);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }

    const dayMap = {};
    for (const row of rows) {
      const dayKey = startOfDay(row.date);
      if (!dayMap[dayKey]) dayMap[dayKey] = [];
      dayMap[dayKey].push(row);
    }

    const CATEGORY_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Others'];

    const groups = Object.keys(dayMap).sort((a, b) => Number(a) - Number(b)).map(dayKey => {
      const dayRows = dayMap[dayKey];
      const catMap = {};
      for (const r of dayRows) {
        if (!catMap[r.category]) catMap[r.category] = [];
        catMap[r.category].push(r);
      }

      const categories = Object.keys(catMap).map(category => {
        const catRows = catMap[category];
        const totalAmount = catRows.reduce((sum, r) => sum + r.amount, 0);
        const calculatedShare = catRows.reduce((sum, r) => sum + (r.amount / Math.max(1, r.dividedByCount)), 0);
        const effectivePersons = calculatedShare > 0 ? (totalAmount / calculatedShare) : catRows[0].dividedByCount;

        return {
          category,
          totalAmount: Math.round(totalAmount * 100) / 100,
          effectivePersons: Math.round(effectivePersons * 10) / 10,
          calculatedShare: Math.round(calculatedShare * 100) / 100
        };
      }).sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a.category);
        const idxB = CATEGORY_ORDER.indexOf(b.category);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });

      const dayTotal = categories.reduce((sum, c) => sum + c.totalAmount, 0);

      return {
        dateMillis: Number(dayKey),
        categories,
        dayTotal: Math.round(dayTotal * 100) / 100
      };
    });

    const grandTotal = groups.reduce((sum, g) => sum + g.dayTotal, 0);
    const yourTotalExpense = groups.reduce((sum, g) => sum + g.categories.reduce((cSum, c) => cSum + c.calculatedShare, 0), 0);

    let totalPaid = 0;
    let personName = null;

    if (pId !== null) {
      const pRes = await pool.request().input('personId', sql.BigInt, pId).query('SELECT name FROM dbo.Persons WHERE id = @personId');
      if (pRes.recordset[0]) personName = pRes.recordset[0].name;

      const paidRes = await pool.request()
        .input('personId', sql.BigInt, pId)
        .input('fromM', sql.BigInt, fromM)
        .input('toM', sql.BigInt, toM)
        .query('SELECT COALESCE(SUM(ep.amountPaid), 0) AS totalPaid FROM dbo.ExpensePayers ep JOIN dbo.Expenses e ON e.id = ep.expenseId WHERE ep.personId = @personId AND e.expenseDate BETWEEN @fromM AND @toM');
      totalPaid = parseFloat(paidRes.recordset[0].totalPaid) || 0;
    }

    const remainingBalance = Math.round((totalPaid - yourTotalExpense) * 100) / 100;
    const isReceivable = remainingBalance >= 0;

    res.json({
      success: true,
      shopName: shop.shopName,
      shopAddress: shop.shopAddress,
      fromMillis: fromM,
      toMillis: toM,
      personId: pId,
      personName,
      groups,
      daysWithData: groups.length,
      grandTotal: Math.round(grandTotal * 100) / 100,
      yourTotalExpense: Math.round(yourTotalExpense * 100) / 100,
      totalPaid,
      remainingBalance,
      isReceivable
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Group Summary & Settlement Report (Greedy debt simplification matching SettlementCalculator.kt)
router.get('/reports/group-summary', async (req, res) => {
  try {
    const pool = await getPool();
    const shop = await getShopIdentity(pool);

    const query = `
      SELECT p.id AS personId, p.name AS personName, p.mobileNumber AS mobileNumber,
             COALESCE(paid.total, 0) AS totalPaid,
             COALESCE(share.total, 0) AS totalShare
      FROM dbo.Persons p
      LEFT JOIN (
          SELECT personId AS pid, SUM(amountPaid) AS total
          FROM dbo.ExpensePayers GROUP BY personId
      ) paid ON paid.pid = p.id
      LEFT JOIN (
          SELECT personId AS pid, SUM(shareAmount) AS total
          FROM dbo.ExpenseShares GROUP BY personId
      ) share ON share.pid = p.id
      WHERE p.isActive = 1
      ORDER BY p.name ASC
    `;

    const result = await pool.request().query(query);
    const balances = result.recordset.map(row => {
      const paid = parseFloat(row.totalPaid) || 0;
      const share = parseFloat(row.totalShare) || 0;
      return {
        personId: row.personId,
        personName: row.personName,
        mobileNumber: row.mobileNumber || '',
        totalPaid: Math.round(paid * 100) / 100,
        totalShare: Math.round(share * 100) / 100,
        remainingBalance: Math.round((paid - share) * 100) / 100
      };
    });

    const totalExpense = balances.reduce((sum, b) => sum + b.totalShare, 0);
    const totalPaid = balances.reduce((sum, b) => sum + b.totalPaid, 0);

    const settlements = computeSettlements(balances);

    res.json({
      success: true,
      shopName: shop.shopName,
      shopAddress: shop.shopAddress,
      balances,
      totalMembers: balances.length,
      totalExpense: Math.round(totalExpense * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      settlements
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Database Status & Backup Management
// -----------------------------------------------------------------------------

// GET /api/database/status
router.get('/database/status', async (req, res) => {
  try {
    const pool = await getPool();
    const verRes = await pool.request().query('SELECT @@VERSION AS ver');
    const countsRes = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM dbo.Persons) AS personCount,
        (SELECT COUNT(*) FROM dbo.Expenses) AS expenseCount,
        (SELECT COUNT(*) FROM dbo.ExpenseShares) AS shareCount,
        (SELECT COUNT(*) FROM dbo.AppUser) AS userCount
    `);

    res.json({
      success: true,
      version: verRes.recordset[0].ver,
      database: 'ChaudryMessDB',
      counts: countsRes.recordset[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/database/backup
router.post('/database/backup', async (req, res) => {
  try {
    const role = (req.headers['x-user-role'] || req.query.role || '').toLowerCase();
    if (role === 'user') {
      return res.status(403).json({ success: false, message: 'Permission denied: Only Admin can perform database backups.' });
    }
    const pool = await getPool();
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `ChaudryMessDB_Backup_${timestamp}.bak`;
    const backupPath = path.join(backupDir, backupFileName);

    const query = `BACKUP DATABASE [ChaudryMessDB] TO DISK = @path WITH FORMAT, INIT, NAME = 'Full Backup of ChaudryMessDB'`;
    await pool.request().input('path', sql.NVarChar(500), backupPath).query(query);

    // Update GoogleAccount table with backup timestamp
    await pool.request()
      .input('now', sql.BigInt, Date.now())
      .query('UPDATE dbo.GoogleAccount SET lastBackupTimestamp = @now WHERE id = 1');

    res.json({
      success: true,
      message: 'Database backup created successfully',
      backupFile: backupFileName,
      fullPath: backupPath,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
