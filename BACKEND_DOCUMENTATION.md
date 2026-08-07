# NetQuiz Backend — Complete Documentation

> **Stack:** Node.js · Express · TypeScript · MongoDB (Mongoose) · Firebase Admin SDK  
> **Server entry point:** `index.ts` — Port `5001` (default)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Environment Variables](#3-environment-variables)
4. [Tech Stack & Dependencies](#4-tech-stack--dependencies)
5. [Configuration](#5-configuration)
6. [Middleware](#6-middleware)
7. [Data Models (Schemas)](#7-data-models-schemas)
8. [API Routes](#8-api-routes)
   - [Auth Routes `/auth`](#81-auth-routes-auth)
   - [Curriculum Routes `/curriculum`](#82-curriculum-routes-curriculum)
   - [Questions Routes `/questions`](#83-questions-routes-questions)
   - [Submissions Routes `/submissions`](#84-submissions-routes-submissions)
   - [Progress Routes `/progress`](#85-progress-routes-progress)
   - [Admin Routes `/admin`](#86-admin-routes-admin)
9. [Authentication Flow](#9-authentication-flow)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Error Handling](#11-error-handling)

---

## 1. Architecture Overview

NetQuiz is a UGC NET exam preparation quiz platform. The backend is a REST API that serves both a Flutter mobile app and a Next.js admin dashboard.

```
Client (Flutter / Admin Dashboard)
        │
        │  HTTP + Bearer Token (Firebase ID Token)
        ▼
  Express Server (index.ts)
        │
        ├── Middleware: CORS, Helmet, Morgan, JSON parser
        │
        ├── verifyToken  ──► Firebase Admin SDK (token verification)
        │
        ├── isAdmin      ──► checks ADMIN_UIDS env var
        │
        └── Route Handlers ──► Mongoose ──► MongoDB Atlas
```

**Authentication Model:**  
- Users authenticate via **Firebase** (Google OAuth or email/password).  
- Every protected request must carry a **Firebase ID Token** in the `Authorization: Bearer <token>` header.  
- The `verifyToken` middleware decodes the token and attaches `uid` and `email` to the request object.  
- Admin access is controlled via a comma-separated list of Firebase UIDs in the `ADMIN_UIDS` environment variable.

---

## 2. Project Structure

```
netquiz-backend/
├── index.ts                  # App entry — Express setup & server start
├── package.json
├── tsconfig.json
│
├── config/
│   ├── db.ts                 # MongoDB connection via Mongoose
│   └── firebase.ts           # Firebase Admin SDK initialisation
│
├── middleware/
│   ├── verifyToken.ts        # JWT verification via Firebase Admin
│   └── isAdmin.ts            # Role guard — checks against ADMIN_UIDS
│
├── models/
│   ├── User.ts               # MongoDB user document
│   ├── Paper.ts              # Top-level exam paper (e.g. "Paper 1")
│   ├── Module.ts             # Subject module inside a paper
│   ├── SubModule.ts          # Topic inside a module
│   ├── Question.ts           # Quiz question
│   ├── Submission.ts         # Community-submitted question (pending review)
│   └── Progress.ts           # Per-user quiz progress, streak & points
│
└── routes/
    ├── auth.ts               # /auth — register, login, sync, profile
    ├── curriculum.ts         # /curriculum — papers, modules, submodules
    ├── questions.ts          # /questions — CRUD + bulk upload + download
    ├── submissions.ts        # /submissions — community questions workflow
    ├── progress.ts           # /progress — sync, stats, leaderboard, daily quiz
    └── admin.ts              # /admin — user management & platform stats
```

---

## 3. Environment Variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key (newlines escaped as `\n`) |
| `FIREBASE_API_KEY` | Firebase Web API Key (used for email/password sign-in REST calls) |
| `ADMIN_UIDS` | Comma-separated Firebase UIDs that have admin access (e.g. `uid1,uid2`) |
| `PORT` | Server port (default: `5001`) |

---

## 4. Tech Stack & Dependencies

### Runtime Dependencies

| Package | Purpose |
|---|---|
| `express` | HTTP server framework |
| `mongoose` | MongoDB ODM |
| `firebase-admin` | Firebase token verification & user management |
| `cors` | Cross-Origin Resource Sharing headers |
| `helmet` | Security HTTP headers |
| `morgan` | HTTP request logging |
| `dotenv` | Environment variable loading |

### Dev Dependencies

| Package | Purpose |
|---|---|
| `typescript` | Type safety |
| `tsx` | Run TypeScript directly (no pre-compilation needed) |
| `nodemon` | Auto-restart on file changes |
| `@types/*` | TypeScript type definitions |

### NPM Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `nodemon --exec tsx index.ts` | Development server with hot reload |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Run compiled production build |

---

## 5. Configuration

### `config/db.ts` — MongoDB Connection

Called at server startup in `index.ts`. Uses `process.env.MONGODB_URI` for the connection string. The server will not start if the connection fails (`process.exit(1)`).

### `config/firebase.ts` — Firebase Admin Initialisation

Initialises the Firebase Admin SDK once at startup. The `private_key` newline replacement (`\\n` → `\n`) is required when the key is stored in `.env`. The exported `admin` instance is used in `verifyToken.ts` and `auth.ts`.

---

## 6. Middleware

### `middleware/verifyToken.ts`

**Purpose:** Authenticates every protected request by verifying the Firebase ID Token.

**How it works:**
1. Reads the `Authorization` header.
2. Extracts the Bearer token after `"Bearer "`.
3. Calls `admin.auth().verifyIdToken(token)` (Firebase Admin SDK).
4. Attaches `uid` and `email` to `req` for downstream handlers.
5. Returns `401` if the token is missing or invalid.

The middleware extends the Express `Request` type:
```typescript
export interface AuthRequest extends Request {
    uid?: string;
    email?: string;
}
```

---

### `middleware/isAdmin.ts`

**Purpose:** Guards routes so that only admin users can access them.

**How it works:**
1. Reads `ADMIN_UIDS` from environment variables (comma-separated string).
2. Checks if `req.uid` is present in the admin UIDs list.
3. Returns `403 Forbidden` if the user is not an admin.
4. Must always be placed **after** `verifyToken` in the middleware chain.

---

## 7. Data Models (Schemas)

### `User`

Stores user profile information, mirroring Firebase Auth data in MongoDB.

| Field | Type | Details |
|---|---|---|
| `uid` | `String` | Firebase UID — unique, required |
| `email` | `String` | User's email address |
| `displayName` | `String` | Display name |
| `photoURL` | `String` | Profile photo URL |
| `role` | `String` | `'user'` or `'admin'` (default: `'user'`) |
| `createdAt` | `Date` | Auto-set via `Date.now` |

---

### `Paper`

Top-level exam category (e.g. "Paper 1 — General", "Paper 2 — Computer Science").

| Field | Type | Details |
|---|---|---|
| `name` | `String` | Required |
| `order` | `Number` | Display order (default: `0`) |
| `createdAt`, `updatedAt` | `Date` | Auto-managed by Mongoose `timestamps` |

---

### `Module`

A subject unit within a Paper (e.g. "Teaching Aptitude").

| Field | Type | Details |
|---|---|---|
| `paperId` | `ObjectId → Paper` | Required |
| `name` | `String` | Required |
| `order` | `Number` | Display order (default: `0`) |
| `createdAt`, `updatedAt` | `Date` | Auto-managed |

---

### `SubModule`

A topic within a Module (e.g. "Nature and Objectives of Teaching").

| Field | Type | Details |
|---|---|---|
| `paperId` | `ObjectId → Paper` | Required |
| `moduleId` | `ObjectId → Module` | Required |
| `name` | `String` | Required |
| `order` | `Number` | Display order (default: `0`) |
| `createdAt`, `updatedAt` | `Date` | Auto-managed |

---

### `Question`

A quiz question. Questions can be hierarchically linked to Paper → Module → SubModule.

| Field | Type | Details |
|---|---|---|
| `paperId` | `ObjectId → Paper` | |
| `moduleId` | `ObjectId → Module` | Optional |
| `subModuleId` | `ObjectId → SubModule` | Optional |
| `text` | `String` | Question text — required |
| `imageUrl` | `String` | Optional image attachment |
| `equation` | `String` | Optional LaTeX equation |
| `options` | `{ A, B, C, D: String }` | Four answer choices |
| `questionOptions` | `String` | Extra formatted options (newline-separated) |
| `correct` | `'A' or 'B' or 'C' or 'D'` | Required |
| `explanation` | `String` | Optional answer explanation |
| `source` | `'admin' or 'community'` | Who created it (default: `'admin'`) |
| `createdBy` | `String` | Firebase UID of creator |
| `createdAt`, `updatedAt` | `Date` | Auto-managed |

**Virtual field `user`:** Populated on demand via `populate('user')` — resolves `createdBy` (Firebase UID) to a `User` document.

---

### `Submission`

A community-contributed question awaiting admin review.

| Field | Type | Details |
|---|---|---|
| `submittedBy` | `String` | Firebase UID — required |
| `paperId` | `ObjectId → Paper` | |
| `moduleId` | `ObjectId → Module` | Optional |
| `subModuleId` | `ObjectId → SubModule` | Optional |
| `text` | `String` | |
| `imageUrl` | `String` | Optional |
| `equation` | `String` | Optional |
| `options` | `{ A, B, C, D: String }` | |
| `questionOptions` | `String` | |
| `correct` | `'A' or 'B' or 'C' or 'D'` | |
| `explanation` | `String` | Optional |
| `status` | `'pending' or 'approved' or 'rejected'` | Default: `'pending'` |
| `reviewedBy` | `String` | Firebase UID of the reviewing admin |
| `createdAt`, `updatedAt` | `Date` | Auto-managed |

**Virtual fields:**
- `user` — resolves `submittedBy` to a `User` document
- `reviewer` — resolves `reviewedBy` to a `User` document

---

### `Progress`

Tracks each user's quiz performance, streaks, points, and level.

**Top-level document (one per user):**

| Field | Type | Details |
|---|---|---|
| `uid` | `String` | Firebase UID — unique, required |
| `questions` | `QuestionProgress[]` | Array of per-question progress entries |
| `streak` | `Number` | Consecutive active days (default: `0`) |
| `activeDates` | `String[]` | Array of `'YYYY-MM-DD'` strings |
| `lastActiveDate` | `Date` | Last date user synced progress |
| `totalPoints` | `Number` | Cumulative points (default: `0`) |
| `level` | `Number` | User level (default: `1`) |
| `lastDailyQuizDate` | `String` | `'YYYY-MM-DD'` — tracks daily quiz completion |
| `lastSyncedAt` | `Date` | Last time the client synced |

**Embedded `QuestionProgress` sub-document (no `_id`):**

| Field | Type | Details |
|---|---|---|
| `questionId` | `ObjectId → Question` | Required |
| `status` | `'unseen' or 'got_it' or 'review'` | Default: `'unseen'` |
| `attempts` | `Number` | Total attempts (default: `0`) |
| `correct` | `Number` | Total correct answers (default: `0`) |
| `lastSeen` | `Date` | When question was last answered |
| `avgTime` | `Number` | Average time in milliseconds |

---

## 8. API Routes

> **Authentication levels:**  
> - Public — no token required  
> - Authenticated — requires `Authorization: Bearer <Firebase ID Token>`  
> - Admin only — requires authenticated token AND uid in `ADMIN_UIDS`

---

### 8.1 Auth Routes `/auth`

#### `POST /auth/register` — Public

Registers a new user using email and password.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "displayName": "John Doe"
}
```

**How it works:**
1. Creates the user in Firebase Authentication via `admin.auth().createUser()`.
2. Checks if the new UID is in `ADMIN_UIDS` to assign the correct role.
3. Creates a corresponding document in the MongoDB `users` collection.

**Response `201`:**
```json
{
  "message": "User registered successfully",
  "uid": "firebaseUid",
  "user": { "...mongoUserDoc": "..." }
}
```

---

#### `POST /auth/login` — Public

Authenticates a user with email/password and returns Firebase tokens.

**Request body:**
```json
{ "email": "user@example.com", "password": "secret123" }
```

**How it works:**
1. Calls the Firebase Identity Toolkit REST API (`signInWithPassword`).
2. Fetches the user's MongoDB document by UID.
3. Returns the `idToken`, `refreshToken`, `expiresIn`, and user profile.

**Response `200`:**
```json
{
  "idToken": "...",
  "refreshToken": "...",
  "expiresIn": "3600",
  "user": { "...mongoUserDoc": "..." }
}
```

---

#### `POST /auth/refresh` — Public

Exchanges a refresh token for a new ID Token via the Firebase Secure Token API.

**Request body:**
```json
{ "refreshToken": "..." }
```

**Response `200`:**
```json
{ "idToken": "...", "refreshToken": "...", "expiresIn": "3600" }
```

---

#### `POST /auth/sync` — Authenticated

**Primary use case:** Called by Flutter after Google Sign-In. Creates the user in MongoDB on first login, or updates their profile on subsequent logins.

**Request body:**
```json
{ "displayName": "John Doe", "photoURL": "https://...", "refreshToken": "optional" }
```

**How it works:**
1. Reads `uid` and `email` from the decoded token (set by `verifyToken` middleware).
2. If user does not exist in MongoDB → creates them.
3. If user exists → updates `displayName`, `photoURL`, and role (if applicable).
4. Role is automatically assigned based on `ADMIN_UIDS`.

**Response `200`:**
```json
{ "user": { "...mongoUserDoc": "..." }, "refreshToken": "..." }
```

---

#### `PATCH /auth/profile` — Authenticated

Updates the authenticated user's profile.

**Request body (any combination):**
```json
{ "displayName": "New Name", "photoURL": "https://...", "password": "newPassword" }
```

**How it works:**
1. Updates the user in Firebase Authentication.
2. Updates `displayName` and `photoURL` in MongoDB (`password` is only updated in Firebase).

---

#### `GET /auth/me` — Authenticated

Returns the currently authenticated user's profile from MongoDB.

**Response `200`:**
```json
{ "user": { "...mongoUserDoc": "..." } }
```

---

### 8.2 Curriculum Routes `/curriculum`

Manages the hierarchical content structure: **Paper → Module → SubModule**.

---

#### `GET /curriculum/papers` — Public

Returns all papers sorted by `order` ascending.

---

#### `POST /curriculum/papers` — Admin only

Creates a new paper.
```json
{ "name": "Paper 1 — General", "order": 1 }
```

---

#### `PUT /curriculum/papers/:id` — Admin only

Updates an existing paper by ID. Accepts any field from the Paper schema.

---

#### `DELETE /curriculum/papers/:id` — Admin only

Deletes a paper. Requires query param `questionsAction`:
- `delete` — permanently deletes all questions belonging to this paper.
- `uncategorize` — removes `paperId`, `moduleId`, `subModuleId` from questions (orphans them).

**Cascade:** All linked Modules and SubModules are always deleted.

---

#### `GET /curriculum/modules` — Public

Returns modules filtered by `paperId` query param (single or comma-separated). Returns all if no filter given.

---

#### `POST /curriculum/modules` — Admin only

```json
{ "paperId": "...", "name": "Teaching Aptitude", "order": 1 }
```

---

#### `PUT /curriculum/modules/:id` — Admin only

Updates a module by ID.

---

#### `DELETE /curriculum/modules/:id` — Admin only

Deletes a module. Same `questionsAction` logic as paper deletion. Cascades to delete all SubModules under this module.

---

#### `GET /curriculum/submodules` — Public

Returns submodules filtered by `moduleId` query param (single or comma-separated).

---

#### `POST /curriculum/submodules` — Admin only

```json
{ "moduleId": "...", "paperId": "...", "name": "Nature of Teaching", "order": 1 }
```

---

#### `PUT /curriculum/submodules/:id` — Admin only

Updates a submodule by ID.

---

#### `DELETE /curriculum/submodules/:id` — Admin only

Deletes a submodule. Same `questionsAction` logic (only affects questions at the SubModule level).

---

### 8.3 Questions Routes `/questions`

All question endpoints require authentication. Write operations additionally require admin.

---

#### `GET /questions` — Authenticated

Fetches questions with optional filters and pagination.

**Query params:**

| Param | Description |
|---|---|
| `paperId` | Filter by paper ID(s) — single or comma-separated |
| `moduleId` | Filter by module ID(s) — single or comma-separated |
| `subModuleId` | Filter by submodule ID(s) — single or comma-separated |
| `source` | `'admin'` or `'community'` |
| `uncategorized` | `'true'` — returns questions with no `moduleId` |
| `page` | Page number (default: `1`) |
| `limit` | Results per page (default: `20`; use `0` for no limit) |

Each question is populated with: `paperId.name`, `moduleId.name`, `subModuleId.name`, `user.displayName,email,role`.

**Response `200`:**
```json
{
  "questions": [],
  "pagination": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 }
}
```

---

#### `GET /questions/search` — Authenticated

Case-insensitive full-text search on question `text` field.

**Query params:** `q` (required), `page`, `limit` (default: `50`).

---

#### `GET /questions/:id` — Authenticated

Fetches a single question by MongoDB ObjectId with full population. Returns `400` for invalid IDs, `404` if not found.

---

#### `POST /questions` — Admin only

Creates a single question. Automatically sets `source: 'admin'` and `createdBy` to the admin's UID.

**Request body:**
```json
{
  "paperId": "...",
  "moduleId": "...",
  "subModuleId": "...",
  "text": "What is the capital of France?",
  "options": { "A": "London", "B": "Paris", "C": "Berlin", "D": "Rome" },
  "correct": "B",
  "explanation": "Paris is the capital city of France.",
  "imageUrl": "https://...",
  "equation": "LaTeX string"
}
```

**Flexible input formats (auto-converted):**
- `options` can be an array `["London", "Paris", "Berlin", "Rome"]` → auto-converted to `{A, B, C, D}`.
- `correct` can be a number `0-3` → auto-mapped to `A/B/C/D`.
- `questionOptions` can be an array → joined with `\n`.

---

#### `POST /questions/bulk` — Admin only

Inserts multiple questions in one request using `Question.insertMany()`.

**Request body:**
```json
{
  "questions": [
    { "paperId": "...", "text": "Q1", "options": ["A", "B", "C", "D"], "correct": 0 }
  ]
}
```

**Response `201`:**
```json
{ "message": "Bulk questions added successfully", "count": 25, "questions": [] }
```

---

#### `PUT /questions/:id` — Admin only

Updates a question by ID. Applies same array-to-object conversion for `options` and `correct`.

---

#### `DELETE /questions/:id` — Admin only

Permanently deletes a question by ID.

---

#### `GET /questions/download/:paperId` — Authenticated

Downloads the entire content tree for a paper as a single nested JSON for Flutter offline storage.

**Response structure:**
```json
{
  "paper": {},
  "modules": [
    {
      "_id": "...", "name": "Module Name",
      "questions": [],
      "subModules": [
        { "_id": "...", "name": "SubModule Name", "questions": [] }
      ]
    }
  ],
  "uncategorized": []
}
```

---

### 8.4 Submissions Routes `/submissions`

Handles the community question contribution workflow.

---

#### `POST /submissions` — Authenticated

Any logged-in user can submit a community question. Sets `status: 'pending'` and `submittedBy` to the user's UID automatically. Same request body format as creating a question.

---

#### `GET /submissions` — Authenticated

Fetches submissions with pagination.

**Access control:**
- **Admin:** Sees all submissions. Can filter by `status` and `paperId`.
- **Regular user:** Only sees their own submissions.

**Query params:** `status`, `paperId`, `page`, `limit`.

---

#### `GET /submissions/:id` — Authenticated

Fetches a single submission. Regular users can only view their own; admins can view any.

---

#### `PUT /submissions/:id` — Admin only

Allows an admin to edit a submission before approving it (e.g. correct typos).

---

#### `PUT /submissions/:id/approve` — Admin only

Approves a submission:
1. Copies all submission fields into the `questions` collection with `source: 'community'`.
2. Sets `submission.status = 'approved'`.
3. Records the reviewing admin's UID in `submission.reviewedBy`.

**Response `200`:**
```json
{ "message": "Submission approved", "question": {} }
```

---

#### `PUT /submissions/:id/reject` — Admin only

Marks a submission as rejected and records the reviewing admin's UID.

---

#### `DELETE /submissions/:id` — Admin only

Permanently deletes a submission.

---

### 8.5 Progress Routes `/progress`

Tracks user study progress, streaks, points, and level. Designed for offline-first Flutter usage.

---

#### `GET /progress/me` — Authenticated

Returns the authenticated user's complete progress. Returns a zeroed default structure if no record exists yet. Includes `isDailyQuizCompleted` — boolean indicating whether today's daily quiz is already done.

**Response `200`:**
```json
{
  "progress": {
    "uid": "...", "questions": [], "streak": 5,
    "activeDates": ["2026-08-01"], "totalPoints": 350,
    "level": 3, "isDailyQuizCompleted": false
  }
}
```

---

#### `POST /progress/sync` — Authenticated

Called by the Flutter app on open to upload locally tracked progress to the server.

**Request body:**
```json
{
  "questions": [
    {
      "questionId": "mongoObjectId", "status": "got_it",
      "attempts": 3, "correct": 2,
      "lastSeen": "2026-08-06T10:00:00.000Z", "avgTime": 12500
    }
  ],
  "lastActiveDate": "2026-08-06T10:00:00.000Z",
  "level": 3
}
```

**How it works:**
1. **Merges questions:** Updates existing or pushes new question progress. Takes the max of `attempts` and `correct`.
2. **Streak calculation:** Compares today vs `lastActiveDate`:
   - Same day → no change.
   - 1 day difference → increments streak.
   - More than 1 day → resets streak to `1`.
3. **Points:** `totalPoints += sum(incoming.correct) * 10`
4. **Level:** Only updates if `incoming.level > current level`.

**Response `200`:**
```json
{
  "message": "Progress synced",
  "streak": 6, "activeDates": [],
  "totalPoints": 450, "level": 3,
  "lastSyncedAt": "2026-08-06T10:01:00.000Z"
}
```

---

#### `GET /progress/stats` — Authenticated

Returns a performance summary for the home/stats screen.

**Response `200`:**
```json
{
  "total": 120, "mastered": 80, "review": 25, "unseen": 15,
  "accuracy": 72, "avgTime": 18000, "streak": 6,
  "activeDates": [], "points": 450, "level": 3, "isDailyQuizCompleted": false
}
```

| Field | Description |
|---|---|
| `mastered` | Questions with status `'got_it'` |
| `review` | Questions with status `'review'` |
| `accuracy` | Percentage of correct answers over total attempts |
| `avgTime` | Average milliseconds per question |

---

#### `GET /progress/leaderboard` — Authenticated

Returns a global ranked leaderboard sorted by `totalPoints` descending.

**Query params:** `limit` (default: `50`, max: `200`)

**How it works:** MongoDB aggregation pipeline — matches users with points, sorts, joins User collection for profile info.

**Response `200`:**
```json
{
  "leaderboard": [
    { "rank": 1, "uid": "...", "displayName": "John", "photoURL": "...", "totalPoints": 2000, "streak": 10 }
  ],
  "total": 500,
  "myRank": { "rank": 42, "uid": "...", "totalPoints": 300, "streak": 3 }
}
```

`myRank` is always included regardless of whether the calling user appears in the top `limit`. Returns `null` if user has 0 points.

---

#### `PATCH /progress/daily-quiz` — Authenticated

Marks today's daily quiz as completed. Uses `upsert: true` to create the progress document if needed.

**Response `200`:**
```json
{
  "message": "Daily quiz status updated",
  "lastDailyQuizDate": "2026-08-06",
  "isDailyQuizCompleted": true
}
```

---

### 8.6 Admin Routes `/admin`

All routes under `/admin` require both `verifyToken` and `isAdmin` (applied at the router level).

---

#### `GET /admin/users` — Admin only

Lists all users from MongoDB with optional search and pagination.

**Query params:** `search` (regex on email/displayName), `page`, `limit` (default: `20`).

---

#### `GET /admin/firebase-users` — Admin only

Fetches users directly from Firebase Authentication (not MongoDB). Returns 100 users per page.

**Query params:** `nextPageToken` for pagination.

---

#### `POST /admin/users/sync` — Admin only

Syncs Firebase Auth users into MongoDB. Fetches up to 1000 users from Firebase and performs a bulk upsert. Correctly assigns roles based on `ADMIN_UIDS`.

**Response `200`:**
```json
{ "message": "Synced 350 users successfully." }
```

---

#### `GET /admin/users/:uid` — Admin only

Fetches a single user by Firebase UID from MongoDB.

---

#### `PUT /admin/users/:uid` — Admin only

Updates a user's `role` or `displayName` in MongoDB.

```json
{ "role": "admin", "displayName": "Admin User" }
```

---

#### `DELETE /admin/users/:uid` — Admin only

Deletes a user from MongoDB **and** also deletes their `Progress` document.

---

#### `GET /admin/users/:uid/progress` — Admin only

Retrieves detailed progress data for a specific user. The `questions` array is populated with question text, paperId, moduleId, and questionOptions.

**Response `200`:**
```json
{
  "uid": "...", "streak": 5, "points": 1200,
  "lastActive": "...", "lastSyncedAt": "...",
  "accuracy": 68, "avgTime": 14000,
  "mastered": 40, "review": 15, "total": 75,
  "questions": []
}
```

---

#### `GET /admin/stats` — Admin only

Returns platform-wide statistics for the admin dashboard.

**How it works:**
- Counts total users from the `users` collection.
- Aggregates all `Progress` documents in memory.
- Determines "active today" by comparing each record's `lastActiveDate` to today.

**Response `200`:**
```json
{
  "totalUsers": 1200,
  "activeToday": 85,
  "totalQuestionsSeen": 45000,
  "overallAccuracy": 63
}
```

---

## 9. Authentication Flow

### First-time Login (Flutter / Google OAuth)

```
1. User signs in with Google on the Flutter app
2. Flutter receives a Firebase ID Token from Google
3. Flutter calls POST /auth/sync with the token in Authorization header
4. verifyToken middleware calls Firebase Admin to verify the token
5. syncUser handler creates the User document in MongoDB (or updates existing)
6. Returns user profile + refreshToken
```

### Every Subsequent Request

```
1. Flutter attaches the stored ID Token to all requests as:
   Authorization: Bearer <idToken>
2. verifyToken middleware decodes it (Firebase Admin SDK)
3. req.uid and req.email are injected and available in route handlers
```

### Token Refresh Flow

```
1. Client detects a 401 Unauthorized response
2. Client calls POST /auth/refresh with the stored refreshToken
3. Backend exchanges it with Firebase Secure Token API for a new idToken
4. Client stores the new idToken and retries the original request
```

---

## 10. Data Flow Diagrams

### Community Question Submission Workflow

```
User                    Backend                          Admin
 │                        │                               │
 │─── POST /submissions ──►│                               │
 │                        │ Creates Submission             │
 │                        │ status: 'pending'              │
 │◄── 201 { submission } ──│                               │
 │                        │                               │
 │                        │◄── GET /submissions ──────────│
 │                        │    (all pending)               │
 │                        │─── submissions list ──────────►│
 │                        │                               │
 │                        │◄── PUT /:id/approve ──────────│
 │                        │ Copies to questions collection  │
 │                        │ source: 'community'            │
 │                        │ status: 'approved'             │
 │                        │─── { question } ──────────────►│
```

### Progress Sync Workflow (Flutter Offline-First)

```
Flutter App                                   Backend
    │                                             │
    │ (User studies offline — LocalDB tracks data)│
    │                                             │
    │─── POST /progress/sync ────────────────────►│
    │    { questions[], lastActiveDate, level }   │
    │                                             │ Merge questions
    │                                             │ Recalculate streak
    │                                             │ Add points (correct * 10)
    │                                             │ Update level if higher
    │◄── { streak, totalPoints, level } ──────────│
    │                                             │
    │─── GET /progress/me ───────────────────────►│
    │◄── { full progress doc + isDailyQuizDone } ─│
```

---

## 11. Error Handling

The API returns standard HTTP status codes:

| Code | Meaning | Common Causes |
|---|---|---|
| `200` | OK | Successful GET / PATCH |
| `201` | Created | Successful POST |
| `400` | Bad Request | Missing or invalid required fields |
| `401` | Unauthorized | Missing, expired, or invalid Firebase token |
| `403` | Forbidden | Authenticated but not an admin |
| `404` | Not Found | Document with given ID does not exist |
| `500` | Server Error | Unexpected server or database error |

**Standard error response shape:**
```json
{
  "message": "Human-readable error description",
  "error": "Technical error details (dev-facing)"
}
```

Mongoose validation errors additionally include a `details` field with per-field breakdown.
