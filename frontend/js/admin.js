import API from './api.js';
import Core from './core.js';

/**
 * Admin Dashboard Logic - Connected to real backend
 */

const AdminApp = {
    currentCaseId: null,
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
        setTimeout(() => AdminApp.hideToast(), 4000);
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
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = message;
        AdminApp.confirmCallback = callback;
        if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); }
    },

    hideConfirm: () => {
        const modal = document.getElementById('confirm-modal');
        if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
        AdminApp.confirmCallback = null;
    },

    // ── Init ──────────────────────────────────────────────────────────────────
    init: async () => {
        Core.log("Initializing Admin Dashboard");
        const user = API.getCurrentUser();
        if (!user) return;

        // Load cases and stats
        await AdminApp.loadStats();
        await AdminApp.loadDepartmentCases();

        // Bind navigation buttons
        const btnBack = document.getElementById('btn-back-to-list');
        if (btnBack) btnBack.onclick = () => Core.navTo('cases');

        const btnViewAll = document.getElementById('btn-view-all-cases');
        if (btnViewAll) btnViewAll.onclick = () => Core.navTo('cases');

        // Bind Chat Send
        const btnChatSend = document.getElementById('btn-chat-send');
        if (btnChatSend) btnChatSend.onclick = (e) => { e.preventDefault(); AdminApp.sendMessage(); };

        // Bind Quick Actions
        const btnEscalate = document.getElementById('btn-action-escalate');
        if (btnEscalate) btnEscalate.onclick = () => AdminApp.showEscalateModal();

        const btnResolve = document.getElementById('btn-action-resolve');
        if (btnResolve) btnResolve.onclick = () => AdminApp.handleResolveCase();

        // Bind Escalate Modal
        document.getElementById('btn-escalate-cancel')?.addEventListener('click', AdminApp.hideEscalateModal);
        document.getElementById('btn-escalate-confirm')?.addEventListener('click', AdminApp.confirmEscalation);

        // Bind Status Modal
        document.getElementById('btn-change-status')?.addEventListener('click', AdminApp.showStatusModal);
        document.getElementById('btn-status-cancel')?.addEventListener('click', AdminApp.hideStatusModal);
        document.getElementById('btn-status-confirm')?.addEventListener('click', AdminApp.confirmStatusChange);

        // Bind Password Modal
        document.getElementById('btn-change-password')?.addEventListener('click', AdminApp.showPasswordModal);
        document.getElementById('btn-password-cancel')?.addEventListener('click', AdminApp.hidePasswordModal);
        document.getElementById('btn-password-confirm')?.addEventListener('click', AdminApp.confirmPasswordChange);

        // Bind Confirm Modal
        document.getElementById('btn-confirm-no')?.addEventListener('click', AdminApp.hideConfirm);
        document.getElementById('btn-confirm-yes')?.addEventListener('click', () => {
            if (AdminApp.confirmCallback) AdminApp.confirmCallback();
            AdminApp.hideConfirm();
        });

        // Bind Toast Close
        document.getElementById('toast-close')?.addEventListener('click', AdminApp.hideToast);

        // Bind Filters
        document.getElementById('select-filter-status')?.addEventListener('change', AdminApp.loadDepartmentCases);
        document.getElementById('select-filter-priority')?.addEventListener('change', AdminApp.loadDepartmentCases);
        document.getElementById('check-show-breached')?.addEventListener('change', AdminApp.loadDepartmentCases);

        // Bind Download Report
        document.getElementById('btn-download-report')?.addEventListener('click', () => {
            AdminApp.showToast('Report Ready', 'Report generation is a backend feature. Connect to a reporting service.', 'warning');
        });

        AdminApp.fillProfile(user);
    },

    loadStats: async () => {
        const result = await API.getStats();
        if (!result.success) return;

        const { pending, inProgress, escalated, resolved } = result.stats;

        const cards = document.querySelectorAll('#view-dashboard .glass-panel h3');
        if (cards[0]) cards[0].innerText = pending;
        if (cards[1]) cards[1].innerText = inProgress;
        if (cards[2]) cards[2].innerText = escalated;
        if (cards[3]) cards[3].innerText = resolved;
    },

    loadDepartmentCases: async () => {
        const statusEl = document.getElementById('select-filter-status');
        const priorityEl = document.getElementById('select-filter-priority');
        const breachedEl = document.getElementById('check-show-breached');

        const filters = {};
        if (statusEl && statusEl.value !== 'All Status') filters.status = statusEl.value;
        if (priorityEl && priorityEl.value !== 'All Priority') filters.priority = priorityEl.value;
        if (breachedEl && breachedEl.checked) filters.slaBreached = 'true';

        const result = await API.getDepartmentCases(filters);
        if (!result.success) {
            console.error('[AdminApp] Failed to load cases:', result.message);
            return;
        }

        const cases = result.cases || [];
        AdminApp.renderDashboardTable(cases.slice(0, 5));
        AdminApp.renderCaseTable(cases);
    },

    renderDashboardTable: (cases) => {
        const tbody = document.querySelector('#view-dashboard tbody');
        if (!tbody) return;

        if (cases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-400">No cases in your department.</td></tr>`;
            return;
        }

        tbody.innerHTML = cases.map(c => {
            const slaStatus = AdminApp.getSlaStatus(c.slaDeadline);
            return `
            <tr class="hover:bg-gray-50/50" data-case-id="${c.caseId}">
                <td class="py-3 font-mono text-xs">#${c.caseId}</td>
                <td class="py-3">${c.category}</td>
                <td class="py-3"><span class="text-xs font-bold ${AdminApp.getPriorityClass(c.priority)} px-2 py-0.5 rounded-full">${c.priority}</span></td>
                <td class="py-3"><span class="text-xs font-bold ${slaStatus.cls} px-2 py-0.5 rounded-full">${slaStatus.label}</span></td>
                <td class="py-3 text-right">
                    <button class="text-black font-medium text-xs border border-gray-200 px-3 py-1 rounded-full hover:bg-black hover:text-white transition btn-open-case" data-id="${c.caseId}">Open</button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-open-case').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); AdminApp.openCase(btn.dataset.id); };
        });
    },

    renderCaseTable: (cases) => {
        const tbody = document.getElementById('case-list');
        if (!tbody) return;

        if (cases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No cases found.</td></tr>`;
            return;
        }

        tbody.innerHTML = cases.map(c => {
            const slaStatus = AdminApp.getSlaStatus(c.slaDeadline);
            return `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100 last:border-0 cursor-pointer" data-case-id="${c.caseId}">
                <td class="px-6 py-4 font-mono font-bold text-gray-500">#${c.caseId}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">${(c.studentName || 'S').charAt(0)}</div>
                        <div>
                            <p class="font-bold text-sm text-gray-900">${c.studentName || 'Student'}</p>
                            <p class="text-xs text-gray-400">${c.category}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 font-medium text-black">${c.subject}</td>
                <td class="px-6 py-4"><span class="text-xs font-bold ${AdminApp.getStatusClass(c.status)} px-2 py-1 rounded uppercase">${c.status}</span></td>
                <td class="px-6 py-4"><span class="text-xs font-bold ${AdminApp.getPriorityClass(c.priority)} px-2 py-1 rounded">${c.priority}</span></td>
                <td class="px-6 py-4"><span class="text-xs font-bold ${slaStatus.cls} px-2 py-0.5 rounded-full">${slaStatus.label}</span></td>
                <td class="px-6 py-4 text-right">
                    <button class="bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-800 manage-btn" data-id="${c.caseId}">Manage</button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('tr').forEach(row => {
            row.onclick = (e) => {
                if (e.target.classList.contains('manage-btn')) return;
                if (row.dataset.caseId) AdminApp.openCase(row.dataset.caseId);
            };
        });

        tbody.querySelectorAll('.manage-btn').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); AdminApp.openCase(btn.dataset.id); };
        });
    },

    renderAttachments: (attachments) => {
        const container = document.getElementById('attachment-list');
        if (!container) return;

        if (!attachments || attachments.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic">No attachments.</p>';
            return;
        }

        container.innerHTML = attachments.map(a => {
            const ext = (a.originalName || a.filename || '').split('.').pop().toUpperCase() || 'FILE';
            const isImage = /jpg|jpeg|png|gif/i.test(ext);
            const url = `http://localhost:5000/uploads/${a.filename}`;
            const bgColor = isImage ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700';
            return `
            <a href="${url}" target="_blank" rel="noopener"
               class="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-white hover:shadow-sm transition cursor-pointer group">
                <div class="w-8 h-8 ${bgColor} rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0">${ext.slice(0,3)}</div>
                <div class="min-w-0">
                    <p class="text-xs font-semibold text-gray-800 truncate max-w-[120px]">${a.originalName || a.filename}</p>
                    <p class="text-[10px] text-gray-400">${a.size ? (a.size / 1024).toFixed(1) + ' KB' : ''}</p>
                </div>
                <svg class="w-3 h-3 text-gray-400 group-hover:text-black ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </a>`;
        }).join('');
    },

    openCase: async (id) => {
        const result = await API.getCaseById(id);
        if (!result.success) {
            AdminApp.showToast('Error', 'Could not load case: ' + result.message, 'error');
            return;
        }

        const c = result.case;
        AdminApp.currentCaseId = id;

        document.getElementById('detail-id').innerText = '#' + c.caseId;
        document.getElementById('detail-title').innerText = c.subject;

        const detailDesc = document.getElementById('detail-desc');
        if (detailDesc) detailDesc.innerText = c.description || 'No description.';

        // Student info
        if (c.student) {
            const studentName = document.querySelector('#view-case-detail .font-bold.text-base, #view-case-detail p.font-bold');
            const studentInfo = document.querySelectorAll('#view-case-detail .space-y-2 .flex');
            if (studentName) studentName.innerText = c.student.name || c.studentName;
            if (studentInfo[0]) studentInfo[0].querySelector('span:last-child').innerText = c.student.studentId || 'N/A';
            if (studentInfo[1]) studentInfo[1].querySelector('span:last-child').innerText = c.student.email || 'N/A';
            if (studentInfo[2]) studentInfo[2].querySelector('span:last-child').innerText = c.student.phone || 'N/A';
        }

        AdminApp.renderAttachments(c.attachments || []);
        AdminApp.renderChat(c.messages || []);
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
            <div class="flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}">
                <div class="w-8 h-8 ${isAdmin ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'} rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                    ${isAdmin ? 'A' : 'S'}
                </div>
                <div class="${isAdmin ? 'bg-black text-white' : 'bg-white border border-gray-100'} p-3 rounded-2xl ${isAdmin ? 'rounded-tr-none' : 'rounded-tl-none'} shadow-sm text-sm max-w-[80%]">
                    ${m.text}
                    <p class="text-[10px] ${isAdmin ? 'text-gray-400' : 'text-gray-400'} mt-1">${time}</p>
                </div>
            </div>`;
        }).join('');

        container.scrollTop = container.scrollHeight;
    },

    sendMessage: async () => {
        const input = document.getElementById('input-chat-reply');
        const text = input?.value?.trim();
        if (!text || !AdminApp.currentCaseId) return;

        const result = await API.sendMessage(AdminApp.currentCaseId, text);
        if (result.success) {
            input.value = '';
            const caseResult = await API.getCaseById(AdminApp.currentCaseId);
            if (caseResult.success) AdminApp.renderChat(caseResult.case.messages || []);
            AdminApp.showToast('Message Sent', 'Your reply has been sent.');
        } else {
            AdminApp.showToast('Error', result.message, 'error');
        }
    },

    // ── Escalate Modal ────────────────────────────────────────────────────────
    showEscalateModal: () => {
        const modal = document.getElementById('escalate-modal');
        if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); }
    },

    hideEscalateModal: () => {
        const modal = document.getElementById('escalate-modal');
        if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
    },

    confirmEscalation: async () => {
        if (!AdminApp.currentCaseId) return;

        const escalateTo = document.querySelector('#escalate-modal select')?.value || 'Chief Warden';
        const reason = document.querySelector('#escalate-modal textarea')?.value?.trim();

        if (!reason) {
            AdminApp.showToast('Required', 'Please provide an escalation reason.', 'error');
            return;
        }

        const result = await API.escalateCase(AdminApp.currentCaseId, escalateTo, reason);
        if (result.success) {
            AdminApp.showToast('Case Escalated', `Forwarded to ${escalateTo}.`);
            AdminApp.hideEscalateModal();
            Core.navTo('cases');
            await AdminApp.loadDepartmentCases();
        } else {
            AdminApp.showToast('Error', result.message, 'error');
        }
    },

    handleResolveCase: () => {
        AdminApp.showConfirm('Resolve Case?', 'Mark this case as resolved and close it?', AdminApp.resolveCase);
    },

    resolveCase: async () => {
        if (!AdminApp.currentCaseId) return;

        const result = await API.resolveCase(AdminApp.currentCaseId);
        if (result.success) {
            AdminApp.showToast('Case Resolved', 'Marked as resolved.');
            Core.navTo('cases');
            await AdminApp.loadDepartmentCases();
        } else {
            AdminApp.showToast('Error', result.message, 'error');
        }
    },

    // ── Status Modal ──────────────────────────────────────────────────────────
    showStatusModal: () => {
        const modal = document.getElementById('status-modal');
        if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); }
    },

    hideStatusModal: () => {
        const modal = document.getElementById('status-modal');
        if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
    },

    confirmStatusChange: async () => {
        const newStatus = document.getElementById('select-new-status')?.value;
        const remark = document.getElementById('input-status-remark')?.value?.trim();

        if (!remark) {
            AdminApp.showToast('Required', 'Please add a remark.', 'error');
            return;
        }

        const result = await API.changeStatus(AdminApp.currentCaseId, newStatus, remark);
        if (result.success) {
            AdminApp.showToast('Status Updated', `Changed to "${newStatus}".`);
            AdminApp.hideStatusModal();
            document.getElementById('input-status-remark').value = '';
            const caseResult = await API.getCaseById(AdminApp.currentCaseId);
            if (caseResult.success) AdminApp.renderChat(caseResult.case.messages || []);
        } else {
            AdminApp.showToast('Error', result.message, 'error');
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
            AdminApp.showToast('Missing Fields', 'Please fill all fields.', 'error');
            return;
        }
        if (newPass !== confirm) {
            AdminApp.showToast('Mismatch', 'Passwords do not match.', 'error');
            return;
        }
        if (newPass.length < 6) {
            AdminApp.showToast('Too Short', 'Min 6 characters required.', 'error');
            return;
        }

        const result = await API.changePassword(current, newPass);
        if (result.success) {
            AdminApp.showToast('Password Changed', 'Updated successfully.');
            AdminApp.hidePasswordModal();
            ['input-current-password', 'input-new-password', 'input-confirm-password'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        } else {
            AdminApp.showToast('Error', result.message, 'error');
        }
    },

    fillProfile: (user) => {
        const name = document.getElementById('admin-profile-name');
        const dept = document.getElementById('admin-profile-dept');
        const email = document.getElementById('admin-profile-email');
        const headerName = document.getElementById('header-user-name');

        if (name) name.innerText = user.name || 'Admin';
        if (dept) dept.innerText = (user.department || 'General') + ' Department';
        if (email) email.innerText = user.email || '';
        if (headerName) headerName.innerText = user.name || 'Admin';
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    getSlaStatus: (deadline) => {
        if (!deadline) return { label: 'N/A', cls: 'text-gray-500 bg-gray-100' };
        const diff = new Date(deadline) - Date.now();
        const hours = Math.floor(diff / 3600000);
        if (diff < 0) return { label: `${Math.abs(hours)}h (Breach)`, cls: 'text-red-600 bg-red-50' };
        if (hours < 4) return { label: `${hours}h Left`, cls: 'text-yellow-600 bg-yellow-50' };
        return { label: `${hours}h Left`, cls: 'text-green-600 bg-green-50' };
    },

    getPriorityClass: (p) => {
        const map = { Critical: 'text-red-600 bg-red-50', High: 'text-yellow-600 bg-yellow-50', Medium: 'text-blue-600 bg-blue-50', Low: 'text-gray-600 bg-gray-100' };
        return map[p] || map.Medium;
    },

    getStatusClass: (s) => {
        const map = { 'In Progress': 'text-orange-600 bg-orange-50', Resolved: 'text-green-600 bg-green-50', Escalated: 'text-red-600 bg-red-50', Pending: 'text-yellow-600 bg-yellow-50', Open: 'text-gray-600 bg-gray-100' };
        return map[s] || map.Open;
    }
};

window.AdminApp = AdminApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AdminApp.init);
} else {
    AdminApp.init();
}
