const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const googleAuthRoutes = require('./routes/googleAuth');
const protectedRoutes = require('./routes/protected');
const passwordResetRoutes = require('./routes/passwordReset');
const userRoutes = require('./routes/users');
const imageProxyRoutes = require('./routes/imageProxy');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api', userRoutes);
app.use('/api', imageProxyRoutes);

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});