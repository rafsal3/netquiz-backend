# User API Guide for Postman

This guide is designed for developers testing the **User (Client)** features of the NetQuiz API using Postman. It covers authentication, progress syncing, and community submissions.

## 🚀 Getting Started

### Step 1: Obtain a User Token
To test user-protected routes, you need a valid **Firebase ID Token**.

1.  **Using Registration/Login (Best for Postman)**:
    - **Register**: `POST {{baseUrl}}/auth/register`
      - Body: `{ "email": "user@example.com", "password": "password123", "displayName": "John Doe" }`
    - **Login**: `POST {{baseUrl}}/auth/login`
      - Body: `{ "email": "user@example.com", "password": "password123" }`
    - Copy the `idToken` from the response.

2.  **From the App**: Log in to the application and pull the token from the DevTools console: `await auth.currentUser.getIdToken()`.

---

### Step 2: Postman Configuration
1.  **Authorization**: Go to the **Authorization** tab, select **Bearer Token**, and paste your token.
2.  **Base URL**: Set a variable `{{baseUrl}}` (e.g., `http://localhost:5001` or `https://netquiz-backend.onrender.com`).

---

## 👤 User Profile & Auth

### 1. Sync User Profile
Initializes or updates the user's display name in the backend database.
- **Endpoint**: `POST {{baseUrl}}/auth/sync`
- **Body**:
  ```json
  {
    "displayName": "John Doe"
  }
  ```

---

## 📊 Progress & Stats
These endpoints are critical for the Flutter app to handle offline-first progress.

### 1. Download My Progress
Fetches the user's entire progress history (completed questions, streak, points).
- **Endpoint**: `GET {{baseUrl}}/progress/me`

### 2. Sync Local Progress (Upload)
Sends locally answered questions to the cloud. The backend merges this with existing data.
- **Endpoint**: `POST {{baseUrl}}/progress/sync`
- **Body**:
  ```json
  {
    "questions": [
      {
        "questionId": "65f123...",
        "status": "got_it",
        "attempts": 2,
        "correct": 1,
        "lastSeen": "2024-03-27T10:00:00Z",
        "avgTime": 15
      }
    ],
    "lastActiveDate": "2024-03-27T10:05:00Z"
  }
  ```

### 3. Get Summary Stats
Returns high-level metrics for the dashboard (Accuracy, Mastered count, etc.).
- **Endpoint**: `GET {{baseUrl}}/progress/stats`

---

## 📚 Study Content

### 1. Browse Curriculum
Users can browse the hierarchy of study materials.
- **Get Papers**: `GET {{baseUrl}}/curriculum/papers`
- **Get Modules**: `GET {{baseUrl}}/curriculum/modules?paperId={{paperId}}`
- **Get Submodules**: `GET {{baseUrl}}/curriculum/submodules?moduleId={{moduleId}}`

### 2. Get Questions
- **Filter by Category**: `GET {{baseUrl}}/questions?paperId=...&moduleId=...`
- **Search**: `GET {{baseUrl}}/questions/search?q=calculus`

---

## 🤝 Community Contributions

### 1. Submit a Question
Users can contribute questions to the platform. These enter a `pending` state for admin review.
- **Endpoint**: `POST {{baseUrl}}/submissions`
- **Body**:
  ```json
  {
    "paperId": "65f123...",
    "text": "What is the derivative of x^2?",
    "options": ["x", "2x", "x^2", "1"],
    "correct": 1, 
    "explanation": "Using the power rule: d/dx(x^n) = nx^(n-1)."
  }
  ```
  *(Note: `correct` is 0-indexed: 0=A, 1=B, 2=C, 3=D)*

### 2. View My Submissions
Track the status of your submitted questions.
- **Endpoint**: `GET {{baseUrl}}/submissions`
- **Query Params**: `status=pending` or `status=approved`

---

## 💡 Pro-Tips for Postman

### Use Environments
Save your `baseUrl` and `firebase_token` in a Postman Environment. This allows you to switch between **Local Development** and **Production** instantly.

### Automated Authorization
Instead of setting the token on every request:
1.  Right-click your Postman **Collection**.
2.  Go to **Authorization**.
3.  Set type to **Bearer Token** and value to `{{firebase_token}}`.
4.  Set all requests in the collection to **"Inherit auth from parent"**.

---

## 🛑 Common Errors
- `401 Unauthorized`: Token expired. Get a fresh Firebase ID Token.
- `400 Bad Request`: Missing `paperId` or invalid MongoDB ID format (must be 24 hex characters).
- `500 Server Error`: Usually happens if the database is unreachable or a required field is missing from the payload.

---

> [!NOTE]
> Unlike Admin routes, User routes do **not** require your UID to be in the `ADMIN_UIDS` list. Any registered Firebase user can access these.
