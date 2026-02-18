/**
 * Seed Script - Populates MongoDB with demo users and cases
 * Run: node backend/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Case = require('./models/Case');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/grievancedb';

const seedUsers = [
    {
        name: 'Demo Student',
        email: 'student@demo.com',
        password: 'demo',
        role: 'student',
        department: 'Computer Science',
        phone: '+91 98765 43210',
        studentId: '2023CS101'
    },
    {
        name: 'Warden Smith',
        email: 'admin@demo.com',
        password: 'demo',
        role: 'admin',
        department: 'Hostel'
    },
    {
        name: 'Dr. A. Sharma',
        email: 'super@demo.com',
        password: 'demo',
        role: 'superadmin'
    }
];

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Case.deleteMany({});
        console.log('🗑️  Cleared existing data');

        // Create users
        const createdUsers = await User.create(seedUsers);
        console.log(`👤 Created ${createdUsers.length} users`);

        const student = createdUsers.find(u => u.role === 'student');
        const admin = createdUsers.find(u => u.role === 'admin');

        // Create seed cases
        const seedCases = [
            {
                caseId: 'G-1024',
                category: 'Hostel & Mess',
                subject: 'Water Cooler Leaking on 2nd Floor',
                description: 'The water cooler located near Room 204 has been leaking continuously for the past 48 hours. It is creating a large puddle which is a slipping hazard. I have reported this to the cleaner but no action has been taken.',
                status: 'In Progress',
                priority: 'Critical',
                student: student._id,
                studentName: student.name,
                department: 'Hostel',
                assignedAdmin: admin._id,
                assignedAdminName: admin.name,
                messages: [
                    { sender: 'Student', senderId: student._id, text: 'Is there any update on this? It\'s getting slippery.', time: new Date('2024-10-24T10:45:00') },
                    { sender: 'Admin', senderId: admin._id, text: 'Maintenance team has been dispatched. They should arrive by 2 PM.', time: new Date('2024-10-24T11:00:00') }
                ],
                slaDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000) // Already breached
            },
            {
                caseId: 'G-1085',
                category: 'Accounts & Finance',
                subject: 'Exam Fee Discrepancy',
                description: 'I paid the exam fee online but the portal still shows it as pending. I have the payment receipt.',
                status: 'Open',
                priority: 'High',
                student: student._id,
                studentName: student.name,
                department: 'Finance',
                messages: [],
                slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000)
            },
            {
                caseId: 'G-1099',
                category: 'Anti-Ragging',
                subject: 'Ragging complaint in Block A',
                description: 'Serious incident reported by a junior student in Block A hostel.',
                status: 'Escalated',
                priority: 'Critical',
                student: student._id,
                studentName: 'Anonymous',
                isAnonymous: true,
                department: 'Hostel',
                escalatedTo: 'Chief Warden',
                escalationReason: 'Serious safety concern requiring immediate attention',
                messages: [],
                slaDeadline: new Date(Date.now() - 4 * 60 * 60 * 1000)
            }
        ];

        // Insert cases directly (bypass pre-save hook for caseId since we set them manually)
        await Case.insertMany(seedCases);
        console.log(`📋 Created ${seedCases.length} cases`);

        console.log('\n🎉 Seed complete! Demo credentials:');
        console.log('   Student  → student@demo.com / demo');
        console.log('   Admin    → admin@demo.com   / demo');
        console.log('   SuperAdmin → super@demo.com / demo');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed error:', err.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seed();
