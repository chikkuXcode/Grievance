/**
 * Grievance.io - Express Backend Server
 * Entry point: node server.js
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/grievancedb';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
    origin: '*',  // Allow all origins for local dev
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend HTML files statically
app.use(express.static(path.join(__dirname)));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/cases', require('./backend/routes/cases'));
app.use('/api/admin', require('./backend/routes/admin'));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Grievance.io API is running',
        timestamp: new Date().toISOString(),
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ── 404 Handler for API ───────────────────────────────────────────────────────
app.use('/api/{*path}', (req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Server Error]', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// ── Connect to MongoDB & Start Server ────────────────────────────────────────
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB connected:', MONGO_URI);
        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
            console.log(`📡 API base: http://localhost:${PORT}/api`);
            console.log(`🌐 Frontend: http://localhost:${PORT}/index.html`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });

module.exports = app;
