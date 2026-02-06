/**
 * E.E.L. Application Backend Server
 * Express API for handling form submissions
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const applicationsRouter = require('./routes/applications');
const adminRouter = require('./routes/admin');

// Frontend directory (website root, one level up from backend/)
const FRONTEND_DIR = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - restrict to SITE_URL in production, allow all in development
app.use((req, res, next) => {
    const allowedOrigin = process.env.SITE_URL || '*';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// API Routes
app.use('/api/applications', applicationsRouter);
app.use('/admin', adminRouter);

// Serve static frontend files
app.use(express.static(FRONTEND_DIR));

// Fallback to index.html for SPA-style routing
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`E.E.L. Server running on port ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
});
