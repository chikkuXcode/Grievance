const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Case = require('../models/Case');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const { sendResolutionEmail } = require('../utils/mailer');

// ── Multer Setup ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|pdf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Only images and PDFs are allowed'));
    }
});

// ── Routes ────────────────────────────────────────────────────────────────────

// @route   POST /api/cases
// @desc    Student files a new grievance
// @access  Private (student)
router.post('/', protect, restrictTo('student'), upload.array('attachments', 5), async (req, res) => {
    try {
        const { category, subject, description, priority, isAnonymous } = req.body;

        if (!category || !subject || !description) {
            return res.status(400).json({ success: false, message: 'Category, subject and description are required' });
        }

        // Map category to department
        const deptMap = {
            'Hostel & Mess': 'Hostel',
            'Academic & Exams': 'Academic',
            'Infrastructure (WiFi/Labs)': 'Infrastructure',
            'Accounts & Finance': 'Finance',
            'Anti-Ragging': 'Anti-Ragging',
            'General': 'General'
        };

        const attachments = (req.files || []).map(f => ({
            filename: f.filename,
            originalName: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
            path: f.path
        }));

        const newCase = await Case.create({
            category,
            subject,
            description,
            priority: priority || 'Medium',
            student: req.user._id,
            studentName: isAnonymous === 'true' ? 'Anonymous' : req.user.name,
            isAnonymous: isAnonymous === 'true',
            department: deptMap[category] || 'General',
            attachments
        });

        res.status(201).json({ success: true, case: newCase });
    } catch (err) {
        console.error('[Cases] Create error:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// @route   GET /api/cases/my
// @desc    Get all cases for the logged-in student
// @access  Private (student)
router.get('/my', protect, restrictTo('student'), async (req, res) => {
    try {
        const cases = await Case.find({ student: req.user._id })
            .sort({ createdAt: -1 })
            .select('-messages');

        res.json({ success: true, cases });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/cases/department
// @desc    Get cases for admin's department
// @access  Private (admin)
router.get('/department', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { status, priority, slaBreached } = req.query;
        const filter = { department: req.user.department };

        if (status && status !== 'All Status') filter.status = status;
        if (priority && priority !== 'All Priority') filter.priority = priority;
        if (slaBreached === 'true') filter.slaDeadline = { $lt: new Date() };

        const cases = await Case.find(filter)
            .sort({ createdAt: -1 })
            .select('-messages');

        res.json({ success: true, cases });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/cases/all
// @desc    Get all cases (superadmin)
// @access  Private (superadmin)
router.get('/all', protect, restrictTo('superadmin'), async (req, res) => {
    try {
        const { status, priority, department, search } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (department) filter.department = department;
        if (search) filter.caseId = { $regex: search, $options: 'i' };

        const cases = await Case.find(filter)
            .sort({ createdAt: -1 })
            .select('-messages');

        res.json({ success: true, cases });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/cases/escalated
// @desc    Get escalated/critical cases (superadmin)
// @access  Private (superadmin)
router.get('/escalated', protect, restrictTo('superadmin'), async (req, res) => {
    try {
        const cases = await Case.find({
            $or: [{ status: 'Escalated' }, { priority: 'Critical' }]
        }).sort({ createdAt: -1 }).select('-messages');

        res.json({ success: true, cases });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/cases/stats
// @desc    Get dashboard stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
    try {
        let filter = {};

        if (req.user.role === 'student') {
            filter.student = req.user._id;
        } else if (req.user.role === 'admin') {
            filter.department = req.user.department;
        }

        const [total, pending, inProgress, escalated, resolved] = await Promise.all([
            Case.countDocuments(filter),
            Case.countDocuments({ ...filter, status: 'Pending' }),
            Case.countDocuments({ ...filter, status: 'In Progress' }),
            Case.countDocuments({ ...filter, status: 'Escalated' }),
            Case.countDocuments({ ...filter, status: 'Resolved' })
        ]);

        res.json({ success: true, stats: { total, pending, inProgress, escalated, resolved } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/cases/:id
// @desc    Get a single case with messages
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const caseDoc = await Case.findOne({ caseId: req.params.id })
            .populate('student', 'name email phone studentId department')
            .populate('assignedAdmin', 'name email department');

        if (!caseDoc) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        // Students can only see their own cases
        if (req.user.role === 'student' && caseDoc.student._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Filter internal notes for students
        let messages = caseDoc.messages;
        if (req.user.role === 'student') {
            messages = messages.filter(m => !m.isInternal);
        }

        res.json({ success: true, case: { ...caseDoc.toObject(), messages } });
    } catch (err) {
        console.error('[Cases] Get by ID error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/cases/:id/status
// @desc    Change case status (admin/superadmin)
// @access  Private (admin, superadmin)
router.put('/:id/status', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
    try {
        const { status, remark } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }
        if (!remark) {
            return res.status(400).json({ success: false, message: 'Remark is required when changing status' });
        }

        const caseDoc = await Case.findOne({ caseId: req.params.id });
        if (!caseDoc) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        caseDoc.status = status;
        if (status === 'Resolved') caseDoc.resolvedAt = new Date();

        // Add system message about status change
        caseDoc.messages.push({
            sender: req.user.role === 'superadmin' ? 'SuperAdmin' : 'Admin',
            senderId: req.user._id,
            text: `[Status changed to: ${status}] ${remark}`,
            isInternal: false
        });

        await caseDoc.save();
        res.json({ success: true, case: caseDoc });
    } catch (err) {
        console.error('[Cases] Status change error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/cases/:id/escalate
// @desc    Escalate a case (admin)
// @access  Private (admin)
router.put('/:id/escalate', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { escalateTo, reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Escalation reason is required' });
        }

        const caseDoc = await Case.findOne({ caseId: req.params.id });
        if (!caseDoc) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        caseDoc.status = 'Escalated';
        caseDoc.priority = 'Critical';
        caseDoc.escalatedTo = escalateTo || 'Super Admin';
        caseDoc.escalationReason = reason;

        caseDoc.messages.push({
            sender: 'Admin',
            senderId: req.user._id,
            text: `[Escalated to ${escalateTo || 'Super Admin'}] Reason: ${reason}`,
            isInternal: false
        });

        await caseDoc.save();
        res.json({ success: true, case: caseDoc });
    } catch (err) {
        console.error('[Cases] Escalate error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/cases/:id/message
// @desc    Send a message in a case thread
// @access  Private
router.post('/:id/message', protect, async (req, res) => {
    try {
        const { text, isInternal } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Message text is required' });
        }

        const caseDoc = await Case.findOne({ caseId: req.params.id });
        if (!caseDoc) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        // Students can only message their own cases
        if (req.user.role === 'student' && caseDoc.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const senderLabel = req.user.role === 'student' ? 'Student'
            : req.user.role === 'superadmin' ? 'SuperAdmin' : 'Admin';

        const message = {
            sender: senderLabel,
            senderId: req.user._id,
            text: text.trim(),
            isInternal: req.user.role !== 'student' && isInternal === true
        };

        caseDoc.messages.push(message);
        await caseDoc.save();

        const savedMsg = caseDoc.messages[caseDoc.messages.length - 1];
        res.status(201).json({ success: true, message: savedMsg });
    } catch (err) {
        console.error('[Cases] Message error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/cases/:id/resolve
// @desc    Resolve and close a case + send email to student
// @access  Private (admin, superadmin)
router.put('/:id/resolve', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
    try {
        const { remark } = req.body;

        const caseDoc = await Case.findOne({ caseId: req.params.id })
            .populate('student', 'name email');

        if (!caseDoc) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        caseDoc.status = 'Resolved';
        caseDoc.resolvedAt = new Date();
        caseDoc.messages.push({
            sender: req.user.role === 'superadmin' ? 'SuperAdmin' : 'Admin',
            senderId: req.user._id,
            text: remark ? `[Resolved] ${remark}` : 'This case has been resolved and closed.',
            isInternal: false
        });

        await caseDoc.save();

        // Send resolution email to student (non-blocking)
        if (caseDoc.student && caseDoc.student.email && !caseDoc.isAnonymous) {
            sendResolutionEmail(
                caseDoc.student.email,
                caseDoc.student.name || caseDoc.studentName,
                caseDoc.caseId,
                caseDoc.subject,
                remark || 'Your grievance has been resolved.'
            ).catch(err => console.error('[Mailer] Resolution email failed:', err.message));
        }

        res.json({ success: true, case: caseDoc });
    } catch (err) {
        console.error('[Cases] Resolve error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
