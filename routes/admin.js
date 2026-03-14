const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');

const router = express.Router();

// Get all users (admin only)
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const users = await db.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id'
    );
    res.json(users.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user stats (admin only)
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count,
        DATE(MIN(created_at)) as first_user,
        DATE(MAX(created_at)) as latest_user
      FROM users
    `);
    res.json(stats.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;