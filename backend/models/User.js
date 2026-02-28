const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 4
    },
    role: {
        type: String,
        enum: ['student', 'admin', 'superadmin'],
        default: 'student'
    },
    department: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    },
    studentId: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    resetOtp: {
        type: String,
        default: null
    },
    resetOtpExpiry: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
