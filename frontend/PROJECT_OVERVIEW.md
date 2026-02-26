# 📋 Grievance.io — Project Overview & Technical Documentation

> A full-stack University Grievance Management System built with Node.js, Express, MongoDB, and vanilla HTML/CSS/JS.

---

## 🎯 What Is This Project?

**Grievance.io** is a web-based platform that allows university students to file, track, and resolve grievances (complaints) against the institution. It provides a structured workflow where:

- **Students** file grievances and track their status in real time
- **Admins** (department heads) review, respond to, and resolve cases in their department
- **Super Admins** oversee all departments, manage admin accounts, and handle escalated cases

The system replaces manual complaint boxes and email chains with a transparent, trackable, and accountable digital process.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Browser)                   │
│  HTML + Tailwind CSS + Vanilla JS (ES Modules)          │
│  auth.html │ student_dashboard.html │ normal_admin.html  │
│  superadmin.html │ index.html                           │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP REST API (fetch)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js + Express)             │
│  server.js → routes → middleware → models               │
│  Port: 5000                                             │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────────┐
│  MongoDB Atlas   │      │  Brevo SMTP (Nodemailer)     │
│  (Cloud/Remote)  │      │  OTP emails + Resolution      │
│  grievancedb     │      │  notifications               │
└──────────────────┘      └──────────────────────────────┘
```

---

## 🛠️ Technologies Used

### Backend
| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | v18+ | JavaScript runtime |
| **Express.js** | v5.x | Web framework / REST API |
| **MongoDB** | v6+ | NoSQL database |
| **Mongoose** | v9.x | MongoDB ODM (Object Document Mapper) |
| **JSON Web Tokens (JWT)** | jsonwebtoken v9 | Authentication & session management |
| **bcryptjs** | v3.x | Password hashing (salt rounds: 10) |
| **Nodemailer** | v8.x | Email sending via Brevo SMTP |
| **Multer** | v2.x | File upload handling (attachments) |
| **dotenv** | v17.x | Environment variable management |
| **cors** | v2.x | Cross-Origin Resource Sharing |

### Frontend
| Technology | Purpose |
|---|---|
| **HTML5** | Page structure |
| **Tailwind CSS** (CDN) | Utility-first styling |
| **Vanilla JavaScript** (ES Modules) | Logic, API calls, DOM manipulation |
| **Google Fonts** (Inter + Playfair Display) | Typography |
| **Fetch API** | HTTP requests to backend |

---

## 🗄️ Database Design (MongoDB)

### Collection: `users`

```js
{
  _id: ObjectId,
  name: String,           // Full name
  email: String,          // Unique, lowercase — used for login
  password: String,       // bcrypt hashed (never stored plain)
  role: String,           // "student" | "admin" | "superadmin"
  department: String,     // Admin's department (e.g. "Hostel", "Finance")
  phone: String,          // Optional contact number
  studentId: String,      // Roll number / student ID
  isActive: Boolean,      // Soft disable accounts without deleting
  resetOtp: String,       // 6-digit OTP for password reset (null when unused)
  resetOtpExpiry: Date,   // OTP expiry timestamp (10 minutes)
  createdAt: Date,
  updatedAt: Date
}
```

**Key design decisions:**
- Passwords are **never stored in plain text** — bcrypt hashes with 10 salt rounds
- `pre('save')` hook hashes password only when modified (Mongoose v9 async, no `next()`)
- `toJSON()` method strips `password` from all API responses automatically
- `isActive: false` disables login without deleting the account

---

### Collection: `cases`

```js
{
  _id: ObjectId,
  caseId: String,         // Auto-generated: "G-1024" (pre-save hook, Mongoose v9)
  category: String,       // "Hostel & Mess" | "Academic & Exams" | etc.
  subject: String,        // Short title of the grievance
  description: String,    // Full description
  priority: String,       // "Low" | "Medium" | "High" | "Critical"
  status: String,         // "Open" | "Pending" | "In Progress" | "Escalated" | "Resolved" | "Closed"
  department: String,     // Mapped from category — routes to correct admin
  student: ObjectId,      // Ref → users
  studentName: String,    // Cached name (supports anonymous cases)
  isAnonymous: Boolean,   // If true, student identity hidden from admins
  assignedAdmin: ObjectId,// Ref → users
  assignedAdminName: String,
  attachments: [{         // Files uploaded with the case
    filename: String,     // Stored filename (UUID)
    originalName: String, // Original upload name
    mimetype: String,
    size: Number,
    path: String
  }],
  messages: [{            // Threaded conversation log
    sender: String,       // "Student" | "Admin" | "SuperAdmin"
    senderId: ObjectId,
    text: String,
    isInternal: Boolean,  // Reserved for future use (currently unused in UI)
    time: Date
  }],
  slaDeadline: Date,      // Auto-set by priority: Critical=4h, High=24h, Medium=72h, Low=168h
  resolvedAt: Date,
  escalatedTo: String,
  escalationReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Key design decisions:**
- `caseId` auto-generated in `pre('save')` hook (Mongoose v9 — no `next()` parameter)
- `slaDeadline` auto-set based on priority in the same pre-save hook
- `messages` is an embedded array — keeps all case data in one document for fast reads
- Attachments served statically from `/uploads/` folder

---

## 🔐 Authentication & Security

### How Login Works
1. User submits email + password to `POST /api/auth/login`
2. Server finds user by email, checks `isActive`
3. `bcrypt.compare()` verifies password against stored hash
4. On success: JWT signed with `JWT_SECRET`, expires in 7 days
5. Token + user object stored in `localStorage`
6. Every protected API request sends `Authorization: Bearer <token>`
7. Server redirects to correct dashboard based on `role`

### JWT Middleware (`backend/middleware/auth.js`)
- Extracts token from `Authorization: Bearer` header
- Verifies signature with `JWT_SECRET`
- Attaches `req.user` for downstream route handlers
- `restrictTo(...roles)` — role-based access control (RBAC)

### Password Reset Flow (OTP-based)
```
POST /api/auth/forgot-password  →  Generate 6-digit OTP, save to user, send email
POST /api/auth/verify-otp       →  Check OTP + expiry, return short-lived reset JWT
POST /api/auth/reset-password   →  Verify reset JWT, hash new password, clear OTP
```

> ⚠️ Email (Nodemailer) requires a valid **Brevo API Key** (SMTP Password) in `.env`. Without it, OTP emails won't send, though the system remains otherwise functional.

---

## 📡 API Endpoints

### Auth Routes (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register new student |
| POST | `/login` | Public | Login (any role) |
| GET | `/me` | Private | Get current user |
| PUT | `/change-password` | Private | Change password |
| POST | `/forgot-password` | Public | Send OTP to email |
| POST | `/verify-otp` | Public | Verify OTP → get reset token |
| POST | `/reset-password` | Public | Reset password with token |

### Case Routes (`/api/cases`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/` | Student | File a new grievance (multipart/form-data) |
| GET | `/my` | Student | Get own cases |
| GET | `/department` | Admin | Get department cases (with filters) |
| GET | `/all` | SuperAdmin | Get all cases |
| GET | `/escalated` | SuperAdmin | Get escalated/critical cases |
| GET | `/stats` | All | Dashboard statistics |
| GET | `/:id` | All | Get single case with messages |
| PUT | `/:id/status` | Admin/SA | Change case status + add remark |
| PUT | `/:id/escalate` | Admin | Escalate case to higher authority |
| POST | `/:id/message` | All | Send message in thread |
| PUT | `/:id/resolve` | Admin/SA | Resolve case + send email notification |

### Admin Routes (`/api/admin`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/list` | SuperAdmin | List all admins |
| POST | `/create` | SuperAdmin | Create new admin account |
| PUT | `/:id` | SuperAdmin | Update admin details |
| DELETE | `/:id` | SuperAdmin | Delete admin account |

---

## 📁 Project File Structure

```
grivience.io/
│
├── server.js                    # Express app entry point, static file serving
├── .env                         # Environment variables (not committed to git)
├── package.json                 # Dependencies & npm scripts
├── PROJECT_OVERVIEW.md          # This file
│
├── backend/
│   ├── models/
│   │   ├── User.js              # User schema — pre-save bcrypt hook (Mongoose v9)
│   │   └── Case.js              # Case schema — pre-save caseId + SLA hook (Mongoose v9)
│   ├── routes/
│   │   ├── auth.js              # Login, register, forgot/reset password
│   │   ├── cases.js             # CRUD + messaging + file upload + resolve
│   │   └── admin.js             # Admin management (superadmin only)
│   ├── middleware/
│   │   └── auth.js              # JWT verification + role guard (protect + restrictTo)
│   ├── utils/
│   │   └── mailer.js            # Nodemailer email utility (OTP + resolution emails)
│   └── seed.js                  # Database seeder — creates 3 demo users + 3 cases
│
├── js/
│   ├── api.js                   # Frontend API client (all fetch calls, token management)
│   ├── core.js                  # Shared UI utilities (navigation, auth guard)
│   ├── student.js               # Student dashboard logic + renderAttachments
│   ├── admin.js                 # Admin dashboard logic + renderAttachments
│   ├── superadmin.js            # SuperAdmin dashboard logic
│   └── case.js                  # Case detail view logic
│
├── auth.html                    # Login / Register / Forgot Password page
├── index.html                   # Landing page (redirects to auth if not logged in)
├── student_dashboard.html       # Student portal (file grievance, track cases, chat)
├── normal_admin.html            # Admin portal (manage dept cases, chat, escalate)
├── superadmin.html              # SuperAdmin portal (all cases, admin management)
│
└── uploads/                     # Uploaded case attachments (auto-created by multer)
```

---

## 🚀 How to Run

### Prerequisites
- Node.js v18+
- MongoDB running locally on port 27017

### Steps

```bash
# 1. Install dependencies
cd grivience.io
npm install

# 2. Seed the database with demo accounts
node backend/seed.js

# 3. Start the server
node server.js
```

### Demo Accounts (after seeding)
| Role | Email | Password | Dashboard |
|---|---|---|---|
| 🎓 Student | `student@demo.com` | `demo` | student_dashboard.html |
| 🛡️ Admin (Hostel) | `admin@demo.com` | `demo` | normal_admin.html |
| 👑 SuperAdmin | `super@demo.com` | `demo` | superadmin.html |

### Access the App
- **Login**: http://localhost:5000/auth.html
- **Landing**: http://localhost:5000/index.html
- **API Base**: http://localhost:5000/api

---

## 🔄 Grievance Lifecycle

```
Student files case
      ↓
   [Open]
      ↓
Admin reviews → [In Progress]
      ↓
  ┌───┴───┐
  │       │
Resolve  Escalate
  ↓       ↓
[Resolved] [Escalated] → SuperAdmin reviews
  ↓                           ↓
Email sent              [Resolved]
to student                    ↓
                         Email sent to student
```

---

## 📎 Attachment Handling

- Students can upload files (images + PDFs) when filing a grievance
- Files stored in `/uploads/` folder via **Multer**
- Served statically at `http://localhost:5000/uploads/<filename>`
- Admin and student dashboards render attachments dynamically — clickable cards that open the file in a new tab
- If no attachments: shows *"No attachments."* message
- Accepted: JPG, PNG, GIF, PDF — Max 5MB per file

---

## 👥 User Roles & Permissions

| Feature | Student | Admin | SuperAdmin |
|---|---|---|---|
| File grievance | ✅ | ❌ | ❌ |
| View own cases | ✅ | ❌ | ❌ |
| View department cases | ❌ | ✅ | ✅ |
| View all cases | ❌ | ❌ | ✅ |
| Change case status | ❌ | ✅ | ✅ |
| Escalate case | ❌ | ✅ | ❌ |
| Resolve case | ❌ | ✅ | ✅ |
| Manage admins | ❌ | ❌ | ✅ |
| View analytics | ❌ | ✅ (dept) | ✅ (all) |

---

## ⚠️ Known Issues & Notes

| Brevo SMTP credentials | ✅ Fixed | Configure `SMTP_PASS` in `.env` with your Brevo API Key for email notifications. |
| Mongoose v9 pre-save hooks | ✅ Fixed | Removed `next()` parameter from all async pre-save hooks in `User.js` and `Case.js` |
| Internal Notes tab | ✅ Removed | Removed from both `normal_admin.html` and `superadmin.html` — feature was UI-only and not wired to backend |
| Hardcoded attachment UI | ✅ Fixed | All 3 dashboards now render attachments dynamically from real case data |

---

## 🎨 Design Philosophy

- **Apple-inspired UI**: Clean, minimal, lots of whitespace, rounded corners
- **Glassmorphism**: Frosted glass cards with backdrop blur
- **Dark/Light contrast**: Black primary color on white/gray backgrounds
- **Responsive**: Works on mobile and desktop
- **Role-based dashboards**: Each role sees only what's relevant to them

---

## 🚀 Deployment (Render)

The project is configured for easy deployment to **Render**.

### Environment Variables
Setup the following variables in the Render dashboard:
- `NODE_ENV`: `production`
- `MONGO_URI`: Your MongoDB Atlas connection string
- `JWT_SECRET`: A long random string
- `SMTP_PASS`: Your Brevo API Key
- `MAIL_FROM_EMAIL`: `chiks0950@gmail.com` (Verified sender)
- `MAIL_FROM_NAME`: `Grievance.io`
- `SMTP_USER`: `a2be5b001@smtp-brevo.com`

### Commands
- **Build Command**: `npm install`
- **Start Command**: `npm start`

---

*Grievance.io © 2025 — University Grievance Management System*
