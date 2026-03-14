const express = require("express");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Auth routes are working" });
});

// Register route with role selection
router.post("/register", async (req, res) => {
  try {
    console.log("📝 Registration attempt for:", req.body.email);
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate role (default to 'user' if not specified or invalid)
    let userRole = "user";
    if (role && ["user", "caregiver", "admin"].includes(role)) {
      userRole = role;
    }

    // Normalize email to lowercase for consistent checking
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists - IMPORTANT: Case-insensitive check
    const userExists = await db.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail],
    );

    if (userExists.rows.length > 0) {
      console.log(
        "❌ Registration failed - User already exists:",
        normalizedEmail,
      );
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user with selected role
    const newUser = await db.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at",
      [name, normalizedEmail, hashedPassword, userRole],
    );

    // Create token with role included
    const token = jwt.sign(
      {
        id: newUser.rows[0].id,
        email: newUser.rows[0].email,
        role: newUser.rows[0].role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    console.log(
      "✅ User registered successfully:",
      normalizedEmail,
      "Role:",
      userRole,
    );
    res.status(201).json({
      message: "User created successfully",
      user: newUser.rows[0],
      token,
    });
  } catch (error) {
    console.error("❌ Registration error:", error);

    // Check for unique constraint violation
    if (error.code === "23505") {
      return res.status(400).json({ message: "User already exists" });
    }

    res.status(500).json({ message: "Server error: " + error.message });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    console.log("🔑 Login attempt for:", req.body.email);
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await db.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail],
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.rows[0].password);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid password or email" });
    }

    // Create token with role
    const token = jwt.sign(
      {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    console.log(
      "✅ Login successful:",
      normalizedEmail,
      "Role:",
      user.rows[0].role,
    );
    res.json({
      message: "Login successful",
      user: {
        id: user.rows[0].id,
        name: user.rows[0].name,
        email: user.rows[0].email,
        role: user.rows[0].role,
        created_at: user.rows[0].created_at,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
});
router.get("/check-user", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.query(
      "SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail],
    );

    return res.json({
      exists: user.rows.length > 0,
      email: user.rows[0]?.email || null,
    });
  } catch (error) {
    console.error("❌ Check user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update user role (admin only)
router.put("/update-role", async (req, res) => {
  try {
    const { email, newRole } = req.body;

    // Validate role
    if (!["user", "caregiver", "admin"].includes(newRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const result = await db.query(
      "UPDATE users SET role = $1 WHERE LOWER(email) = LOWER($2) RETURNING id, name, email, role",
      [newRole, email],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`✅ Role updated: ${email} is now ${newRole}`);
    res.json({
      message: "User role updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error updating role:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
