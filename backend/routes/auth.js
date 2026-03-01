const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/mailer');
const { OAuth2Client } = require('google-auth-library');

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper: generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

// ===============================
// GOOGLE CLIENT ID ROUTE
// ===============================
router.get('/google-client-id', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    res.json({ clientId });
});

// ===============================
// GOOGLE LOGIN ROUTE
// ===============================
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: 'No Google credential provided'
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name } = payload;

        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            user = await User.create({
                name,
                email,
                password: Math.random().toString(36).slice(-8),
                role: 'student'
            });
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('[Auth] Google login error:', error);
        res.status(500).json({
            success: false,
            message: 'Google authentication failed'
        });
    }
});

// ===============================
// REGISTER
// ===============================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, studentId } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required'
            });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        const user = await User.create({
            name,
            email,
            password,
            phone: phone || '',
            studentId: studentId || '',
            role: 'student'
        });

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                studentId: user.studentId
            }
        });

    } catch (err) {
        console.error('[Auth] Register error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
});

// ===============================
// LOGIN
// ===============================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        console.error('[Auth] Login error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// ===============================
// FORGOT PASSWORD (RESEND)
// ===============================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.json({
                success: true,
                message: 'If this email is registered, an OTP has been sent.'
            });
        }

        if (!process.env.RESEND_API_KEY) {
            return res.status(503).json({
                success: false,
                message: 'Email service is not configured.'
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        user.resetOtp = otp;
        user.resetOtpExpiry = expiry;
        await user.save({ validateBeforeSave: false });

        const mailResult = await sendPasswordResetEmail(user.email, user.name, otp);

        if (!mailResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email.'
            });
        }

        res.json({
            success: true,
            message: 'OTP sent to your email. Valid for 10 minutes.'
        });

    } catch (err) {
        console.error('[Auth] Forgot password error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
