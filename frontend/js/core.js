import API from './api.js';

/**
 * Core Application Logic
 * Handles navigation, auth guards, and global initialization.
 */

const Core = {
    init: () => {
        Core.log("Initializing App...");

        // 1. Check Auth (Skip for index/auth pages)
        const path = window.location.pathname;
        const isPublic = path.endsWith('index.html') || path.endsWith('auth.html') || path === '/';

        const user = API.getCurrentUser();

        if (!isPublic) {
            if (!user) {
                Core.log("No session found, redirecting to login.");
                window.location.href = 'auth.html';
                return;
            }

            // Role Guard
            Core.checkRoleAccess(user, path);

            // Initialize User Header
            Core.updateHeader(user);
        }

        // 2. Bind Global Events
        Core.bindEvents();

        // 3. Handle Initial Navigation (Hash or Default)
        if (!isPublic) {
            // Default view based on role or URL hash? 
            // For simplicity, dashboard starts at 'overview' or 'dashboard'
            // We can read the current active class if set in HTML, or default to first.
            const activeView = document.querySelector('.view-section.active');
            if (!activeView) {
                Core.navTo('overview'); // Default fallback
            }
        }

        // 4. Landing Page Logic (Carousel, etc.)
        if (isPublic && document.getElementById('testimonial-track')) {
            Core.initLanding();
        }
    },

    /**
     * Landing Page specific logic
     */
    initLanding: () => {
        // Carousel
        const track = document.getElementById('testimonial-track');
        if (track) {
            const originalCards = Array.from(track.children);
            const progressBar = document.getElementById('progress-bar');
            const wrapper = document.getElementById('carousel-wrapper');

            let index = 0;
            const totalSlides = originalCards.length;
            const intervalTime = 3000;
            let intervalId;
            let isHovered = false;

            const clone = originalCards[0].cloneNode(true);
            track.appendChild(clone);

            const updateCarousel = () => {
                if (isHovered) return;
                index++;
                track.style.transition = 'transform 0.7s cubic-bezier(0.25, 1, 0.5, 1)';
                track.style.transform = `translateX(-${index * 100}%)`;

                if (progressBar) {
                    progressBar.style.transition = 'none';
                    progressBar.style.width = '0%';
                    setTimeout(() => {
                        progressBar.style.transition = `width ${intervalTime}ms linear`;
                        progressBar.style.width = '100%';
                    }, 50);
                }

                if (index === totalSlides) {
                    setTimeout(() => {
                        track.style.transition = 'none';
                        index = 0;
                        track.style.transform = 'translateX(0)';
                    }, 700);
                }
            };

            intervalId = setInterval(updateCarousel, intervalTime);
            if (progressBar) progressBar.style.width = '100%';

            wrapper.addEventListener('mouseenter', () => { isHovered = true; if (progressBar) progressBar.style.width = '0%'; });
            wrapper.addEventListener('mouseleave', () => { isHovered = false; if (progressBar) progressBar.style.width = '100%'; });
        }

        // Scroll Spy
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav-link');
        const observerOptions = { root: null, threshold: 0.3, rootMargin: "-10% 0px -10% 0px" };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    navLinks.forEach(link => link.classList.remove('active'));
                    const id = entry.target.getAttribute('id');
                    const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
                    if (activeLink) activeLink.classList.add('active');
                }
            });
        }, observerOptions);
        sections.forEach(section => observer.observe(section));

        // Reveal Animation
        const revealElements = document.querySelectorAll('.reveal');
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('active');
            });
        }, { threshold: 0.1 });
        revealElements.forEach(el => revealObserver.observe(el));
    },

    /**
     * Ensure user is on the correct page for their role
     */
    checkRoleAccess: (user, path) => {
        if (user.role === 'student' && !path.includes('student_dashboard')) {
            window.location.href = 'student_dashboard.html';
        } else if (user.role === 'admin' && !path.includes('normal_admin')) {
            window.location.href = 'normal_admin.html';
        } else if (user.role === 'superadmin' && !path.includes('superadmin')) {
            window.location.href = 'superadmin.html';
        }
    },

    /**
     * Update the user info in the header
     */
    updateHeader: (user) => {
        // Update name
        const headerName = document.getElementById('header-user-name');
        if (headerName) headerName.innerText = user.name || 'User';

        // Update student ID / roll number beneath the name
        const headerStudentId = document.getElementById('header-student-id');
        if (headerStudentId) {
            headerStudentId.innerText = user.studentId || user.department || user.role || '';
        }

        // Update avatar initials
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar && user.name) {
            const initials = user.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            headerAvatar.innerText = initials;
        }

        // Setup Logout
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.onclick = () => {
                if (confirm("Are you sure you want to log out?")) {
                    API.logout();
                    window.location.href = 'index.html';
                }
            };
        }
    },

    /**
     * Global Navigation Function
     * Switches the Active View and Active Nav Item
     * @param {string} viewName - The ID suffix for the view (e.g. 'overview' for 'view-overview')
     */
    navTo: (viewName) => {
        Core.log(`Navigating to: ${viewName}`);

        // 1. Hide all Views
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));

        // 2. Deactivate all Nav Items
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        // 3. Show Target View
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.classList.add('active');
        } else {
            console.warn(`[Core] View not found: view-${viewName}`);
        }

        // 4. Activate Target Nav Item
        const targetNav = document.getElementById(`nav-${viewName}`);
        if (targetNav) {
            targetNav.classList.add('active');
        }

        // 5. Update Breadcrumb (if exists)
        // Helper to map view ID to a Title (Simple capitalization or lookup)
        const breadcrumb = document.getElementById('breadcrumb-current');
        if (breadcrumb) {
            breadcrumb.innerText = viewName.charAt(0).toUpperCase() + viewName.slice(1).replace(/-/g, ' ');
        }
    },

    /**
     * Binds click events to all elements with ID starting with 'nav-'
     */
    bindEvents: () => {
        // Auto-bind navigation clicks
        document.body.addEventListener('click', (e) => {
            // Find closest nav-item parent if clicked inside
            const navItem = e.target.closest('.nav-item');
            if (navItem && navItem.id && navItem.id.startsWith('nav-')) {
                const viewName = navItem.id.replace('nav-', '');
                Core.navTo(viewName);
            }
        });
    },

    log: (msg) => {
        if (window.ANTIGRAVITY_DEBUG) console.log(`[Core] ${msg}`);
    }
};

// Global Debug Flag
window.ANTIGRAVITY_DEBUG = true;

// Expose Core globally
window.Core = Core;

// Init on Load
document.addEventListener('DOMContentLoaded', Core.init);

export default Core;
