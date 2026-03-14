const { Pool } = require('pg');
require('dotenv').config();

// Better detection for Railway environment
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';

console.log('🔍 Environment Check:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('  - DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('  - Using production mode:', isProduction);

let pool;

if (isProduction && process.env.DATABASE_URL) {
  // Railway (production) - use DATABASE_URL with SSL
  console.log('🔵 Connecting to Railway database using DATABASE_URL');
  console.log('  - SSL: enabled (rejectUnauthorized: false)');
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else if (process.env.DATABASE_URL) {
  // If DATABASE_URL exists but not in production mode (for testing)
  console.log('🟡 DATABASE_URL found but not in production mode');
  console.log('🟡 Connect with DATABASE_URL anyway (SSL disabled)');
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
} else {
  // Local development - use individual parameters
  console.log('🟢 Connecting to local database using individual params');
  console.log(`  - Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`  - Database: ${process.env.DB_NAME || 'strokify_auth'}`);
  
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'strokify_auth',
    password: process.env.DB_PASSWORD || 'strokify_auth',
    port: process.env.DB_PORT || 5432,
  });
}

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('  - Full error:', err);
  } else {
    console.log('✅ Database connected successfully!');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};