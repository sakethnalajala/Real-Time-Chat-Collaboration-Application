# Nebula Chat — Real-Time Chat & Collaboration Platform

A full-stack, production-ready messaging platform: private and group conversations, live typing and presence, delivery and read receipts, file sharing, notifications and a protected admin area. It has a dark black and purple UI with a light mode.

**Stack:** React + Vite + Tailwind CSS · Node.js + Express · MongoDB + Mongoose · Socket.IO · JWT + bcrypt
**Deploys to:** Vercel (web) · Render (API + WebSockets) · MongoDB Atlas (database)

![Homepage](docs/screenshots/homepage.png)

| Dark mode chat | Light mode chat |
| --- | --- |
| ![Chat in dark mode](docs/screenshots/chat-dark.png) | ![Chat in light mode](docs/screenshots/chat-light.png) |

| Sign in with demo account cards | Admin profile |
| --- | --- |
| ![Login](docs/screenshots/login.png) | ![Admin profile](docs/screenshots/admin-profile.png) |

| Admin overview |
| --- |
| ![Admin dashboard](docs/screenshots/admin-dashboard.png) |

---

## Contents

1. [Features](#features)
2. [Technology stack](#technology-stack)
3. [Architecture](#architecture)
4. [Folder structure](#folder-structure)
5. [Getting started (local)](#getting-started-local)
6. [Demo accounts](#demo-accounts)
7. [Environment variables](#environment-variables)
8. [Scripts](#scripts)
9. [REST API](#rest-api)
10. [Socket.IO events](#socketio-events)
11. [Data model](#data-model)
12. [Security](#security)
13. [Testing](#testing)
14. [Deployment](#deployment) — [MongoDB Atlas](#1-mongodb-atlas) · [Cloudinary](#2-cloudinary-file-storage) · [Password reset (no email)](#3-password-reset-without-email) · [Render](#4-render-api) · [Vercel](#5-vercel-web-app)
15. [Troubleshooting](#troubleshooting)

---

## Features

### Authentication & accounts
- Register with full name, username, email, password and confirmation, plus an optional profile picture.
- Login with email and password, and logout.
- Sign out of all devices.
- Forgot password and reset password with single-use links that expire after 30 minutes. **No email service is needed:**
  - in development the reset link is shown on screen
  - in production an admin creates the link for the user
- Change password. Other devices are signed out automatically.
- JWT access tokens (15 min) kept in memory, plus rotating refresh tokens in **httpOnly cookies**. Reusing an old refresh token revokes that whole session chain.
- bcrypt password hashing, protected routes and role-based authorization (`user` / `admin`).

### Messaging
- One-to-one private chats and group chats, all in real time over **Socket.IO**.
- Persistent history in MongoDB with cursor-based infinite scroll (scrolling up loads older messages).
- **Typing indicators**, **online/offline presence** and **last seen**.
- **Delivered** (✓✓) and **read** (violet ✓✓) receipts. Groups also have a per-member "Message info" view.
- Unread counts per conversation, an "Unread messages" divider, and total unread in the sidebar and tab title.
- Edit messages (marked "edited"), delete for me, delete for everyone, and replies with quoted previews you can click to jump to.
- Emoji picker, and messages of 1–3 emoji shown large.
- Image and file sharing: picker, drag & drop and clipboard paste, with upload progress and a lightbox.
  The server checks each file's actual contents (magic bytes), not just its declared type.
- Optimistic sending with retry and discard. Retries are idempotent, so no duplicate messages.
- Conversation search with All / Unread / Groups filters, and a user directory with search.

### Groups
- **Create Group → name & image → select members → create → the chat opens.**
- Roles: owner, admin and member.
  - Admins add/remove members and edit the name, description and photo.
  - The owner promotes and demotes admins.
- Leave a group. Ownership passes on automatically when the owner leaves.
- The owner can delete the group for everyone.
- System messages record membership events (e.g. "Aarav added Maya").

### Notifications
- In-app notifications with a bell count.
- Toasts for incoming messages, desktop notifications while the tab is in the background, and an optional sound.
- Message notifications combine per conversation ("3 new messages").
- No notification is created while you are looking at that conversation.
- Notifications for group invites, role changes, moderation outcomes and account events.

### Profiles & settings
- Profile picture, full name, username, bio, email, online status and last seen.
- Edit your profile and change your password.
- Theme: dark, light or system. Toggles for desktop notifications, sound and message previews.

### Admin area (role protected)
- **Overview:** users, online now, messages today, conversations, open reports and suspended accounts. Charts show messages and sign-ups over 14 days, with a table view.
- **Users:**
  - Search and filters.
  - Detail pages with message, conversation and report counts.
  - Suspend with a reason, reactivate, force sign-out, create a password reset link, and edit a profile for moderation.
- **Conversations:** details only (members, message/file/report counts, activity). **Private message content is never shown.**
- **Reports:** users can report messages, users and groups. Admins see a saved copy of the reported content plus surrounding messages for context. Actions: dismiss, warn, remove message, suspend user.
- **Audit log** of every admin action.

### UI/UX
- **Homepage** (`/`):
  - Animated hero with a 3D parallax chat illustration.
  - Feature grid with a cursor spotlight, how-it-works steps, a scroll-animated product showcase, and security and call-to-action sections.
  - Full footer.
  - Shows "Open dashboard" to signed-in users.
- **Sign-in page:** a card for each demo account showing avatar, name, role, email and password, with **Fill credentials** and **Use demo account** buttons.
- **Back buttons** throughout the sign-in flow:
  - Sign in → home.
  - Register, forgot password and reset password → sign in.
- **Profile page:** animated gradient cover, a glowing avatar ring, an Admin badge, account and security cards, and an admin console with live stats for admins.
- **Animated dark/light theme switch** in the top-right corner of every page.
- Premium dark black and purple theme with light mode and a smooth theme cross-fade.
- Animated, collapsible sidebar.
- Spring-animated message bubbles and modals, and conversation-list reordering.
- Layouts for desktop, tablet and mobile. On mobile, list and chat are separate screens with a bottom navigation bar.
- Skeleton loaders, empty and error states, toasts, and a reconnecting banner.
- Respects the system's reduced-motion setting.

---

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, TanStack Query, Tailwind CSS v4, Framer Motion, Socket.IO client, React Hook Form + Zod, Recharts, emoji-picker-react, lucide-react, sonner |
| Backend | Node.js (≥ 22.12), Express 5, Socket.IO 4, Mongoose 9, Zod, jsonwebtoken, bcrypt (via `bcryptjs`), Multer, file-type, Helmet, CORS, express-rate-limit, Nodemailer, Cloudinary SDK |
| Database | MongoDB (Atlas in production; a local development instance is started automatically) |
| Testing | Vitest + Supertest + mongodb-memory-server + socket.io-client; Postman/Newman collection |
| Deployment | Vercel (frontend), Render (API + WebSockets), MongoDB Atlas |

> **Why `bcryptjs`?** It is the bcrypt algorithm in pure JavaScript and produces the same `$2b$` hashes. The native `bcrypt` package needs a C++ build toolchain on Windows and some hosts; `bcryptjs` installs anywhere. The cost factor is 12.

---

## Architecture

```
 Browser (React SPA on Vercel)
   │
   ├── REST  /api/*  ──► Vercel rewrite ──► Render: Express API ──► MongoDB Atlas
   │                     (same-site cookies)        │
   │                                                └──► Cloudinary (images & files)
   │
   └── Socket.IO (WebSocket, access token in the handshake) ──► Render: same Node process
```

- **MongoDB is the source of truth.** Every message is saved before it is sent to anyone.
- **Socket.IO is the live update layer.** Each connected socket joins a personal room `user:<id>`, and events go to every participant's room, so multiple tabs and devices work. Admins also join an `admins` room.
- **One write path.**
  - Messages are sent over REST (validated, rate-limited, testable in Postman).
  - The shared `messageCore` service saves them, updates conversation summaries and unread counters, emits `message:new`, and creates notifications.
  - Short-lived signals (typing, delivered/read receipts, presence, focus) travel over the socket.
- **Receipts from timestamps.** Each participant has "delivered up to" (`lastDeliveredAt`) and "read up to" (`lastReadAt`) timestamps. Ticks are derived from these, which scales to groups without storing a receipt per message per member.
- **After a reconnect** the client refetches anything that may have changed, so nothing is lost while offline.
- **Production auth.** `/api` goes through a Vercel rewrite, so the refresh cookie counts as first-party (Safari- and incognito-safe). Socket.IO connects directly to Render, because Vercel can't forward WebSockets.

---

## Folder structure

```
Real-Time-Chat/
├── client/                         React + Vite web app
│   ├── public/                     favicon
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/              stat tiles, charts, data table, filters
│   │   │   ├── chat/               list, header, bubbles, composer, modals, info panel
│   │   │   ├── group/              create-group wizard, add members, edit group
│   │   │   ├── layout/             animated sidebar, mobile nav, connection banner
│   │   │   ├── notifications/      notification item, message toast
│   │   │   ├── routing/            ProtectedRoute, GuestRoute, AdminRoute
│   │   │   └── ui/                 Button, Input, Avatar, Modal, Menu, Tabs, Skeleton…
│   │   ├── config/                 public env config
│   │   ├── context/                Auth, Socket, Theme providers
│   │   ├── hooks/                  realtime sync, chat actions, queries, utilities
│   │   ├── layouts/                App & Auth layouts
│   │   ├── pages/                  auth/, app/, admin/ pages
│   │   ├── services/               axios client (token refresh), API services, socket
│   │   ├── styles/                 Tailwind v4 theme tokens (dark/light)
│   │   └── utils/                  formatting, cache helpers, stores, validators
│   ├── .env.example
│   └── vercel.json                 rewrites (/api → Render), SPA fallback, headers
├── server/                         Express + Socket.IO API
│   ├── src/
│   │   ├── config/                 validated env, MongoDB connection, CORS
│   │   ├── controllers/            thin HTTP handlers
│   │   ├── middleware/             auth, validation, rate limits, uploads, errors
│   │   ├── models/                 User, Session, Conversation, Message, Notification, Report, AuditLog
│   │   ├── routes/                 auth, users, conversations, messages, notifications, reports, admin
│   │   ├── services/               business logic (+ storage/ drivers, mail, demo seed)
│   │   ├── sockets/                Socket.IO bootstrap, presence, handlers, emitter
│   │   ├── utils/                  errors, serializers, helpers, constants
│   │   ├── validators/             zod schemas
│   │   ├── scripts/                seed.js, dev-db.js
│   │   ├── app.js                  Express app
│   │   └── server.js               HTTP + Socket.IO bootstrap
│   ├── tests/                      Vitest API + socket tests
│   └── .env.example
├── postman/                        Postman collection + environments
├── scripts/dev.js                  one-command local runner
├── docs/screenshots/
├── render.yaml                     Render blueprint
├── .env.example                    production variable reference
└── README.md
```

---

## Getting started (local)

### Prerequisites
- **Node.js 22.12+** (tested on Node 24) and npm.
- **MongoDB running locally** on port 27017 (MongoDB Community Server or its Windows service).
  - The project uses the database **`real_time_chat`**: `MONGODB_URI=mongodb://localhost:27017/real_time_chat` in `server/.env`.
  - MongoDB creates the database automatically on first start, and the API seeds the demo accounts into it.
- **Production** uses the same `MONGODB_URI` variable, set to your MongoDB Atlas connection string (see [Deployment](#deployment)). The connection string is never hardcoded.
- **No MongoDB installed?** Leave `MONGODB_URI` empty and `npm run dev` starts a bundled development MongoDB instead.

### Install & run

```bash
# 1. install both apps
npm run install:all

# 2. configure the API (a server/.env is created automatically on first run if missing)
cp server/.env.example server/.env      # then set JWT_ACCESS_SECRET, demo passwords, etc.

# 3. start everything: checks MongoDB is reachable, then API (auto-reload) + Vite dev server
npm run dev
```

| Service | URL |
| --- | --- |
| Homepage | <http://localhost:5173> |
| App dashboard (after sign-in) | <http://localhost:5173/dashboard> |
| API | <http://localhost:5000> |
| Health check | <http://localhost:5000/api/health> |

- To test real-time features, open the app in **two different browsers** (or one normal and one private window) and sign in as two demo users.
- To reach the app from a phone on your network, open `http://<your-PC-IP>:5173`. The Vite proxy forwards API calls and WebSockets.

### Without the helper script

```bash
# make sure your local MongoDB service is running on :27017
cd server && npm run dev       # terminal 1 — API on :5000
cd client && npm run dev       # terminal 2 — web app on :5173
```

---

## Demo accounts

With `DEMO_MODE=true` (the default in development), the API creates four demo accounts on startup, plus sample conversations: two direct chats and one group.

The sign-in page shows a **card for each demo account** with its role, email and password.
- **Fill credentials** puts them into the form.
- **Use demo account** signs in straight away.

The passwords shown are the real ones configured on the server. Set `DEMO_SHOW_CREDENTIALS=false` to hide them and keep only one-click sign-in.

| Account | Email | Role |
| --- | --- | --- |
| Demo User 1 — Aarav Sharma | `aarav.demo@example.com` | user |
| Demo User 2 — Maya Chen | `maya.demo@example.com` | user |
| Demo User 3 — Liam Carter | `liam.demo@example.com` | user |
| Demo Admin — Nova Admin | `admin.demo@example.com` | **admin** |

- **Passwords** come from `DEMO_USER_PASSWORD` and `DEMO_ADMIN_PASSWORD` in `server/.env`, so you can also sign in with email and password, e.g. from Postman. If unset, strong random passwords are generated.
- **Safeguards for a public demo:**
  - Demo accounts can't change their password or username.
  - Demo accounts can't be password-reset.
  - The demo admin can only moderate **demo** accounts, never real users.
- **Resetting:** `npm run seed:reset` (in `/server`) restores the demo profiles and recreates the sample conversations.

---

## Environment variables

### Server (`server/.env` locally, Render environment in production)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | | `development` | `production` on Render |
| `PORT` | | `5000` | Render injects this |
| `MONGODB_URI` | **yes** | — | Local: `mongodb://localhost:27017/real_time_chat`. Production: your Atlas connection string |
| `MONGODB_DB_NAME` | | `real_time_chat` | Database name. Order of use: this variable, then the database in the URI, then `real_time_chat` (never the driver's default `test`) |
| `JWT_ACCESS_SECRET` | **prod** | random per process in dev | ≥ 32 random characters |
| `ACCESS_TOKEN_TTL` | | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | | `7` | Refresh session lifetime |
| `REFRESH_REUSE_GRACE_SECONDS` | | `15` | Tolerates two tabs refreshing at the same moment |
| `CLIENT_URL` | **prod** | `http://localhost:5173` | Frontend URL (CORS + reset links) |
| `CORS_ORIGINS` | | — | Extra allowed origins, comma separated |
| `COOKIE_SAMESITE` | | `lax` | `none` only if the browser calls Render directly |
| `COOKIE_SECURE` | | `true` in prod | Secure cookie flag |
| `TRUST_PROXY` | | `1` in prod | `2` when proxied by Vercel + Render |
| `STORAGE_DRIVER` | | `auto` | `auto` / `cloudinary` / `local` / `disabled` |
| `CLOUDINARY_CLOUD_NAME` | prod uploads | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | prod uploads | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | prod uploads | — | Cloudinary API secret (server only — never sent to the browser) |
| `MAX_FILE_SIZE_MB` / `MAX_FILES_PER_MESSAGE` | | `10` / `5` | Upload limits |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | no | empty | **Not used — leave empty.** Optional email support exists, but the app doesn't need it |
| `PASSWORD_RESET_TTL_MINUTES` | | `30` | Reset link lifetime |
| `DEMO_MODE` | | `true` in dev, `false` in prod | Demo accounts + one-click login |
| `DEMO_USER1_EMAIL` … `DEMO_ADMIN_EMAIL` | | `*.demo@example.com` | Demo account emails |
| `DEMO_USER_PASSWORD`, `DEMO_ADMIN_PASSWORD` | | random | Demo passwords |
| `DEMO_SHOW_CREDENTIALS` | | `true` | Show demo emails/passwords on the sign-in page (only while `DEMO_MODE` is on) |
| `LOG_LEVEL` | | `debug` dev / `info` prod | Logging verbosity |

**How the app behaves when credentials are missing:**
- **No Cloudinary:** development stores files on the local disk; production disables uploads. The UI says so and everything else keeps working.
- **No email (the default):** development shows the reset link on the Forgot Password page and in the API console. Production never reveals links; the page tells users to ask an administrator, who creates a reset link from **Admin → Users → user → Reset link**.

### Client (`client/.env.local` locally, Vercel environment in production)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Keep `/api` (Vite proxy in dev, Vercel rewrite in prod) |
| `VITE_SOCKET_URL` | current origin | **Production: your Render URL** (e.g. `https://nebula-chat-api.onrender.com`) |
| `VITE_APP_NAME` | `Nebula Chat` | Display name |
| `VITE_ENABLE_DEMO_LOGIN` | `true` | Show one-click demo accounts |
| `VITE_DEV_API_TARGET` | `http://localhost:5000` | Dev proxy target |

> Only `VITE_*` variables reach the browser. Never put secrets in the client environment.

---

## Scripts

| Where | Command | Purpose |
| --- | --- | --- |
| root | `npm run install:all` | Install server + client dependencies |
| root | `npm run dev` | API + web app together (checks MongoDB is reachable first) |
| root | `npm run build` | Production build of the web app |
| root | `npm test` | Run the API test suite |
| server | `npm run dev` / `npm start` | API with auto-reload / production start |
| server | `npm run db` | Optional bundled MongoDB, if you don't have one installed |
| server | `npm run seed` / `npm run seed:reset` | Create demo data / restore it |
| server | `npm run check:cloudinary` | Test the Cloudinary credentials with real uploads (cleaned up afterwards) |
| client | `npm run dev` / `npm run build` / `npm run preview` | Vite |

---

## REST API

**Base URL:** `/api`.
- **Success responses** look like `{ "success": true, "data": … }`.
- **Errors** look like `{ "success": false, "error": { "code", "message", "details?" } }`.
- **Authentication:** `Authorization: Bearer <accessToken>`. The refresh token is an httpOnly cookie.
- **Status codes used:** 200, 201, 204, 400 (validation), 401, 403, 404, 409, 413, 415, 429 and 503.

| Area | Method & path | Notes |
| --- | --- | --- |
| System | `GET /health` · `GET /config` | Health (DB status) · public, non-secret runtime config |
| Auth | `POST /auth/register` | JSON or multipart (optional `avatar`) |
| | `POST /auth/login` · `POST /auth/demo-login` | Demo login only when `DEMO_MODE=true` |
| | `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/logout-all` | Refresh rotates the cookie |
| | `POST /auth/forgot-password` · `GET/POST /auth/reset-password/:token` | Generic response (no account enumeration) |
| | `PATCH /auth/change-password` · `GET /auth/me` | |
| Users | `GET /users/search?q=&page=&limit=` · `GET /users/:idOrUsername` | Email only visible to self/admin |
| | `PATCH /users/me` · `PATCH /users/me/avatar` · `DELETE /users/me/avatar` | Profile & settings |
| Conversations | `GET /conversations?q=` · `GET /conversations/:id` | |
| | `POST /conversations/direct` | Get-or-create (201 when created) |
| | `POST /conversations/group` | multipart: `name`, `description`, `memberIds`, `image` |
| | `PATCH /conversations/:id` · `DELETE /conversations/:id` | Edit group / delete group (owner) or clear direct chat |
| | `POST /conversations/:id/members` · `DELETE /conversations/:id/members/:userId` | Group admins |
| | `PATCH /conversations/:id/members/:userId/role` · `POST /conversations/:id/leave` | Owner / any member |
| | `PATCH /conversations/:id/read` | Mark read |
| Messages | `GET /conversations/:id/messages?before=&after=&limit=` | Cursor pagination |
| | `POST /conversations/:id/messages` | JSON or multipart `files[]`; `replyTo`, `clientMsgId` |
| | `PATCH /messages/:id` · `DELETE /messages/:id?scope=me\|everyone` · `GET /messages/:id/info` | Edit · delete · receipts |
| Notifications | `GET /notifications` · `GET /notifications/unread-count` | |
| | `PATCH /notifications/:id/read` · `PATCH /notifications/read-all` · `DELETE /notifications/:id` · `DELETE /notifications` | |
| Reports | `POST /reports` | `targetType`: user / message / conversation |
| Admin (admin role) | `GET /admin/stats` | Totals, 14-day series, recent activity |
| | `GET /admin/users` · `GET /admin/users/:id` · `PATCH /admin/users/:id` | Search/filter · detail · moderation edit |
| | `PATCH /admin/users/:id/status` · `POST /admin/users/:id/force-logout` | Suspend/reactivate · end sessions |
| | `POST /admin/users/:id/reset-link` | Create a single-use password reset link (no email needed) |
| | `GET /admin/conversations` · `GET /admin/conversations/:id` | Conversation details only |
| | `GET /admin/reports` · `GET /admin/reports/:id` · `PATCH /admin/reports/:id` | Queue · evidence & context · resolve |
| | `DELETE /admin/messages/:id` · `GET /admin/audit-logs` | Moderation removal · audit trail |

The full, runnable reference is in `postman/` (see [Testing](#testing)).

---

## Socket.IO events

- **Connecting:** pass the access token as `io(SOCKET_URL, { auth: { token } })`.
- **Rejected connections** return `connect_error` with a code (`TOKEN_EXPIRED`, `INVALID_TOKEN`, `TOKEN_REVOKED`, `ACCOUNT_SUSPENDED`). The client refreshes its token and reconnects.
- **Every client → server event** is validated and checked for conversation membership, rate-limited per socket, and replies with an ack `{ ok, error? }`.

**Client → server**

| Event | Payload | Effect |
| --- | --- | --- |
| `typing:start` / `typing:stop` | `{ conversationId }` | Relays `typing:update` to the other members |
| `message:delivered` | `{ conversationId, messageId }` | Advances your "delivered up to" timestamp |
| `conversation:read` | `{ conversationId }` | Advances your "read up to" timestamp and resets unread |
| `conversation:focus` | `{ conversationId \| null }` | Suppresses notifications for the open chat |
| `presence:query` | `{ userIds[] }` | Ack returns `{ presence: { id: { isOnline, lastSeen } } }` |

**Server → client**

| Event | Payload |
| --- | --- |
| `presence:snapshot` · `presence:online` · `presence:offline` | `{ online[] }` · `{ userId }` · `{ userId, lastSeen }` |
| `message:new` | `{ conversationId, message, lastMessage, lastMessageAt }`: new messages, replies, group and system messages |
| `message:updated` · `message:deleted` | `{ conversationId, message }` · `{ conversationId, messageId, scope, message? }` |
| `receipt:update` | `{ conversationId, userId, type: 'delivered' \| 'read', at }` |
| `typing:update` | `{ conversationId, userId, name, isTyping }` |
| `conversation:new` · `conversation:updated` · `conversation:removed` | `{ conversation }` · `{ conversation }` · `{ conversationId, reason }` |
| `user:updated` | `{ user }`: profile changes pushed to your contacts |
| `notification:new` · `notification:count` | `{ notification }` · `{ unread }` |
| `account:suspended` · `account:logout` | Forces the client to sign out |
| `admin:report` · `admin:presence` | Live admin dashboard updates (`admins` room) |

---

## Data model

| Model | Key fields / relationships |
| --- | --- |
| **User** | fullName, username (unique), email (unique), password (bcrypt, never returned), avatar, bio, role, status, lastSeen, settings, tokenVersion |
| **Conversation** | `type` (direct/group) and `participants[]`. Each participant has `user`, `role`, `joinedAt`, `lastDeliveredAt`, `lastReadAt`, `unreadCount` and `clearedAt`. Groups also store `group{name, description, avatar}`. `directKey` is unique to prevent duplicate DMs. `lastMessage` is kept as a summary. |
| **Message** | conversation → Conversation, sender → User, type, content, attachments[], replyTo → Message, editedAt, isDeleted / deletedFor[], clientMsgId (idempotency) |
| **Notification** | recipient → User, actor, type, conversation/message/report refs, title, body, count, isRead. Expires after 90 days (TTL index). |
| **Report** | reporter, target (user/message/conversation), reason, details, evidence snapshot, status, resolution |
| **Session** | user, SHA-256 of the refresh token, family (for rotation), expiry (TTL index), revocation |
| **AuditLog** | admin actor, action, target, metadata |

- **Users ↔ Conversations** is many-to-many through `participants[]`.
- **Conversations → Messages** is one-to-many. Messages are referenced, not embedded, so a conversation's history can grow without limit.
- **Users → Notifications** is one-to-many.
- Indexes cover membership lookups, history pagination, unread queries and uniqueness.

---

## Security

**Passwords and tokens**
- Passwords are hashed with bcrypt (cost 12). "Confirm password" is validated on both client and server.
- Login errors don't reveal whether an email is registered, and response timing is evened out.
- Access tokens live in memory only. Refresh tokens are random values stored as SHA-256 hashes, sent in **httpOnly, Secure, SameSite** cookies scoped to `/api/auth`, and rotated on every use. Reusing an old token revokes that whole session chain.
- Changing or resetting a password and admin suspension all invalidate existing access tokens and sessions immediately, and disconnect that user's sockets.

**Access control**
- Every protected route requires a valid token, a matching token version and an active account.
- Admin routes also require the `admin` role.
- Conversation endpoints return 404 to non-members, so conversation IDs can't be probed.

**Input and files**
- Every body, query, parameter and socket payload is validated with Zod. Unknown fields are dropped, which blocks attempts like self-assigning `role`. Search text is escaped before use.
- **Uploads:**
  - Allowed types only, with size and count limits.
  - The file's real contents are checked (magic bytes), so a disguised `.exe` named `.pdf` is rejected.
  - File names are sanitised.
  - Files are served with `nosniff` and a sandboxing CSP; non-images download instead of rendering.

**HTTP**
- Helmet headers, a CORS allowlist driven by env, and JSON body limits.
- Rate limits on the whole API, login, demo login, registration, password reset, refresh, sending messages, uploads and reports. Socket events are throttled per connection.

**Configuration and errors**
- Configuration is validated at startup, and the server refuses to start in production without `MONGODB_URI` and a strong `JWT_ACCESS_SECRET`. No secrets are hardcoded or sent to the client.
- A central error handler returns consistent JSON and never shows stack traces in production.

---

## Testing

### Automated API + realtime tests

```bash
npm test            # from the root (or: cd server && npm test)
```

- **43 tests** with Vitest, Supertest and an in-memory MongoDB.
- **Areas covered:** registration validation, login, JWT protection, refresh-token rotation and reuse detection, logout, change and reset password, admin route protection, profiles and avatar validation, direct and group chats, unread and read state, replies, edits, deletes, uploads with spoof rejection, cursor pagination, aggregated notifications, reports and moderation, suspension, and the audit log.
- **Socket.IO tests (real client):** presence, `message:new`, delivered/read receipts, typing, membership checks, edits/deletes, notification suppression while viewing a chat, and offline last-seen.

### Postman / Newman

Import `postman/Nebula-Chat.postman_collection.json` and `postman/Nebula-Chat-Local.postman_environment.json`.

- **Start here:** run **Auth → Demo login (user1)**.
- **Chaining:** the access token and IDs (`otherUserId`, `conversationId`, `messageId`, `reportId`, …) are captured automatically, so you can run the folders in order or use the Collection Runner.
- **Size:** 62 requests with 131 assertions.

```bash
npx newman run postman/Nebula-Chat.postman_collection.json \
  -e postman/Nebula-Chat-Local.postman_environment.json \
  --env-var "password=<DEMO_USER_PASSWORD from server/.env>"
```

### Manual end-to-end check

1. Sign in as Aarav in one browser and as Maya in another.
2. Type a message: the other window shows "typing…".
3. Send it: it appears instantly, and the ticks turn violet once it's read.
4. Reply, edit, delete, share an image and post in the group: the other user gets a notification toast.
5. Report a message, then review it as **Demo Admin**.

---

## Deployment

**Order:**
1. Atlas
2. Cloudinary (needed for uploads in production)
3. Render (API)
4. Vercel (web)
5. Update the Render `CLIENT_URL` setting

### 1. MongoDB Atlas
> **Already done for this project:** the local `real_time_chat` database (7 collections, 29 documents, all indexes) was migrated to **Atlas Cluster0 → `real_time_chat`** and verified byte-for-byte. Other databases in the cluster were not touched. On Render, just set `MONGODB_URI` to your Cluster0 connection string; `MONGODB_DB_NAME=real_time_chat` is already in `render.yaml`.

To set up a fresh cluster instead:

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. **Database Access:** add a database user with a strong password and the *Read and write to any database* role (or scope it to `real_time_chat`).
3. **Network Access:** add `0.0.0.0/0`. Render's free tier has no fixed outbound IP, so the strong password is your protection.
4. **Connect → Drivers:** copy the SRV string and add the database name:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/real_time_chat?retryWrites=true&w=majority`
5. Optional: seed from your machine by setting this as `MONGODB_URI` in `server/.env` and running `npm run seed`. With `DEMO_MODE=true` the API also seeds automatically on its first start.

### 2. Cloudinary (file storage)
- Render's disk is wiped on every deploy and restart, so production files must go to cloud storage.
- Create a free account at <https://cloudinary.com>. In the console, open **Settings → API Keys** and copy your **cloud name**, **API key** and **API secret** into three separate variables:
  ```
  CLOUDINARY_CLOUD_NAME=
  CLOUDINARY_API_KEY=
  CLOUDINARY_API_SECRET=
  ```
- With `STORAGE_DRIVER=auto`, Cloudinary switches on automatically once all three are set. Until then, development falls back to local disk.
- **Test your credentials** with `npm run check:cloudinary` (in `/server`). It uploads a test image, an avatar-style image and a file, then deletes them.
- The API secret stays on the server: uploads are signed by the API, and the browser only receives the resulting image/file URLs.
- Images, avatars and documents go to `nebula-chat/{avatars,groups,messages/<conversationId>}`.

### 3. Password reset without email
Nothing to configure. This project deliberately uses no email service, so leave the `SMTP_*` variables empty.

- **Development** (`NODE_ENV=development`): "Forgot password" creates the reset link and shows it on the page, and prints it in the API console.
- **Production** (Render): reset links are never shown to the person asking, because anyone could type someone else's email. The Forgot Password page instead explains how to get a link:
  1. The user asks an administrator.
  2. The admin opens **Admin → Users → the user → Reset link** and copies the single-use link (valid for `PASSWORD_RESET_TTL_MINUTES`, default 30).
  3. The admin sends the link to the user directly.
  4. When the user sets a new password, all of their other sessions are signed out.
- Links can't be created for administrators, for yourself, or for demo accounts. Every link is recorded in the audit log, without the token.

### 4. Render (API)
1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repo. `render.yaml` creates the `nebula-chat-api` web service from `/server`, with build `npm ci --omit=dev`, start `npm start` and health check `/api/health`.
   - Or do it manually: **New → Web Service**, root directory `server`, runtime Node, the same build and start commands, and env var `NODE_VERSION=22`.
3. Fill in the prompted variables: `MONGODB_URI`, `CLIENT_URL` (temporarily `https://example.com`), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and the demo passwords. No email/SMTP settings are needed. `JWT_ACCESS_SECRET` is generated automatically.
4. Deploy, then open `https://<your-service>.onrender.com/api/health`. It should return `"database":"connected"`.

### 5. Vercel (web app)
1. Edit `client/vercel.json` and replace both `YOUR-RENDER-SERVICE.onrender.com` placeholders with your Render host, then commit.
2. In Vercel, choose **Add New → Project**, import the repo and set **Root Directory: `client`**. The framework (Vite), build command and output directory are detected.
3. Environment variables:
   - `VITE_API_URL=/api`
   - `VITE_SOCKET_URL=https://<your-service>.onrender.com`
   - `VITE_ENABLE_DEMO_LOGIN=true`
4. Deploy. Then on Render, set `CLIENT_URL=https://<your-app>.vercel.app` (add preview URLs to `CORS_ORIGINS` if needed) and redeploy.

### Production checklist
- [ ] `/api/health` reports `database: connected`.
- [ ] Sign in works and survives a page reload (refresh cookie through the `/api` rewrite).
- [ ] Two browsers exchange messages instantly. If not, check `VITE_SOCKET_URL` and `CLIENT_URL`/CORS on Render.
- [ ] Image upload works (Cloudinary).
- [ ] As an admin, **Reset link** on a user's page produces a working link (Forgot Password shows the "ask an administrator" panel).
- [ ] The Demo Admin can open `/admin`, and demo users get "403" on `/api/admin/*`.

**Free-tier note:** Render's free instances sleep after about 15 minutes idle. The first request then takes around 50 seconds. The app shows a "Connecting to live updates…" banner and reconnects automatically.

**Scaling beyond one instance:** presence is kept in server memory. Add Redis with `@socket.io/redis-adapter` and turn on sticky sessions before running several API instances.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| First `npm run dev` waits on `[db]` | The MongoDB binary is downloading (one time, ~1–2 min). |
| `MongoDB is not reachable at localhost:27017` | Start your MongoDB service (Windows: `net start MongoDB` as administrator, or start it from *Services*). |
| `MONGODB_URI is not set` | Add `MONGODB_URI=mongodb://localhost:27017/real_time_chat` to `server/.env`. |
| API restarts by itself during development | Cloud-sync tools (OneDrive/Dropbox) touch files and trigger `node --watch`. Keep the project outside a synced folder for the smoothest experience. |
| Logged out on every reload in production | Keep `VITE_API_URL=/api` with the Vercel rewrite, so the cookie is first-party. If you call Render directly, set `COOKIE_SAMESITE=none`. |
| Messages only appear after refresh | `VITE_SOCKET_URL` must point at Render, and Render's `CLIENT_URL`/`CORS_ORIGINS` must include the Vercel URL. |
| Uploads say "not configured" in production | Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` on Render. |
| `429 Too many requests` | A rate limiter tripped. Wait for the window to pass (or restart the dev API). |
