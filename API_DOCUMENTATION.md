# NetQuiz API Documentation

This documentation provides comprehensive details for all API endpoints in the NetQuiz backend.

## 🚀 General Information

- **Base URL**: `https://netquiz-backend.onrender.com`
- **Authentication**: All requests (except public GETs) require a Firebase Auth ID Token.
- **Header**: `Authorization: Bearer <token>`
- **Content-Type**: `application/json`

---

## 📦 Data Models

### ❓ Question / Submission Object
When **receiving** a question from the API, the structure is:
```json
{
  "_id": "65f...",
  "text": "What is the capital of France?",
  "options": {
    "A": "Paris",
    "B": "London",
    "C": "Berlin",
    "D": "Madrid"
  },
  "correct": "A",
  "explanation": "Paris is the capital.",
  "paperId": "...",
  "moduleId": "...",
  "subModuleId": "...",
  "source": "admin",
  "createdAt": "2024-..."
}
```

---

## 👤 User APIs (Public/Client)

### 🔐 Authentication

#### `POST /auth/register`
Creates a new user account with email and password in both Firebase and MongoDB.
- **Request Body**:
    ```json
    {
      "email": "user@example.com",
      "password": "securePassword123",
      "displayName": "John Doe"
    }
    ```
- **Response**: `{ "message": "...", "uid": "...", "user": { ... } }`

#### `POST /auth/login`
Authenticates a user and returns a Firebase ID Token for subsequent requests.
- **Request Body**:
    ```json
    {
      "email": "user@example.com",
      "password": "securePassword123"
    }
    ```
- **Response**: `{ "idToken": "...", "refreshToken": "...", "user": { ... } }`

#### `POST /auth/sync`
Initializes or updates the user profile in the database (used for Google OAuth or refreshing user data).
- **Request Body**: `{ "displayName": "User Name" }`
- **Response**: `{ "user": { "uid": "...", "role": "user", ... } }`

#### `GET /auth/me`
Returns the current logged-in user's profile information.
- **Header**: `Authorization: Bearer <token>`

### 📚 Curriculum

#### `GET /curriculum/papers`
Returns all papers sorted by order.

#### `GET /curriculum/modules?paperId=<id>`
Returns modules for a paper. Supports multiple `paperId` values (comma-separated or repeated param). If `paperId` is missing, returns all.

#### `GET /curriculum/submodules?moduleId=<id>`
Returns sub-modules for a module. Supports multiple `moduleId` values (comma-separated or repeated param).

### ❓ Questions

#### `GET /questions`
- **Query Params**: 
  - `paperId`: Single ID or comma-separated list/array of IDs.
  - `moduleId`: Single ID or comma-separated list/array of IDs.
  - `subModuleId`: Single ID or comma-separated list/array of IDs.
  - `source`: `admin` or `community`.
  - `uncategorized`: `true` or `false`.
- **Response**: `{ "questions": [...] }`

#### `GET /questions/:id`
Returns a single question by its MongoDB ID.

#### `GET /questions/download/:paperId`
Returns the entire paper structure (nested) for offline use in Flutter.

### 📝 Submissions (Community)

#### `POST /submissions`
Submit a question for community review.
- **Required Body**:
    ```json
    {
      "paperId": "24-char-hex-id",
      "text": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0, // Index 0-3 (0=A, 1=B, etc.)
      "explanation": "Optional explanation"
    }
    ```
    *Note: The backend converts the options array to the A/B/C/D object automatically.*

### 🏆 Leaderboard

#### `GET /progress/leaderboard`
Returns a global leaderboard of users ranked by total points (descending). Always includes the calling user's own rank, even if they fall outside the requested limit.

- **Auth**: `Authorization: Bearer <token>` *(required)*
- **Query Params**:

| Param   | Type    | Default | Max | Description                    |
|---------|---------|---------|-----|--------------------------------|
| `limit` | integer | `50`    | `200` | Number of top entries to return |

- **Example Request**:
    ```
    GET /progress/leaderboard?limit=20
    Authorization: Bearer <firebase_id_token>
    ```

