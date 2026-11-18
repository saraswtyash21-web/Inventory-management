require('dotenv').config();
const app = require('../src/app');
const connectDB = require('../src/config/db');
let connection;
module.exports = async function handler(req, res) {
  try {
    if (!connection) connection = connectDB();
    await connection;
    return app(req, res);
  } catch (error) {
    connection = null;
    console.error('Database connection failed:', error.message);
    return res.status(503).json({ error: 'Database unavailable' });
  }
};
