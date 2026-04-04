# Flutter API Update: Question Options Support

This document provides documentation for the Flutter client app to handle the newly added `questionOptions` field in both fetching questions and submitting community contributions.

## 1. Data Model Changes

The `Question` and `Submission` objects now include an optional `questionOptions` field.

### Dart Model Update

```dart
class Question {
  final String id;
  final String text;
  final String? questionOptions; // NEW FIELD: For multiline internal lists (a, b, c, d)
  final Map<String, String> options; // Selectable options (A, B, C, D)
  final String correctLabel; // "A", "B", "C", or "D"
  final String? explanation;

  Question.fromJson(Map<String, dynamic> json)
      : id = json['_id'],
        text = json['text'],
        questionOptions = json['questionOptions'], // Map the new field
        options = Map<String, String>.from(json['options']),
        correctLabel = json['correct'],
        explanation = json['explanation'];
}
```

## 2. Updated Endpoints

### Fetching Questions (`GET /questions/download/:paperId`)
The response will now include `questionOptions` if available for a question.

**UI Implementation Tip:**
When rendering a question, check if `questionOptions` is not null. If it exists, display it between the main `text` and the selectable `options`. 
Ensure you preserve newlines (`\n`) for proper formatting.

---

### Community Submission (`POST /submissions`)
You can now include `questionOptions` when a user submits a question.

**Request Body:**
```json
{
  "paperId": "...",
  "moduleId": "...",
  "subModuleId": "...",
  "text": "Identify the correct statements:",
  "questionOptions": "a. Statement 1\nb. Statement 2\nc. Statement 3",
  "options": ["Only a", "Only b", "All of above", "None"],
  "correct": 2, 
  "explanation": "..."
}
```

*Note: `questionOptions` should be a single string with newlines, or an array of strings which the backend will join for you.*

---

## 3. Submission Update for App Developers

If you are building a "Submit Question" screen in Flutter:

1.  Add a new multiline `TextField` for "Question List/Labels" (optional).
2.  Map this to the `questionOptions` key in your API request.
3.  This field is primarily used when the question includes a numbered or lettered list (e.g., "Which of the following are true? a) X b) Y c) Z") where the selectable options A, B, C, D then refer to those labels.

## 4. Example JSON Response (Question)

```json
{
  "_id": "6608...",
  "text": "Consider the following statements about the heart:",
  "questionOptions": "a) It has four chambers\nb) The left ventricle is thicker\nc) Atria receive blood",
  "options": {
    "A": "a and b only",
    "B": "b and c only",
    "C": "All are correct",
    "D": "None are correct"
  },
  "correct": "C",
  "explanation": "The heart has 4 chambers..."
}
```
