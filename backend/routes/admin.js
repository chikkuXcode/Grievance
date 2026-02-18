const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

// @route   GET /api/admin/list
// @desc    Get all admins (superadmin only)
// @access  Private (superadmin)
router.get('/list', protect, restrictTo('superadmin'), async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }).select('-password').sort({ createdAt: -1 });
        res.json({ success: true, admins });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/admin/create
// @desc    Create a new admin (superadmin only)
// @access  Private (superadmin)
router.post('/create', protect, restrictTo('superadmin'), async (req, res) => {
    try {
        const { name, email, department, password } = req.body;

        if (!name || !email || !department) {
            return res.status(400).json({ success: false, message: 'Name, email and department are required' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const admin = await User.create({
            name,
            email,
            password: password || 'Welcome@123',
            role: 'admin',
            department
        });

        res.status(201).json({
            success: true,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                department: admin.department
            }
        });
    } catch (err) {
        console.error('[Admin] Create error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/admin/:id
// @desc    Update admin profile (superadmin only)
// @access  Private (superadmin)
router.put('/:id', protect, restrictTo('superadmin'), async (req, res) => {
    try {
        const { email, department } = req.body;

        const admin = await User.findById(req.params.id);
        if (!admin || admin.role !== 'admin') {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        if (email) admin.email = email;
        if (department) admin.department = department;

        await admin.save();

        res.json({
            success: true,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                department: admin.department
            }
        });
    } catch (err) {
        console.error('[Admin] Update error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   DELETE /api/admin/:id
// @desc    Delete an admin (superadmin only)
// @access  Private (superadmin)
router.delete('/:id', protect, restrictTo('superadmin'), async (req, res) => {
    try {
        const admin = await User.findById(req.params.id);
        if (!admin || admin.role !== 'admin') {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Admin deleted successfully' });
    } catch (err) {
        console.error('[Admin] Delete error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/admin/students
// @desc    Get all students (admin/superadmin)
// @access  Private (admin, superadmin)
router.get('/students', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('-password').sort({ createdAt: -1 });
        res.json({ success: true, students });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
