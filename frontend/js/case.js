import API from './api.js';

/**
 * Case Management Logic
 * Shared across all roles.
 */

const MOCK_CASES = [
    {
        id: "G-1024",
        category: "Hostel",
        subject: "Water Cooler Leaking on 2nd Floor",
        description: "The water cooler in Block A, 2nd floor has been leaking for 2 days. It's slippery and dangerous.",
        status: "In Progress",
        priority: "Critical",
        studentId: "U-1001",
        studentName: "Demo Student",
        assignedAdmin: "Warden Smith",
        department: "Hostel",
        timestamp: "2024-10-24T10:00:00",
        messages: [
            { sender: "Student", text: "Is there any update? It's getting worse.", time: "10:45 AM" },
            { sender: "Admin", text: "Maintenance team dispatched.", time: "11:00 AM" }
        ],
        attachments: []
    },
    {
        id: "G-1085",
        category: "Finance",
        subject: "Exam Fee Discrepancy",
        description: "I paid the fee but portal shows pending.",
        status: "Open",
        priority: "High",
        studentId: "U-1001",
        studentName: "Demo Student",
        assignedAdmin: "Finance Officer",
        department: "Finance",
        timestamp: "2024-10-25T09:00:00",
        messages: [],
        attachments: []
    },
    {
        id: "G-1099",
        category: "Hostel",
        subject: "Ragging complaint in Block A",
        description: "Serious incident reported.",
        status: "Escalated",
        priority: "Critical",
        studentId: "U-9999",
        studentName: "Anonymous",
        assignedAdmin: "Chief Warden",
        department: "Hostel",
        timestamp: "2024-10-26T12:00:00",
        messages: [],
        attachments: []
    }
];

const CaseSystem = {
    
    /**
     * Get all cases, optionally filtered
     */
    getAll: () => {
        // In a real app, this would fetch from API
        return MOCK_CASES;
    },

    /**
     * Get cases for a specific student
     */
    getByStudent: (studentId) => {
        return MOCK_CASES.filter(c => c.studentId === studentId);
    },

    /**
     * Get cases for a specific department (Admin view)
     */
    getByDepartment: (dept) => {
        return MOCK_CASES.filter(c => c.department === dept);
    },

    /**
     * Get a single case by ID
     */
    getById: (id) => {
        return MOCK_CASES.find(c => c.id === id);
    },

    /**
     * Create a new case
     */
    create: (caseData) => {
        const newCase = {
            id: `G-${Math.floor(Math.random() * 9000) + 1000}`,
            status: "Open",
            priority: "Medium", // Default
            messages: [],
            attachments: [],
            timestamp: new Date().toISOString(),
            ...caseData
        };
        MOCK_CASES.unshift(newCase);
        return newCase;
    },

    /**
     * Add a message to a case
     */
    addMessage: (caseId, sender, text) => {
        const c = CaseSystem.getById(caseId);
        if (c) {
            c.messages.push({
                sender: sender,
                text: text,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            return true;
        }
        return false;
    },

    /**
     * Render the list of cases into a container
     * @param {Array} cases 
     * @param {HTMLElement} container 
     * @param {Function} onClickHandler - Callback when 'View' is clicked
     */
    renderList: (cases, container, onClickHandler) => {
        if (!container) return;
        
        container.innerHTML = cases.map(c => `
            <div class="p-4 bg-gray-50 rounded-2xl border-l-4 ${CaseSystem.getPriorityColor(c.priority)} cursor-pointer hover:bg-white hover:shadow-sm transition mb-3 case-item" data-id="${c.id}">
                <div class="flex justify-between items-start mb-1">
                    <span class="text-[10px] font-bold text-gray-500">#${c.id} • ${c.category}</span>
                    <span class="text-[10px] ${CaseSystem.getStatusColor(c.status)} font-bold">${c.status}</span>
                </div>
                <p class="text-sm font-bold text-gray-900">${c.subject}</p>
                <div class="flex justify-between mt-2">
                     <span class="text-xs text-gray-400">${new Date(c.timestamp).toLocaleDateString()}</span>
                     <button class="text-xs font-bold underline view-btn">View</button>
                </div>
            </div>
        `).join('');

        // Bind clicks
        container.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent double triggers
                const id = e.target.closest('.case-item').dataset.id;
                onClickHandler(id);
            });
        });
        
        // Also bind the whole card for better UX
        container.querySelectorAll('.case-item').forEach(card => {
            card.addEventListener('click', (e) => {
                if(e.target.tagName === 'BUTTON') return;
                const id = card.dataset.id;
                onClickHandler(id);
            });
        });
    },

    /**
     * Render Chat Messages
     */
    renderChat: (messages, container) => {
        if(!container) return;
        container.innerHTML = messages.map(m => {
            const isStudent = m.sender === 'Student' || m.sender === 'Me'; // Simplified check
            // If the current USER is a student, their messages are right aligned.
            // If the current USER is admin, student messages are left aligned.
            // For this mock, let's assume 'Student' sender is always the Student User.
            
            // We need context of WHO is viewing to align correctly. 
            // Let's pass that or infer it. For now, simple logic:
            // Let's assume the viewers are viewing 'thread'.
            
            return `
            <div class="flex gap-4 ${m.sender === 'Student' ? '' : 'flex-row-reverse'}">
                 <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.sender === 'Student' ? 'bg-gray-100 text-gray-600' : 'bg-black text-white'}">
                    ${m.sender === 'Student' ? 'S' : 'A'}
                 </div>
                 <div class="${m.sender === 'Student' ? 'bg-white border border-gray-100' : 'bg-gray-50'} p-4 rounded-xl max-w-[80%] text-sm">
                     <p class="font-bold text-xs mb-1">${m.sender}</p>
                     ${m.text}
                     <p class="text-[10px] text-gray-400 mt-2">${m.time}</p>
                 </div>
            </div>
            `;
        }).join('');
    },

    // Helpers
    getChildColor: (status) => {
        // Not used directly, but logic for status colors
    },

    getPriorityColor: (p) => {
        switch(p) {
            case 'Critical': return 'border-red-500';
            case 'High': return 'border-orange-500';
            default: return 'border-blue-500';
        }
    },
    
    getStatusColor: (s) => {
        switch(s) {
            case 'In Progress': return 'text-orange-600';
            case 'Resolved': return 'text-green-600';
            case 'Escalated': return 'text-red-600';
            default: return 'text-gray-600';
        }
    }
};

window.CaseSystem = CaseSystem;
export default CaseSystem;
