// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

// Middleware to check if user is caregiver or admin
const isCaregiverOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'caregiver' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Caregiver or admin only.' });
  }
};

// Middleware to check if user is authenticated (any role)
const isAuthenticated = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.status(401).json({ message: 'Authentication required' });
  }
};

// Middleware to check specific role
const hasRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      next();
    } else {
      res.status(403).json({ message: `Access denied. ${role} role required.` });
    }
  };
};

// Middleware to check multiple roles
const hasAnyRole = (roles) => {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ message: `Access denied. Required roles: ${roles.join(', ')}` });
    }
  };
};

module.exports = { isAdmin, isCaregiverOrAdmin, isAuthenticated, hasRole, hasAnyRole };