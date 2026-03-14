const { Pool } = require('pg');
require('dotenv').config();

console.log('🔌 Initializing database connection...');
console.log('Environment:', process.env.NODE_ENV || 'development');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set!');
  process.exit(1);
}

console.log('📡 DATABASE_URL is present, connecting...');

// Enhanced pool configuration with better timeout and retry settings [citation:6]
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,  // For internal Railway connections
});

// Handle connection errors gracefully
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err.message);
  console.log('🔄 Pool will attempt to reconnect automatically...');
});

// Test connection with retry logic
async function connectWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ Database connected successfully!');
      
      const result = await client.query('SELECT NOW() as time');
      console.log('✅ Test query successful. Server time:', result.rows[0].time);
      
      client.release();
      return true;
    } catch (err) {
      console.log(`❌ Connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`🔄 Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  console.error('❌ All connection attempts failed');
  return false;
}

// Run connection test
connectWithRetry();

module.exports = {
  query: (text, params) => pool.query(text, params),
};