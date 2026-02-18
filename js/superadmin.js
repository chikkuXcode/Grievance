import API from './api.js';
import Core from './core.js';

/**
 * Super Admin Dashboard Logic - Connected to real backend
 */

const SuperAdminApp = {
    currentCaseId: null,
    currentAdminId: null,
    currentAdminName: null,
    confirmCallback: null,

    // ── Toast ─────────────────────────────────────────────────────────────────
    showToast: (title, message, type = 'success') => {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toast-icon');
        const toastTitle = document.getElementById('toast-title');
        const toastMsg = document.getElementById('toast-message');
        if (!toast) return;

        toastTitle.innerText = title;
        toastMsg.innerText = message;

        const styles = {
            success: ['bg-green-100 text-green-600', '✓'],
            error:   ['bg-red-100 text-red-600', '✕'],
            warning: ['bg-yellow-100 text-yellow-600', '⚠']
        };
        const [cls, icon] = styles[type] || styles.success;
        toastIcon.className = `w-10 h-10 rounded-full flex items-center justify-center text-lg ${cls}`;
        toastIcon.innerText = icon;

        toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
        toast.classList.add('translate-y-0', 'opacity-100');
        setTimeout(() => SuperAdminApp.hideToast(), 4000);
    },

    hideToast: () => {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
            toast.classList.remove('translate-y-0', 'opacity-100');
        }
    },

    // ── Confirm Dialog ────────────────────────────────────────────────────────
    showConfirm: (title, message, callback) => {
        const modal = document.getElementById('confirm-modal');
        if (!modal) return;
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = message;
        SuperAdminApp.confirmCallback = callback;
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
    },

    hideConfirm: () => {
        const modal = document.getElementById('confirm-modal');
        if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
        SuperAdminApp.confirmCallback = null;
    },

    // ── Init ──────────────────────────────────────────────────────────────────
    init: async () => {
        Core.log("Initializing SuperAdmin Dashboard");
        const user = API.getCurrentUser();
        if (!user) return;

        // Load data
        await SuperAdminApp.loadOverviewStats();
        await SuperAdminApp.loadEscalatedCases();
        await SuperAdminApp.loadAllCases();
        await SuperAdminApp.loadAdmins();

        // Bind Back Button
        document.getElementById('btn-back-to-escalated')?.addEventListener('click', () => Core.navTo('escalated'));

        // Bind Chat Send
        document.getElementById('btn-chat-send')?.addEventListener('click', (e) => {
            e.preventDefault();
            SuperAdminApp.sendMessage();
        });

        // Bind Add Admin
        document.getElementById('btn-add-new-admin')?.addEventListener('click', SuperAdminApp.showAddAdminModal);

        // Bind Add Admin Modal
        document.getElementById('btn-cancel-admin-modal')?.addEventListener('click', SuperAdminApp.hideAddAdminModal);
        document.getElementById('btn-create-admin-modal')?.addEventListener('click', SuperAdminApp.createAdmin);

        // Bind Resolve Case
        document.getElementById('btn-resolve-case')?.addEventListener('click', SuperAdminApp.handleResolveCase);

        // Bind Password Modal
        document.getElementById('btn-change-password')?.addEventListener('click', SuperAdminApp.showPasswordModal);
        document.getElementById('btn-password-cancel')?.addEventListener('click', SuperAdminApp.hidePasswordModal);
        document.getElementById('btn-password-confirm')?.addEventListener('click', SuperAdminApp.confirmPasswordChange);

        // Bind Edit Admin Modal
        document.getElementById('btn-edit-admin-cancel')?.addEventListener('click', SuperAdminApp.hideEditAdminModal);
        document.getElementById('btn-edit-admin-confirm')?.addEventListener('click', SuperAdminApp.confirmEditAdmin);

        // Bind Confirm Modal
        document.getElementById('btn-confirm-no')?.addEventListener('click', SuperAdminApp.hideConfirm);
        document.getElementById('btn-confirm-yes')?.addEventListener('click', () => {
            if (SuperAdminApp.confirmCallback) SuperAdminApp.confirmCallback();
            SuperAdminApp.hideConfirm();
        });

        // Bind Toast Close
        document.getElementById('toast-close')?.addEventListener('click', SuperAdminApp.hideToast);

        // Bind Global Search
        document.getElementById('input-global-search')?.addEventListener('input', (e) => {
            SuperAdminApp.loadAllCases({ search: e.target.value });
        });

        // Bind Download Report
        document.getElementById('btn-download-report')?.addEventListener('click', () => {
            SuperAdminApp.showToast('Report', 'Report generation requires a reporting service integration.', 'warning');
        });
    },

    // ── Overview Stats ────────────────────────────────────────────────────────
    loadOverviewStats: async () => {
        const result = await API.getStats();
        if (!result.success) return;

        const { total, resolved, escalated } = result.stats;

        const cards = document.querySelectorAll('#view-overview .glass-panel h3');
        if (cards[0]) cards[0].innerText = total.toLocaleString();
        if (cards[1]) cards[1].innerText = resolved.toLocaleString();
        if (cards[2]) cards[2].innerText = escalated;

        // Active admins count
        const adminsResult = await API.getAdmins();
        if (adminsResult.success && cards[3]) {
            cards[3].innerText = adminsResult.admins.length;
        }
    },

    // ── Escalated Cases ───────────────────────────────────────────────────────
    loadEscalatedCases: async () => {
        const result = await API.getEscalatedCases();
        if (!result.success) return;

        const cases = result.cases || [];
        const tbody = document.getElementById('case-list-escalated');
        if (!tbody) return;

        if (cases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">No escalated cases. 🎉</td></tr>`;
            return;
        }

        tbody.innerHTML = cases.map(c => `
            <tr class="hover:bg-gray-50 transition cursor-pointer" data-case-id="${c.caseId}">
                <td class="px-6 py-4 font-mono font-bold text-gray-500">${c.caseId}</td>
                <td class="px-6 py-4 font-bold text-black">${c.subject}</td>
                <td class="px-6 py-4">${c.department}</td>
                <td class="px-6 py-4">
                    <span class="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-bold">${c.priority.toUpperCase()}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-800 manage-btn" data-id="${c.caseId}">Manage</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('tr').forEach(row => {
            row.onclick = (e) => {
                if (e.target.classList.contains('manage-btn')) return;
                if (row.dataset.caseId) SuperAdminApp.openCase(row.dataset.caseId);
            };
        });

        tbody.querySelectorAll('.manage-btn').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); SuperAdminApp.openCase(btn.dataset.id); };
        });

        // Update badge count
        const badge = document.querySelector('#view-escalated .bg-red-50.text-red-600');
        if (badge) badge.innerText = `${cases.length} Active`;
    },

    // ── All Cases ─────────────────────────────────────────────────────────────
    loadAllCases: async (filters = {}) => {
        const result = await API.getAllCases(filters);
        if (!result.success) return;

        const cases = result.cases || [];
        const tbody = document.getElementById('case-list');
        if (!tbody) return;

        if (cases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">No cases found.</td></tr>`;
            return;
        }

        tbody.innerHTML = cases.map(c => `
            <tr class="hover:bg-gray-50/50 transition" data-case-id="${c.caseId}">
                <td class="px-6 py-4 font-mono font-bold text-gray-500">${c.caseId}</td>
                <td class="px-6 py-4 font-medium text-black">${c.subject}</td>
                <td class="px-6 py-4">${c.department}</td>
                <td class="px-6 py-4">
                    <span class="${SuperAdminApp.getStatusClass(c.status)} bg-gray-100 px-2 py-1 rounded text-[10px] font-bold">${c.status.toUpperCase()}</span>
                </td>
                <td class="px-6 py-4 text-right text-xs text-gray-400">${c.priority}</td>
            </tr>
        `).join('');
    },

    // ── Open Case Detail ──────────────────────────────────────────────────────
    openCase: async (id) => {
        const result = await API.getCaseById(id);
        if (!result.success) {
            SuperAdminApp.showToast('Error', 'Could not load case: ' + result.message, 'error');
            return;
        }

        const c = result.case;
        SuperAdminApp.currentCaseId = id;

        const detailId = document.getElementById('detail-id');
        const detailTitle = document.getElementById('detail-title');
        if (detailId) detailId.innerText = '#' + c.caseId;
        if (detailTitle) detailTitle.innerText = c.subject;

        // Student info
        if (c.student) {
            const studentInfoRows = document.querySelectorAll('#view-case-detail .space-y-3 .flex');
            if (studentInfoRows[0]) studentInfoRows[0].querySelector('span:last-child').innerText = c.student.studentId || 'N/A';
            if (studentInfoRows[1]) studentInfoRows[1].querySelector('span:last-child').innerText = c.student.email || 'N/A';
            if (studentInfoRows[2]) studentInfoRows[2].querySelector('span:last-child').innerText = c.student.phone || 'N/A';

            const studentNameEl = document.querySelector('#view-case-detail .font-bold.text-gray-900.text-lg');
            if (studentNameEl) studentNameEl.innerText = c.isAnonymous ? 'Anonymous' : (c.student.name || c.studentName);
        }

        SuperAdminApp.renderChat(c.messages || []);
        Core.navTo('case-detail');
    },

    renderChat: (messages) => {
        const container = document.getElementById('chat-thread');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">No messages yet.</p>`;
            return;
        }

        container.innerHTML = messages.map(m => {
            const isAdmin = m.sender !== 'Student';
            const time = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
            <div class="flex gap-4 ${isAdmin ? 'flex-row-reverse' : ''}">
                <div class="w-8 h-8 ${isAdmin ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'} rounded-full flex items-center justify-center text-xs font-bold">
                    ${isAdmin ? 'SA' : 'S'}
                </div>
                <div class="${isAdmin ? 'chat-admin' : 'chat-student'} p-4 max-w-[80%] text-sm">
                    ${m.text}
                    <p class="text-[10px] text-gray-400 mt-2">${time}</p>
                </div>
            </div>`;
        }).join('');

        container.scrollTop = container.scrollHeight;
    },

    sendMessage: async () => {
        const input = document.getElementById('input-chat-reply');
        const text = input?.value?.trim();
        if (!text || !SuperAdminApp.currentCaseId) return;

        const result = await API.sendMessage(SuperAdminApp.currentCaseId, text);
        if (result.success) {
            input.value = '';
            const caseResult = await API.getCaseById(SuperAdminApp.currentCaseId);
            if (caseResult.success) SuperAdminApp.renderChat(caseResult.case.messages || []);
            SuperAdminApp.showToast('Message Sent', 'Your reply has been sent.');
        } else {
            SuperAdminApp.showToast('Error', result.message, 'error');
        }
    },

    handleResolveCase: () => {
        SuperAdminApp.showConfirm('Resolve Case?', 'Mark this case as resolved and close it?', SuperAdminApp.resolveCase);
    },

    resolveCase: async () => {
        if (!SuperAdminApp.currentCaseId) return;

        const result = await API.resolveCase(SuperAdminApp.currentCaseId);
        if (result.success) {
            SuperAdminApp.showToast('Case Resolved', 'Marked as resolved.');
            Core.navTo('escalated');
            await SuperAdminApp.loadEscalatedCases();
            await SuperAdminApp.loadAllCases();
        } else {
            SuperAdminApp.showToast('Error', result.message, 'error');
        }
    },

    // ── Admin Management ──────────────────────────────────────────────────────
    loadAdmins: async () => {
        const result = await API.getAdmins();
        if (!result.success) return;

        const admins = result.admins || [];
        const container = document.querySelector('#view-admin-mgmt .grid');
        if (!container) return;

        // Keep the "Add New Admin" button row, replace cards
        const addBtn = document.querySelector('#view-admin-mgmt .flex.justify-between');

        if (admins.length === 0) {
            container.innerHTML = `<div class="col-span-3 text-center py-12 text-gray-400">No admins yet. Add one!</div>`;
            return;
        }

        container.innerHTML = admins.map(a => {
            const initials = a.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            return `
            <div class="glass-panel bg-white rounded-[2rem] p-6 flex flex-col items-center text-center relative hover:shadow-lg transition admin-card"
                 data-admin-id="${a._id}" data-admin-name="${a.name}">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-2xl font-bold mb-4">${initials}</div>
                <h3 class="font-bold text-lg">${a.name}</h3>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">${a.department} Dept</p>
                <p class="text-xs text-gray-500 mb-6">${a.email}</p>
                <div class="w-full flex gap-2 border-t border-gray-100 pt-4">
                    <button class="flex-1 py-2 text-xs font-bold text-black border border-gray-200 rounded-xl hover:bg-gray-50 btn-edit-admin">Edit Profile</button>
                    <button class="flex-1 py-2 text-xs font-bold text-red-500 border border-red-100 rounded-xl hover:bg-red-50 btn-delete-admin">Delete</button>
                </div>
            </div>`;
        }).join('');

        SuperAdminApp.bindAdminCardButtons();
    },

    bindAdminCardButtons: () => {
        document.querySelectorAll('.btn-edit-admin').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const card = btn.closest('.admin-card');
                SuperAdminApp.currentAdminId = card?.dataset?.adminId;
                SuperAdminApp.currentAdminName = card?.dataset?.adminName || 'Admin';
                SuperAdminApp.showEditAdminModal();
            };
        });

        document.querySelectorAll('.btn-delete-admin').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const card = btn.closest('.admin-card');
                const adminId = card?.dataset?.adminId;
                const adminName = card?.dataset?.adminName || 'Admin';
                SuperAdminApp.handleDeleteAdmin(adminId, adminName);
            };
        });
    },

    // ── Add Admin Modal ───────────────────────────────────────────────────────
    showAddAdminModal: () => {
        const modal = document.getElementById('add-admin-modal');
        if (modal) modal.classList.add('active');
    },

    hideAddAdminModal: () => {
        const modal = document.getElementById('add-admin-modal');
        if (modal) modal.classList.remove('active');
    },

    createAdmin: async () => {
        // The modal inputs don't have IDs in the HTML, so we query by position
        const inputs = document.querySelectorAll('#add-admin-modal input[type="text"], #add-admin-modal input[type="email"]');
        const deptSelect = document.querySelector('#add-admin-modal select');
        const passInput = document.getElementById('input-new-admin-password');

        const name = inputs[0]?.value?.trim();
        const email = inputs[1]?.value?.trim();
        const department = deptSelect?.value;
        const password = passInput?.value?.trim() || 'Welcome@123';

        if (!name || !email) {
            SuperAdminApp.showToast('Missing Fields', 'Please fill name and email.', 'error');
            return;
        }

        const result = await API.createAdmin({ name, email, department, password });
        if (result.success) {
            SuperAdminApp.showToast('Admin Created', `"${name}" added to ${department} department.`);
            SuperAdminApp.hideAddAdminModal();
            if (inputs[0]) inputs[0].value = '';
            if (inputs[1]) inputs[1].value = '';
            await SuperAdminApp.loadAdmins();
            await SuperAdminApp.loadOverviewStats();
        } else {
            SuperAdminApp.showToast('Error', result.message, 'error');
        }
    },

    // ── Edit Admin Modal ──────────────────────────────────────────────────────
    showEditAdminModal: () => {
        const modal = document.getElementById('edit-admin-modal');
        const subtitle = document.getElementById('edit-admin-subtitle');
        if (subtitle) subtitle.innerText = `Update details for ${SuperAdminApp.currentAdminName}.`;
        if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); }
    },

    hideEditAdminModal: () => {
        const modal = document.getElementById('edit-admin-modal');
        if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
    },

    confirmEditAdmin: async () => {
        const email = document.getElementById('input-edit-admin-email')?.value?.trim();
        const dept = document.getElementById('input-edit-admin-dept')?.value;

        if (!SuperAdminApp.currentAdminId) return;

        const result = await API.updateAdmin(SuperAdminApp.currentAdminId, { email, department: dept });
        if (result.success) {
            SuperAdminApp.showToast('Admin Updated', `${SuperAdminApp.currentAdminName}'s profile updated.`);
            SuperAdminApp.hideEditAdminModal();
            await SuperAdminApp.loadAdmins();
        } else {
            SuperAdminApp.showToast('Error', result.message, 'error');
        }
    },

    handleDeleteAdmin: (adminId, adminName) => {
        SuperAdminApp.showConfirm(
            'Delete Admin?',
            `Are you sure you want to remove "${adminName}"? This cannot be undone.`,
            () => SuperAdminApp.deleteAdmin(adminId, adminName)
        );
    },

    deleteAdmin: async (adminId, adminName) => {
        const result = await API.deleteAdmin(adminId);
        if (result.success) {
            SuperAdminApp.showToast('Admin Removed', `"${adminName}" has been deleted.`);
            await SuperAdminApp.loadAdmins();
            await SuperAdminApp.loadOverviewStats();
        } else {
            SuperAdminApp.showToast('Error', result.message, 'error');
        }
    },

    // ── Password Modal ────────────────────────────────────────────────────────
    showPasswordModal: () => {
        const modal = document.getElementById('password-modal');
        if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); }
    },

    hidePasswordModal: () => {
        const modal = document.getElementById('password-modal');
        if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
    },

    confirmPasswordChange: async () => {
        const current = document.getElementById('input-current-password')?.value;
        const newPass = document.getElementById('input-new-password')?.value;
        const confirm = document.getElementById('input-confirm-password')?.value;

        if (!current || !newPass || !confirm) {
            SuperAdminApp.showToast('Missing Fields', 'Please fill all fields.', 'error');
            return;
        }
        if (newPass !== confirm) {
            SuperAdminApp.showToast('Mismatch', 'Passwords do not match.', 'error');
            return;
        }
        if (newPass.length < 6) {
            SuperAdminApp.showToast('Too Short', 'Min 6 characters required.', 'error');
            return;
        }

        const result = await API.changePassword(current, newPass);
        if (result.success) {
            SuperAdminApp.showToast('Password Changed', 'Updated successfully.');
            SuperAdminApp.hidePasswordModal();
            ['input-current-password', 'input-new-password', 'input-confirm-password'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        } else {
            SuperAdminApp.showToast('Error', result.message, 'error');
        }
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    getStatusClass: (s) => {
        const map = {
            'In Progress': 'text-orange-600',
            'Resolved': 'text-green-600',
            'Escalated': 'text-red-600',
            'Pending': 'text-yellow-600',
            'Open': 'text-gray-600'
        };
        return map[s] || 'text-gray-600';
    }
};

window.SuperAdminApp = SuperAdminApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SuperAdminApp.init);
} else {
    SuperAdminApp.init();
}
