const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'webapp', '.env') });
require('dotenv').config();

const apiRoutes = require('../webapp/server/routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets if not handled by Vercel edge
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API
app.use('/api', apiRoutes);

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
