# NetQuiz API Documentation

This documentation provides details for all existing API endpoints in the NetQuiz backend.
The base URL for the API is `http://your-base-url.com`.
All requests should include a Firebase Auth ID Token in the `Authorization` header: `Bearer <token>`.

> [!IMPORTANT]
> Administrative permissions are granted to users whose Firebase UID is listed in the `ADMIN_UIDS` environment variable. While users also have a `role` field in the database, the current middleware prioritizes the environment variable list.

---

## 👤 User APIs

These endpoints are used by the Flutter client and regular users.

### 🔐 Authentication

#### `POST /auth/login`
Called when the user opens the app or logs in. Creates a user in the database if it's their first time.
- **Request Body:** `{ displayName?: string }`
- **Response:** `{ user: UserObject }`

#### `GET /auth/me`
Returns current logged-in user info.
- **Response:** `{ user: UserObject }`

### 📚 Curriculum

#### `GET /curriculum/papers`
Fetch all available papers.
- **Response:** `{ papers: Paper[] }`

#### `GET /curriculum/modules`
Fetch modules for a specific paper.
- **Query Params:** `paperId?` (optional filter)
- **Response:** `{ modules: Module[] }`

#### `GET /curriculum/submodules`
Fetch sub-modules for a specific module.
- **Query Params:** `moduleId?` (optional filter)
- **Response:** `{ subModules: SubModule[] }`

### ❓ Questions

#### `GET /questions`
Fetch questions with optional filtering.
- **Query Params:**
    - `paperId`: Filter by paper
    - `moduleId`: Filter by module
    - `subModuleId`: Filter by sub-module
    - `source`: `admin` or `community`
    - `uncategorized`: `true` to get questions without a module
- **Response:** `{ questions: Question[] }`

#### `GET /questions/:id`
Get details of a single question.
- **Response:** `{ question: QuestionObject }`

#### `GET /questions/download/:paperId`
Returns a full nested JSON structure of a paper (including modules, sub-modules, and questions) for offline storage.
- **Response:** `{ paper: Paper, modules: NestedModule[] }`

### 📝 Submissions (Community Questions)

#### `POST /submissions`
Submit a new question from the community.
- **Request Body:**
    ```json
    {
      "paperId": "string",
      "moduleId": "string",
      "subModuleId": "string",
      "text": "string",
      "options": ["string"],
      "correct": "number",
      "explanation": "string",
      "imageUrl": "string",
      "equation": "string"
    }
    ```
- **Response:** `{ submission: SubmissionObject }`

#### `GET /submissions`
Get list of submissions (can be filtered by status or paper).
- **Query Params:** `status`, `paperId`
- **Response:** `{ submissions: Submission[] }`

### 📈 Progress

#### `GET /progress/me`
Retrieve the current user's full progress.
- **Response:** `{ progress: ProgressObject }`

#### `POST /progress/sync`
Sync local progress with the server.
- **Request Body:**
    ```json
    {
      "questions": [
        {
          "questionId": "string",
          "status": "unseen | got_it | review",
          "attempts": 0,
          "correct": 0,
          "lastSeen": "ISO Date",
          "avgTime": 0
        }
      ],
      "lastActiveDate": "ISO Date"
    }
    ```
- **Response:** `{ message: "Progress synced", streak: number, totalPoints: number, lastSyncedAt: Date }`

#### `GET /progress/stats`
Get summary statistics for the user profile.
- **Response:** `{ total, mastered, review, unseen, accuracy, avgTime, streak, points }`

---

## 🛠 Admin APIs

These endpoints require the user to have an `admin` role and are used by the Admin Dashboard.
**All endpoints below require `verifyToken` and `isAdmin` middleware.**

### 📚 Curriculum Management

#### `POST /curriculum/papers`
Create a new paper.
- **Request Body:** `{ name: string, order: number }`

#### `PUT /curriculum/papers/:id`
Update an existing paper.

#### `DELETE /curriculum/papers/:id`
Delete a paper.

#### `POST /curriculum/modules`
Create a new module.
- **Request Body:** `{ paperId, name, order }`

#### `PUT /curriculum/modules/:id`
Update a module.

#### `DELETE /curriculum/modules/:id`
Delete a module.

#### `POST /curriculum/submodules`
Create a new sub-module.
- **Request Body:** `{ moduleId, paperId, name, order }`

#### `PUT /curriculum/submodules/:id`
Update a sub-module.

#### `DELETE /curriculum/submodules/:id`
Delete a sub-module.

### ❓ Question Management

#### `POST /questions`
Create a new admin-verified question.
- **Request Body:** Similar to submission but source is set to `admin`.

#### `PUT /questions/:id`
Update a question.

#### `DELETE /questions/:id`
Delete a question.

### 📝 Submission Review

#### `GET /submissions/:id`
View a specific submission in detail.

#### `PUT /submissions/:id`
Edit a submission before approval.

#### `PUT /submissions/:id/approve`
Approve a submission. This copies the content to the `questions` collection with `source: community`.

#### `PUT /submissions/:id/reject`
Reject a submission.

#### `DELETE /submissions/:id`
Delete a submission.

### 👥 User Management

#### `GET /admin/users`
List all users.
- **Query Params:** `search`, `page`, `limit`

#### `GET /admin/users/:uid`
Get single user details.

#### `PUT /admin/users/:uid`
Update user role (e.g., promote to admin) or display name.

#### `DELETE /admin/users/:uid`
Delete a user and their associated progress.

#### `GET /admin/users/:uid/progress`
View detailed progress metrics for a specific user.

### 📊 Platform Stats

#### `GET /admin/stats`
Get overall platform analytics (total users, active users today, accuracy, etc.).
- **Response:** `{ totalUsers, activeToday, totalQuestionsSeen, overallAccuracy }`