- **Success Response** `200 OK`:
    ```json
    {
      "leaderboard": [
        {
          "rank": 1,
          "uid": "firebase_uid_abc123",
          "displayName": "Alice",
          "photoURL": "https://lh3.googleusercontent.com/a/photo.jpg",
          "totalPoints": 4200,
          "streak": 14
        },
        {
          "rank": 2,
          "uid": "firebase_uid_def456",
          "displayName": "Bob",
          "photoURL": null,
          "totalPoints": 3750,
          "streak": 7
        }
      ],
      "total": 312,
      "myRank": {
        "rank": 47,
        "uid": "firebase_uid_me789",
        "displayName": "John Doe",
        "photoURL": null,
        "totalPoints": 830,
        "streak": 3
      }
    }
    ```

- **Response Fields**:

| Field                       | Type           | Description                                                              |
|-----------------------------|----------------|--------------------------------------------------------------------------|
| `leaderboard`               | array          | Top N users sorted by `totalPoints` descending                           |
| `leaderboard[].rank`        | integer        | 1-based rank position                                                    |
| `leaderboard[].uid`         | string         | Firebase UID                                                             |
| `leaderboard[].displayName` | string         | User display name (falls back to `"Anonymous"` if not set)               |
| `leaderboard[].photoURL`    | string \| null | Profile picture URL (null if not available)                              |
| `leaderboard[].totalPoints` | integer        | Total points earned (10 pts per correct answer synced)                   |
| `leaderboard[].streak`      | integer        | Current daily activity streak                                            |
| `total`                     | integer        | Total number of ranked users (all users with `totalPoints > 0`)          |
| `level`                     | integer        | User's current level (returned in stats and sync)                        |
| `myRank`                    | object \| null | Calling user's own rank entry. `null` if the user has 0 points           |

- **Error Responses**:

| Status | Reason |
|--------|--------|
| `401`  | Missing or invalid Firebase token |
| `500`  | Internal server error |

---

## 🛠 Admin APIs

Requires the user's Firebase UID to be in the server's `ADMIN_UIDS` list.

### ❓ Question Management

#### `POST /questions`
Create a verified admin question.
- **Required Body**:
    ```json
    {
      "paperId": "24-char-hex-id",
      "text": "Question text here",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct": 0, // Or "A", "B", "C", "D"
      "moduleId": "optional-id",
      "subModuleId": "optional-id",
      "explanation": "Optional",
      "imageUrl": "Optional URL",
      "equation": "Optional LaTeX"
    }
    ```

#### `PUT /questions/:id`
Update an existing question. Send only the fields you want to change.
- **Body Example**: `{ "text": "Updated text", "correct": "B" }`

#### `DELETE /questions/:id`
Permanently delete a question.

### 📚 Curriculum Management

#### `POST /curriculum/papers`
Body: `{ "name": "Paper 1", "order": 1 }`

#### `POST /curriculum/modules`
Body: `{ "paperId": "...", "name": "Module 1", "order": 1 }`

#### `POST /curriculum/submodules`
Body: `{ "moduleId": "...", "paperId": "...", "name": "Sub 1", "order": 1 }`

### 👥 User & Stats

#### `GET /admin/users`
List all registered users. Supports `search`, `page`, and `limit`.

#### `GET /admin/stats`
Returns data for the admin dashboard dashboard:
- `totalUsers`: Total registered count
- `activeToday`: Users who synced today
- `totalQuestionsSeen`: Total attempts across all users
- `overallAccuracy`: Average % correct

---

## ⚠️ Error Codes

| Status | Meaning | Solution |
| :--- | :--- | :--- |
| **400** | Bad Request | Check if `paperId` is a 24-char hex string. Check if all required fields are present. |
| **401** | Unauthorized | Token is missing or expired. Refresh Firebase token. |
| **403** | Forbidden | User is not in the `ADMIN_UIDS` list. |
| **404** | Not Found | Resource (Question/Paper) ID does not exist. |
| **500** | Server Error | Check backend logs. Usually a database validation or connection error. |
