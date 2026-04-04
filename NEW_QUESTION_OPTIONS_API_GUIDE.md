# API Update: Question Options Support

This document outlines the changes made to the Question model and related API endpoints to support "Question Options". These are distinctive from the actual selectable options (A, B, C, D) and are typically used for questions that list multiple items (a, b, c, d) within the question body itself.

## Model Changes

The `Question` model now includes an optional field `questionOptions`.

### `IQuestion` Interface
```typescript
{
    // ... other fields
    options: { A: string; B: string; C: string; D: string }; // Selectable options
    questionOptions?: string; // Items within question (e.g. "a. item 1\nb. item 2...")
    correct: 'A' | 'B' | 'C' | 'D';
    // ... other fields
}
```

## API Endpoint Updates

### 1. Create Question (`POST /questions`)
You can now pass `questionOptions` when creating a single question.

**Request Body (Object Format):**
```json
{
    "paperId": "...",
    "text": "Which of these are correct?",
    "questionOptions": "a) Item 1\nb) Item 2\nc) Item 3\nd) Item 4",
    "options": {
        "A": "Only a and b",
        "B": "Only b and c",
        "C": "All of them",
        "D": "None of them"
    },
    "correct": "A"
}
```

**Request Body (Array Format):**
The API also accepts an array of strings for `questionOptions`, which will be automatically joined by newlines.
```json
{
    "questionOptions": ["Item 1", "Item 2", "Item 3", "Item 4"]
}
```

---

### 2. Bulk Create Questions (`POST /questions/bulk`)
The bulk upload endpoint now supports `questionOptions` for each question in the array.

**Request Body Snippet:**
```json
{
    "questions": [
        {
            "text": "Question with internal list",
            "questionOptions": "a. Oxygen\nb. Nitrogen\nc. Carbon\nd. Hydrogen",
            "options": {
                "A": "a and b",
                "B": "b and c",
                "C": "c and d",
                "D": "a and d"
            },
            "correct": "A"
        }
    ]
}
```

---

### 3. Update Question (`PUT /questions/:id`)
You can update `questionOptions` like any other field.

---

### 4. Search & Get Questions (`GET /questions`)
The `questionOptions` field will be included in the response if it exists for the question.

## Frontend Action Items
1. **Admin Panel**: Update the question form to include a textarea for `questionOptions`.
2. **Bulk Upload**: Update the column mapping UI to allow mapping the "Options Column" from Excel to `questionOptions`.
3. **App**: When displaying a question, check if `questionOptions` exists. If so, render it (preserving newlines) between the question text and the selectable options.
