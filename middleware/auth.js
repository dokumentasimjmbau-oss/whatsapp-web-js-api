const { CONFIG } = require('../config');

// Middleware to check API Key
function authenticateAPI(req, res, next) {
    // Skip auth if no API_KEY is set (development mode)
    if (!CONFIG.API_KEY) {
        return next();
    }
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token || token !== CONFIG.API_KEY) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid API key. Provide API key in Authorization header: Bearer YOUR_API_KEY'
        });
    }
    
    next();
}

// Middleware to check admin authentication
function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
}

module.exports = {
    authenticateAPI,
    requireAuth
};
