const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true  // 'Student', 'Admin', 'SuperAdmin'
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    text: {
        type: String,
        required: true
    },
    isInternal: {
        type: Boolean,
        default: false  // true = internal note (admin-only)
    },
    time: {
        type: Date,
        default: Date.now
    }
});

const caseSchema = new mongoose.Schema({
    caseId: {
        type: String,
        unique: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['Hostel & Mess', 'Academic & Exams', 'Infrastructure (WiFi/Labs)', 'Accounts & Finance', 'Anti-Ragging', 'General']
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    status: {
        type: String,
        enum: ['Open', 'Pending', 'In Progress', 'Escalated', 'Resolved', 'Closed'],
        default: 'Open'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    studentName: {
        type: String,
        default: 'Anonymous'
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    department: {
        type: String,
        default: 'General'
    },
    assignedAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assignedAdminName: {
        type: String,
        default: ''
    },
    messages: [messageSchema],
    attachments: [{
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String
    }],
    escalatedTo: {
        type: String,
        default: ''
    },
    escalationReason: {
        type: String,
        default: ''
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    slaDeadline: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Auto-generate caseId before saving
caseSchema.pre('save', async function () {
    if (!this.caseId) {
        const count = await mongoose.model('Case').countDocuments();
        this.caseId = `G-${1000 + count + 1}`;
    }
    // Set SLA deadline based on priority
    if (!this.slaDeadline) {
        const hours = { Critical: 4, High: 24, Medium: 72, Low: 168 };
        const h = hours[this.priority] || 72;
        this.slaDeadline = new Date(Date.now() + h * 60 * 60 * 1000);
    }
});

module.exports = mongoose.model('Case', caseSchema);
