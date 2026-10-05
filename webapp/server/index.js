const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiRoutes = require('./routes');
const { getPool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes
app.use('/api', apiRoutes);

// Fallback to SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start server and verify TiDB / Database connection on 0.0.0.0 (all network cards)
app.listen(PORT, '0.0.0.0', async () => {
  const localIP = getLocalIP();
  console.log(`====================================================`);
  console.log(` Chaudry Mess Web Application is running!`);
  console.log(` Local URL   : http://localhost:${PORT}`);
  console.log(` Network URL : http://${localIP}:${PORT} (For other PCs/mobiles on WiFi)`);
  console.log(` Connecting to Database...`);
  try {
    const pool = await getPool();
    console.log(` Database status : Online & Ready!`);
  } catch (err) {
    console.error(` Database Connection Warning:`, err.message);
  }
  console.log(`====================================================`);
});


