# 📱 Flutter API Integration Guide

This documentation is specialized for the Flutter client app of NetQuiz. It focuses on the endpoints, data formats, and integration patterns required for the client application.

## 🚀 Environment & Headers

- **Base URL**: `https://netquiz-backend.onrender.com`
- **Content-Type**: `application/json`
- **Headers**:
    ```dart
    {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer <firebase_id_token>',
    }
    ```
    *Note: Obtain the ID Token using `user.getIdToken()` from the Firebase Auth package.*

---

## 🛠 Integration Flow

### 1. App Startup (Initialization)
When the app opens, you should perform two primary requests:
- **`GET /curriculum/papers`**: To populate the home screen/drawer with categories.
- **`GET /progress/me`**: To retrieve the user's latest sync status, streak, and total points.

### 2. Preparing for Quiz (Offline Suppport)
NetQuiz supports offline quizzes. Before starting a quiz in a paper, call:
- **`GET /questions/download/:paperId`**
- **Response**: A nested JSON object containing all modules, sub-modules, and questions for that paper.
- **Storage**: Save this JSON to local storage (SQLite or SharedPreferences) to allow the user to take quizzes without internet.

### 4. Search
Users can search for specific questions across all papers:
- **`GET /questions/search?q=keyword`**
- **Response**: A list of matched questions with their paper and module details populated.

### 3. Syncing Progress
After completing a quiz (or periodically), send the user's progress to the server.
- **`POST /progress/sync`**
- **Request Body**:
    ```json
    {
      "questions": [
        {
          "questionId": "65f...",
          "status": "got_it | review | unseen",
          "attempts": 2,
          "correct": 1,
          "lastSeen": "2024-03-27T10:00:00Z",
          "avgTime": 15
        }
      ],
      "lastActiveDate": "2024-03-27T10:00:00Z"
    }
    ```
- **Response**: `{ "message": "Progress synced", "streak": 5, "totalPoints": 500 }`

---

## ❓ Question Data Format (Dart Mapping)

The backend stores `options` as an object and keys them by A, B, C, D. Map them in your Dart model as follows:

```dart
class Question {
  final String id;
  final String text;
  final String? questionOptions; // Internal list (a, b, c, d)
  final Map<String, String> options; // { "A": "...", "B": "...", ... }
  final String correctLabel; // "A", "B", "C", or "D"
  final String? explanation;

  Question.fromJson(Map<String, dynamic> json)
      : id = json['_id'],
        text = json['text'],
        questionOptions = json['questionOptions'],
        options = Map<String, String>.from(json['options']),
        correctLabel = json['correct'],
        explanation = json['explanation'];
}
```

---

## 📝 Community Submission

If a user wants to contribute a question:
- **`POST /submissions`**
- **Request body**:
    ```json
    {
      "paperId": "...",
      "moduleId": "...",
      "subModuleId": "...",
      "text": "Identify the correct items:",
      "questionOptions": "a. Item 1\nb. Item 2\nc. Item 3",
      "options": ["Only a", "Only b", "All of above", "None"],
      "correct": 2, // Index 0-3 (0=A, 1=B, 2=C, 3=D)
      "explanation": "..."
    }
    ```

---

## 📊 Summary Stats (Home/Profile Screen)

Use this for the user's dashboard progress cards:
- **`GET /progress/stats`**
- **Response**:
    ```json
    {
      "total": 150,      // Total questions attemptable
      "mastered": 45,   // status: 'got_it'
      "review": 12,     // status: 'review'
      "unseen": 93,     // status: 'unseen'
      "accuracy": 78,   // (totalCorrect / totalAttempts) * 100
      "avgTime": 14,    // average seconds per question
      "streak": 5,      // daily streak
      "points": 1250    // total points
    }
    ```

---

## ⚡ Performance Tips
1.  **Batch Syncing**: Don't sync after every single question. Batch them and sync when the user finishes a set or leaves the quiz screen.
2.  **Exponential Backoff**: If a sync fails, retry with increasing intervals to preserve battery and handle temporary outages.
3.  **Local First**: Always update your local storage immediately, then sync with the backend when online.
