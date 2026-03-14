const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { isAdmin, isCaregiverOrAdmin, canAccessPatient } = require('../middleware/roleAuth');

const router = express.Router();

// Get current user profile (any authenticated user)
router.get('/profile', auth.authenticate, async (req, res) => {
  try {
    const user = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user.rows[0]);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only)
router.get('/users', auth.authenticate, isAdmin, async (req, res) => {
  try {
    const users = await db.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id'
    );
    res.json(users.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get patients/care recipients (caregiver and admin)
router.get('/patients', auth.authenticate, isCaregiverOrAdmin, async (req, res) => {
  try {
    let query;
    if (req.user.role === 'admin') {
      // Admin sees all patients
      query = await db.query(
        "SELECT id, name, email, created_at FROM users WHERE role = 'user'"
      );
    } else {
      // Caregiver sees patients assigned to them
      // This assumes you have a patient_caregiver junction table
      query = await db.query(`
        SELECT u.id, u.name, u.email, u.created_at 
        FROM users u
        LEFT JOIN patient_caregiver pc ON u.id = pc.patient_id
        WHERE pc.caregiver_id = $1 AND u.role = 'user'
      `, [req.user.id]);
    }
    res.json(query.rows);
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statistics (admin only)
router.get('/stats', auth.authenticate, isAdmin, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'caregiver' THEN 1 END) as caregiver_count,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count,
        TO_CHAR(MIN(created_at), 'YYYY-MM-DD') as first_user,
        TO_CHAR(MAX(created_at), 'YYYY-MM-DD') as latest_user
      FROM users
    `);
    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single patient by ID (with access control)
router.get('/patient/:id', auth.authenticate, async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    
    // Check access based on role
    if (req.user.role === 'user' && req.user.id !== patientId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (req.user.role === 'caregiver') {
      // Check if caregiver is assigned to this patient
      const assignment = await db.query(
        'SELECT 1 FROM patient_caregiver WHERE caregiver_id = $1 AND patient_id = $2',
        [req.user.id, patientId]
      );
      
      if (assignment.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied to this patient' });
      }
    }
    
    // Get patient data
    const patient = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [patientId]
    );
    
    if (patient.rows.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    res.json(patient.rows[0]);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (admin only)
router.put('/user/:id/role', auth.authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['user', 'caregiver', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: 'User role updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/user/:id', auth.authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Don't allow deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: 'User deleted successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;