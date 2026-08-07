# NetQuiz Backend Update Instructions (Daily Quiz System)

## Goal

Extend the existing backend with a new Daily Quiz system for the web application **without removing or breaking any existing functionality**.

The existing APIs, models, and routes should continue to work exactly as they do today. Features such as offline paper download, progress syncing, and other mobile-specific functionality must remain untouched because they may be used in future Flutter/mobile applications.

The Daily Quiz system should be implemented as an additional feature.

---

# Existing Structure

The current curriculum hierarchy is:

```
Paper
    ├── Module
    │      └── Questions
    └── Questions (optional)
```

Although SubModules currently exist in the database and APIs, **the new Daily Quiz system must completely ignore SubModules**.

For Daily Quiz generation:

* Questions belong to a Paper.
* Module filtering is optional.
* SubModules are never considered.

Do **not** remove the existing SubModule implementation.

---

# User Flow

## Registration

Users register or login using the existing authentication system.

No changes required.

---

## Daily Quiz Setup

Introduce a new user configuration screen.

The user can:

* Select one or more Papers.
* Configure a daily question count **independently for each selected Paper**.

Example:

```
Paper 1
Questions/day: 25

Computer Science
Questions/day: 50

Education
Questions/day: 10
```

Question limits should support:

* 10
* 25
* 50
* 100
* Custom number

---

## Home Screen

Each selected Paper should appear as its own Daily Quiz card.

Example:

```
Today's Daily Quiz

[▶ Paper 1]
25 Questions

[▶ Computer Science]
50 Questions

[▶ Education]
10 Questions
```

Each Paper has an independent Start button.

---

## Starting a Quiz

When the user starts a quiz for a Paper:

1. Check whether today's quiz already exists.
2. If yes:

   * Return the same quiz.
3. If no:

   * Generate today's quiz.
   * Save it.
   * Return it.

The quiz should never regenerate during the same day.

---

## Question Selection

Questions should be randomly selected from the chosen Paper.

Requirements:

* Randomized.
* Avoid recently used questions whenever possible.
* Prefer unseen questions.
* If the Paper does not contain enough unused questions, previously used questions may be reused.

This logic should be isolated so it can be improved later.

---

## Quiz Behaviour

Users may answer questions as many times as they want.

Example:

```
Question 8

Attempt 1
Wrong

Attempt 2
Wrong

Attempt 3
Correct
```

The question remains incomplete until answered correctly.

---

## Quiz Completion

The quiz is complete only when every generated question has been answered correctly.

Completion should be tracked separately for every Paper.

Example:

```
Paper 1
Completed

Computer Science
In Progress

Education
Not Started
```

---

# Daily Reset

Each Paper receives a brand-new quiz every day.

Yesterday's quiz should never be overwritten.

A new Daily Quiz document should be created for each day.

---

# New Data Models

Introduce new models instead of modifying the existing Progress model.

## Daily Quiz Settings

Stores the user's preferences.

Suggested fields:

* uid
* selectedPapers
* questionLimit per Paper

Example:

```
uid

papers:
[
    {
        paperId,
        questionLimit
    }
]
```

---

## Daily Quiz

Stores one generated quiz for one user, one Paper, one day.

Suggested fields:

* uid
* paperId
* date
* questions
* completed
* createdAt

Each question should store:

* questionId
* attempts
* solved
* solvedAt

---

# API Endpoints

Create a new route group.

```
/daily-quiz
```

Suggested endpoints:

### GET /daily-quiz/settings

Returns the user's quiz preferences.

---

### PUT /daily-quiz/settings

Updates selected Papers and question counts.

---

### GET /daily-quiz

Returns today's quizzes for every selected Paper.

---

### POST /daily-quiz/:paperId/start

Creates today's quiz if it doesn't already exist.

Returns the existing quiz if already generated.

---

### POST /daily-quiz/:paperId/answer

Checks an answer.

Updates:

* attempts
* solved status

Returns whether the answer is correct.

---

### GET /daily-quiz/:paperId/status

Returns:

* completed
* solved count
* remaining questions

---

# Existing Features

The following existing backend functionality must remain unchanged:

* Authentication
* Curriculum APIs
* Question Management
* Community Submissions
* Progress Tracking
* Leaderboard
* Offline Paper Download
* Admin Dashboard
* Mobile Progress Sync

The new Daily Quiz system should be implemented independently without breaking or modifying these existing features.

---

# Future Extensibility

The Daily Quiz architecture should be designed so that future features can be added easily, such as:

* Weekly Challenges
* Monthly Challenges
* Paper-specific streaks
* XP rewards
* Difficulty-based question selection
* AI-generated personalized quizzes

The implementation should remain modular and avoid coupling the Daily Quiz logic with the existing Progress system.
