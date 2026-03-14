const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const nodemailer = require('nodemailer');

const router = express.Router();

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('📧 Forgot password request for:', email);

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user exists
    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (user.rows.length === 0) {
      // For security, return same message whether user exists or not
      return res.status(200).json({ 
        message: 'If an account exists with this email, a reset link will be sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Check if reset_token column exists, if not add it
    try {
      await db.query(
        'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3',
        [resetToken, resetTokenExpiry, email]
      );
    } catch (err) {
      // If column doesn't exist, create it
      if (err.message.includes('column "reset_token" does not exist')) {
        console.log('Adding reset_token columns to users table...');
        await db.query('ALTER TABLE users ADD COLUMN reset_token VARCHAR(255)');
        await db.query('ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP');
        
        // Retry the update
        await db.query(
          'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3',
          [resetToken, resetTokenExpiry, email]
        );
      } else {
        throw err;
      }
    }

    // Create reset URL
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    // Send email (if email credentials are configured)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Strokify Password Reset',
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <span style="font-size: 48px;">❤️</span>
              <h1 style="color: #E63E4E; margin: 10px 0 0; font-size: 28px;">Strokify</h1>
            </div>
            
            <h2 style="color: #2d3748; margin-bottom: 20px; font-size: 24px;">Password Reset Request</h2>
            
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              We received a request to reset your password for your Strokify account. 
              Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #E63E4E, #B31E2C); 
                        color: white; text-decoration: none; padding: 14px 32px; 
                        border-radius: 8px; font-weight: 600; font-size: 16px;
                        box-shadow: 0 4px 12px rgba(230, 62, 78, 0.3);">
                Reset Password
              </a>
            </div>
            
            <p style="color: #718096; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              Or copy this link:<br>
              <a href="${resetUrl}" style="color: #E63E4E; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <p style="color: #a0aec0; font-size: 13px; margin-bottom: 10px;">
              This link will expire in 1 hour for security reasons.
            </p>
            
            <p style="color: #a0aec0; font-size: 13px;">
              If you didn't request this password reset, please ignore this email 
              or contact support if you have concerns.
            </p>
            
            <hr style="border: 1px solid #e2e8f0; margin: 30px 0;">
            
            <p style="color: #718096; font-size: 12px; text-align: center;">
              Strokify - Your health guardian<br>
              © 2025 Strokify. All rights reserved.
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log('✅ Reset email sent to:', email);
    } else {
      console.log('⚠️ Email credentials not configured. Reset URL:', resetUrl);
      // For development, log the reset URL
      console.log('Reset URL (copy this):', resetUrl);
    }

    res.status(200).json({ 
      message: 'If an account exists with this email, a reset link will be sent.' 
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Reset password - verify token and update password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    console.log('🔑 Reset password attempt with token');

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    // Find user with valid token
    const user = await db.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear token
    await db.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [hashedPassword, user.rows[0].id]
    );

    console.log('✅ Password reset successful for user:', user.rows[0].email);
    res.status(200).json({ message: 'Password reset successful! You can now log in with your new password.' });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Verify token (optional - for checking if token is valid)
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await db.query(
      'SELECT email FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ valid: false });
    }

    res.json({ valid: true, email: user.rows[0].email });
  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;