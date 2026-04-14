# Level System API Documentation

This document outlines the API endpoints and data model changes for the new Level-Based Quiz System.

## Data Model Changes

### Progress Model
Added a `level` field to the `Progress` schema to track the user's current level.

- **Field**: `level`
- **Type**: `Number`
- **Default**: `1`

## API Endpoints

### 1. Sync Progress & Level
Update both question progress and the user's current level. The backend will only update the level if the incoming `level` is greater than the current stored level.

- **URL**: `/progress/sync`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <ID_TOKEN>`
- **Payload**:
    ```json
    {
      "questions": [
        {
          "questionId": "...",
          "status": "got_it",
          "attempts": 1,
          "correct": 1,
          "lastSeen": "2024-03-20T10:00:00Z",
          "avgTime": 5000
        }
      ],
      "lastActiveDate": "2024-03-20T10:00:00Z",
      "level": 2
    }
    ```
- **Response**: Returns updated stats including the new `level`.

### 2. Get User Stats
Returns the user's current level along with other performance metrics.

- **URL**: `/progress/stats`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <ID_TOKEN>`
- **Response**:
    ```json
    {
      "total": 100,
      "mastered": 40,
      "review": 10,
      "unseen": 50,
      "accuracy": 85,
      "avgTime": 12000,
      "streak": 5,
      "activeDates": ["2024-03-18", "2024-03-20"],
      "points": 1200,
      "level": 2
    }
    ```

### 3. Get User Profile (Me)
The `/progress/me` endpoint now also returns the `level`.

## Frontend Implementation Notes

- **Level Completion**: When a user completes a level (e.g., Level 1), the frontend should call `/progress/sync` with `level: 2`.
- **Level Increments**: Levels are displayed in groups of 10 (e.g., Level 1-10, Level 11-20). 
- **Question Source**: For level quizzes, the app should use the questions already downloaded locally.
