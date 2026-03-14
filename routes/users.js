const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth'); // Correct import
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads/profile-pictures');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed'));
    }
  }
});

// Get user profile
router.get('/users/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ensure user can only access their own profile
    if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await db.query(
      `SELECT id, name, email, role, picture, phone, 
              date_of_birth as "dateOfBirth", gender, 
              blood_type as "bloodType", height, weight, 
              emergency_contact as "emergencyContact", address, 
              language, notifications, created_at 
       FROM users WHERE id = $1`,
      [id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Construct full URL for picture
    const userData = user.rows[0];
    if (userData.picture && !userData.picture.startsWith('http')) {
      userData.picture = `http://localhost:5000${userData.picture}`;
    }

    res.json(userData);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/users/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, email, phone, dateOfBirth, gender, 
      bloodType, height, weight, emergencyContact, 
      address, language, notifications, picture 
    } = req.body;

    // Ensure user can only update their own profile
    if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if email already exists for another user
    if (email) {
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const updatedUser = await db.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           date_of_birth = COALESCE($4, date_of_birth),
           gender = COALESCE($5, gender),
           blood_type = COALESCE($6, blood_type),
           height = COALESCE($7, height),
           weight = COALESCE($8, weight),
           emergency_contact = COALESCE($9, emergency_contact),
           address = COALESCE($10, address),
           language = COALESCE($11, language),
           notifications = COALESCE($12, notifications),
           picture = COALESCE($13, picture)
       WHERE id = $14
       RETURNING id, name, email, role, picture, phone, 
                 date_of_birth as "dateOfBirth", gender, 
                 blood_type as "bloodType", height, weight, 
                 emergency_contact as "emergencyContact", address, 
                 language, notifications`,
      [name, email, phone, dateOfBirth, gender, bloodType, height, weight, 
       emergencyContact, address, language, notifications, picture, id]
    );

    // Construct full URL for picture
    const userData = updatedUser.rows[0];
    if (userData.picture && !userData.picture.startsWith('http')) {
      userData.picture = `http://localhost:5000${userData.picture}`;
    }

    res.json(userData);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload profile picture
router.post('/users/upload-picture', authenticate, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get old picture to delete it
    const oldPicture = await db.query(
      'SELECT picture FROM users WHERE id = $1',
      [req.user.id]
    );

    // Delete old picture file if it exists and is not a URL
    if (oldPicture.rows[0]?.picture && 
        !oldPicture.rows[0].picture.startsWith('http') &&
        oldPicture.rows[0].picture.startsWith('/uploads/')) {
      const oldFilePath = path.join(__dirname, '..', oldPicture.rows[0].picture);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Generate URL for the uploaded file
    const pictureUrl = `/uploads/profile-pictures/${req.file.filename}`;

    // Update user's picture in database
    await db.query(
      'UPDATE users SET picture = $1 WHERE id = $2',
      [pictureUrl, req.user.id]
    );

    res.json({ 
      success: true, 
      imageUrl: `http://localhost:5000${pictureUrl}`,
      message: 'Profile picture uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading picture:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user account
router.delete('/users/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Ensure user can only delete their own account
    if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get user's picture to delete the file
    const user = await db.query('SELECT picture FROM users WHERE id = $1', [id]);
    
    // Delete picture file if it exists
    if (user.rows[0]?.picture && 
        !user.rows[0].picture.startsWith('http') &&
        user.rows[0].picture.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', user.rows[0].picture);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;