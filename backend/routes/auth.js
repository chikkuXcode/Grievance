const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/mailer');

// @route   GET /api/auth/google-client-id
// @desc    Expose Google OAuth Client ID to frontend (never expose secret)
// @access  Public
router.get('/google-client-id', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    res.json({ clientId });
});

// Helper: generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

// @route   POST /api/auth/register
// @desc    Register a new student
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, studentId } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email and password are required' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
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
                department: user.department,
                phone: user.phone,
                studentId: user.studentId
            }
        });
    } catch (err) {
        console.error('[Auth] Register error:', err.message);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// @route   POST /api/auth/login
// @desc    Login user (any role)
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                phone: user.phone,
                studentId: user.studentId
            }
        });
    } catch (err) {
        console.error('[Auth] Login error:', err.message);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// @route   GET /api/auth/me
// @desc    Get current logged-in user
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Both current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('[Auth] Change password error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Send OTP to email for password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if email exists
            return res.json({ success: true, message: 'If this email is registered, an OTP has been sent.' });
        }

        // Check if Brevo is configured before generating OTP
        const brevoKey = process.env.BREVO_API_KEY || '';
        if (!brevoKey || brevoKey === 'your_brevo_api_key_here') {
            return res.status(503).json({
                success: false,
                message: 'Email service is not configured. Please contact the administrator to set up Brevo API key.'
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.resetOtp = otp;
        user.resetOtpExpiry = expiry;
        await user.save({ validateBeforeSave: false });

        // Send OTP email
        const mailResult = await sendPasswordResetEmail(user.email, user.name, otp);
        if (!mailResult.success) {
            console.error('[Auth] OTP email failed:', mailResult.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email. Check your Brevo API key and verified sender address.'
            });
        }

        res.json({ success: true, message: 'OTP sent to your email. Valid for 10 minutes.' });
    } catch (err) {
        console.error('[Auth] Forgot password error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP (returns a short-lived reset token)
// @access  Public
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !user.resetOtp) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        if (user.resetOtp !== otp) {
            return res.status(400).json({ success: false, message: 'Incorrect OTP' });
        }

        if (new Date() > user.resetOtpExpiry) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        // OTP valid — issue a short-lived reset token (5 min)
        const resetToken = jwt.sign(
            { id: user._id, purpose: 'reset' },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );

        res.json({ success: true, resetToken, message: 'OTP verified. You may now reset your password.' });
    } catch (err) {
        console.error('[Auth] Verify OTP error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using the reset token
// @access  Public (with reset token)
router.post('/reset-password', async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Reset token is invalid or expired' });
        }

        if (decoded.purpose !== 'reset') {
            return res.status(400).json({ success: false, message: 'Invalid reset token' });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update password and clear OTP
        user.password = newPassword;
        user.resetOtp = null;
        user.resetOtpExpiry = null;
        await user.save();

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        console.error('[Auth] Reset password error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
