# NetQuiz Frontend Update Instructions (User Portal Only)

## Project Context

- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: React Router v6
- **Data Fetching**: TanStack Query (`@tanstack/react-query`)
- **Auth**: Firebase + custom auth context (`src/lib/auth-context.tsx`)
- **API Layer**: `src/lib/api.ts` — a single module of typed `fetch` wrappers all sharing one `request<T>()` helper
- **Backend base URL**: `http://localhost:5001` (hardcoded in `api.ts` for local dev)

---

## Objective

Extend the existing **User Portal** to support the new **Daily Quiz** workflow.

**Do NOT modify the Admin Portal in any way.**

---

## Admin Portal — Do Not Touch

The following files and their dependencies must remain completely unchanged:

- `src/pages/OverviewPage.tsx`
- `src/pages/CurriculumPage.tsx`
- `src/pages/QuestionsPage.tsx`
- `src/pages/SubmissionsPage.tsx`
- `src/pages/UsersPage.tsx`
- `src/pages/UserDetailPage.tsx`
- `src/pages/SubmissionDetailPage.tsx`
- `src/components/AdminLayout.tsx`
- `src/components/questions/*`
- `src/components/submissions/*`
- All `adminLinks` in `src/components/AppSidebar.tsx`
- All admin `<Route>` entries in `src/App.tsx` (inside the `if (isAdmin)` block)

---

# Changes Required

---

## 1. Hide Two User Navigation Items — `src/components/AppSidebar.tsx`

**Do not delete any files or code.**

In `AppSidebar.tsx`, the `userLinks` array currently is:

```ts
const userLinks = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/curriculum", icon: BookOpen, label: "Curriculum" },
  { to: "/explore", icon: Search, label: "Explore" },
  { to: "/attend", icon: Target, label: "Attend Questions" },
  { to: "/submit", icon: Send, label: "Submit Question" },       // ← HIDE
  { to: "/my-submissions", icon: Inbox, label: "My Submissions" }, // ← HIDE
  { to: "/profile", icon: UserIcon, label: "Profile" },
];
```

Remove the two entries for `Submit Question` and `My Submissions` from the `userLinks` array **only**. Do not delete the imported icon variables if they are used elsewhere in the file.

The updated `userLinks` should be:

```ts
const userLinks = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/daily-quiz", icon: CalendarCheck, label: "Daily Quiz" },
  { to: "/daily-quiz/settings", icon: Settings, label: "Quiz Settings" },
  { to: "/curriculum", icon: BookOpen, label: "Curriculum" },
  { to: "/explore", icon: Search, label: "Explore" },
  { to: "/attend", icon: Target, label: "Attend Questions" },
  { to: "/profile", icon: UserIcon, label: "Profile" },
];
```

Import the two new icons from `lucide-react`: `CalendarCheck` and `Settings`.

---

## 2. Keep Routes But Remove Nav Links — `src/App.tsx`

In the user routes block (inside `if (!isAdmin)`), **keep** the existing routes for `/submit` and `/my-submissions`:

```tsx
<Route path="/submit" element={<SubmitQuestionPage />} />
<Route path="/my-submissions" element={<MySubmissionsPage />} />
```

These routes should remain registered so deep-links still work. They are simply invisible in the sidebar.

**Add** two new routes to the user routes block:

```tsx
<Route path="/daily-quiz" element={<DailyQuizPage />} />
<Route path="/daily-quiz/settings" element={<DailyQuizSettingsPage />} />
```

Import the two new page components:

```tsx
import DailyQuizPage from "@/pages/user/DailyQuizPage";
import DailyQuizSettingsPage from "@/pages/user/DailyQuizSettingsPage";
```

The complete updated user `<Routes>` block should be:

```tsx
<Routes>
  <Route element={<UserLayout />}>
    <Route path="/" element={<UserOverviewPage />} />
    <Route path="/daily-quiz" element={<DailyQuizPage />} />
    <Route path="/daily-quiz/settings" element={<DailyQuizSettingsPage />} />
    <Route path="/curriculum" element={<CurriculumExplorer />} />
    <Route path="/explore" element={<QuestionExplore />} />
    <Route path="/attend" element={<AttendPage />} />
    <Route path="/submit" element={<SubmitQuestionPage />} />
    <Route path="/my-submissions" element={<MySubmissionsPage />} />
    <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
    <Route path="/profile" element={<ProfilePage />} />
  </Route>
  <Route path="*" element={<NotFound />} />
</Routes>
```

---

## 3. Extend the API Layer — `src/lib/api.ts`

**Do not modify or remove any existing functions.**

Append the following new section at the bottom of `src/lib/api.ts`:

```ts
// ─── Daily Quiz ───────────────────────────────────────────────────────────────

export interface PaperSetting {
  paperId: string;
  questionLimit: number;
}

export interface DailyQuizSettings {
  uid: string;
  papers: {
    paperId: { _id: string; name: string; order: number } | string;
    questionLimit: number;
  }[];
}

export interface DailyQuizCard {
  paperId: string;
  paperName: string;
  questionLimit: number;
  status: "not_started" | "in_progress" | "completed";
  solvedCount: number;
  totalCount: number;
  completed: boolean;
}

export interface DailyQuizQuestion {
  questionId: any; // populated Question document
  attempts: number;
  solved: boolean;
  solvedAt?: string | null;
}

export interface DailyQuiz {
  _id: string;
  uid: string;
  paperId: string;
  date: string;
  completed: boolean;
  questions: DailyQuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: "A" | "B" | "C" | "D";
  solved: boolean;
  attempts: number;
  quizCompleted: boolean;
}

export interface QuizStatus {
  date: string;
  paperId: string;
  status: "not_started" | "in_progress" | "completed";
  completed: boolean;
  solvedCount: number;
  remainingCount: number;
  totalCount: number;
  questions: {
    questionId: string;
    attempts: number;
    solved: boolean;
    solvedAt?: string | null;
  }[];
}

/** GET /daily-quiz/settings — returns the user's paper selections and limits */
export const getDailyQuizSettings = () =>
  request<DailyQuizSettings>("/daily-quiz/settings");

/** PUT /daily-quiz/settings — saves paper selections and per-paper question limits */
export const saveDailyQuizSettings = (papers: PaperSetting[]) =>
  request<{ message: string; settings: DailyQuizSettings }>("/daily-quiz/settings", {
    method: "PUT",
    body: JSON.stringify({ papers }),
  });

/** GET /daily-quiz — returns today's quiz cards for all selected papers */
export const getTodaysQuizzes = () =>
  request<{ date: string; quizzes: DailyQuizCard[] }>("/daily-quiz");

/** POST /daily-quiz/:paperId/start — creates or returns today's quiz for one paper */
export const startDailyQuiz = (paperId: string) =>
  request<{ message: string; quiz: DailyQuiz; alreadyExists: boolean }>(
    `/daily-quiz/${paperId}/start`,
    { method: "POST" }
  );

/** POST /daily-quiz/:paperId/answer — submits an answer for one question */
export const submitDailyQuizAnswer = (
  paperId: string,
  questionId: string,
  answer: "A" | "B" | "C" | "D"
) =>
  request<AnswerResult>(`/daily-quiz/${paperId}/answer`, {
    method: "POST",
    body: JSON.stringify({ questionId, answer }),
  });

/** GET /daily-quiz/:paperId/status — returns completion status and progress counts */
export const getDailyQuizStatus = (paperId: string) =>
  request<QuizStatus>(`/daily-quiz/${paperId}/status`);
```

---

## 4. New File: `src/pages/user/DailyQuizSettingsPage.tsx`

### Purpose
Allow the user to select which papers they want and set a per-paper daily question limit.

### Data Flow
1. On mount, call `getDailyQuizSettings()` to load current preferences.
2. Call `getPapers()` to get all available papers.
3. The user toggles papers on/off and sets a question limit per paper.
4. On save, call `saveDailyQuizSettings(papers)` and show a success toast via `sonner`.

### Layout

```
Page Title: "Daily Quiz Settings"
Subtitle: "Choose which papers to include in your daily quiz and how many questions per day."

──────────────────────────────────────────────────────────────────────────────
[Paper 1]                                               [Toggle Switch ON/OFF]
  Questions per day:
  ( ) 10   (•) 25   ( ) 50   ( ) 100   ( ) Custom [___]

──────────────────────────────────────────────────────────────────────────────
[Computer Science]                                      [Toggle Switch ON/OFF]
  Questions per day:
  ( ) 10   ( ) 25   (•) 50   ( ) 100   ( ) Custom [___]

──────────────────────────────────────────────────────────────────────────────
...

                                          [ Save Settings ]
```

### Component Details

- Use `Card` from `@/components/ui/card` for each paper row.
- Use `Switch` from `@/components/ui/switch` to enable/disable each paper.
- Use `RadioGroup` and `RadioGroupItem` from `@/components/ui/radio-group` for question count options (10, 25, 50, 100, Custom).
- When "Custom" is selected, show an `Input` (number type, min=1) next to it for the user to type a value.
- Only show the question count selector for **enabled** papers.
- Use `useQuery` (TanStack Query) with key `["daily-quiz-settings"]` for loading settings.
- Use `useQuery` with key `["papers"]` for loading papers (reuse existing `getPapers()` function).
- Use `useMutation` for saving. On success, invalidate the `["daily-quiz-settings"]` query.
- Show `Skeleton` components while loading.
- Use `toast` from `sonner` for success/error feedback.

### State Shape

```ts
type PaperConfig = {
  paperId: string;
  paperName: string;
  enabled: boolean;
  questionLimit: number;
  customLimit: string; // string so the input stays controlled
};
```

---

## 5. New File: `src/pages/user/DailyQuizPage.tsx`

### Purpose
The user's primary daily landing page. Shows today's quiz cards for all selected papers and allows starting/continuing each quiz.

### Data Flow
1. On mount, call `getTodaysQuizzes()` to get today's cards.
2. If `quizzes` is empty, show a prompt to go to settings.
3. Each card has a button (Start / Continue / Review) that navigates to the quiz session.
4. Clicking Start/Continue calls `startDailyQuiz(paperId)` then opens the inline quiz experience.

### Page Layout

```
Section 1 — "Today's Daily Quizzes"

  [DailyQuizCard] [DailyQuizCard] [DailyQuizCard]

  (if no papers configured):
    "No quizzes configured yet."
    [Go to Daily Quiz Settings →]

──────────────────────────────────────────────────────

Section 2 — "Learning Statistics"  (existing stats, moved below)

  [StatCard: Accuracy]  [StatCard: Points]  [StatCard: Streak]
  [StatCard: Mastered]  [StatCard: Review]  [StatCard: Total]
```

### Quiz Card Design

Each `DailyQuizCard` component should display:

| Field | Value |
|---|---|
| Paper Name | Bold title |
| Question count | e.g. "25 Questions" |
| Status badge | `not_started` → grey "Not Started", `in_progress` → blue "In Progress", `completed` → green "Completed ✓" |
| Progress | Only show when `in_progress`: "12 / 50 Solved" + a `Progress` bar |
| Action button | `not_started` → "Start", `in_progress` → "Continue", `completed` → "Review" |

Use the existing `Badge` component from `@/components/ui/badge` for the status.  
Use the existing `Progress` component from `@/components/ui/progress`.  
Use the existing `Card` component.  
Use the existing `Button` component.

### Reuse Stats

Import and reuse the existing `StatCard` from `src/components/overview/StatCard.tsx`.  
Fetch stats with the existing `getProgressStats()` API function.  
Use `useQuery` with key `["progress-stats"]`.

---

## 6. New File: `src/components/daily-quiz/DailyQuizSession.tsx`

### Purpose
The in-quiz experience for a single daily quiz session (one paper, one day).  
Rendered inline within `DailyQuizPage` when the user clicks Start/Continue, or as a full-page overlay.

### Data Flow
1. Receive `paperId` and `quiz` (the `DailyQuiz` object from `startDailyQuiz()`) as props.
2. Track `currentIndex` in local state — start at the first unsolved question.
3. When user selects an option and submits, call `submitDailyQuizAnswer(paperId, questionId, answer)`.
4. Show instant feedback (correct/wrong) using the existing explanation panel pattern.
5. If wrong: keep the same question active, increment attempts shown, allow retry.
6. If correct: mark question done, auto-advance to the next unsolved question.
7. When all questions are solved (`quizCompleted: true`), show a completion screen.

### Key Behaviours (Different from Practice/Attend Mode)

| Feature | Practice/Attend Mode | Daily Quiz Mode |
|---|---|---|
| Move to next on wrong | Yes (skip) | No — retry until correct |
| Skip questions | Yes | No |
| Progress persistence | Local state only | Server-persisted via API |
| Completion | All questions seen | All questions answered **correctly** |

### UI Components to Reuse

- Reuse the question card layout from the existing `AttendPage` or `QuestionExplore` if applicable.
- Reuse `MathRenderer` from `src/components/MathRenderer.tsx` for rendering LaTeX equations.
- Reuse the explanation panel (show after answering, whether correct or wrong).
- Use existing `Button`, `Badge`, `Card`, `Progress` components.
- Show attempt count: "Attempt 2" label above the options when `attempts > 0`.

### Props

```ts
interface DailyQuizSessionProps {
  paperId: string;
  quiz: DailyQuiz;
  onClose: () => void;        // goes back to DailyQuizPage
  onComplete: () => void;     // called when all questions are solved
}
```

### Progress Indicator

Show at the top: `Solved: 12 / 25` and a `Progress` bar (percentage = solvedCount / totalCount * 100).

---

## 7. New Files — Component Location

Create a new directory: `src/components/daily-quiz/`

Create the following files in it:

| File | Purpose |
|---|---|
| `DailyQuizCard.tsx` | One card per paper on the Daily Quiz page |
| `DailyQuizSession.tsx` | The full quiz experience for one paper |
| `QuizStatusBadge.tsx` | Badge showing not_started / in_progress / completed |
| `QuizProgressBar.tsx` | Thin progress bar: solved / total |

---

## 8. Update `src/pages/user/UserOverviewPage.tsx` (if it exists)

**Do not break the existing page.**

If `UserOverviewPage` currently shows practice stats at the top, reorder the content so that:

1. A prominent link/card section "Today's Daily Quizzes" appears first — this can be a simple call-to-action card linking to `/daily-quiz`.
2. The existing statistics section stays below.

If the page already delegates stats to components, simply add the daily quiz callout above the existing stats grid.

---

## 9. Component & File Summary

### New Pages

| File | Route |
|---|---|
| `src/pages/user/DailyQuizPage.tsx` | `/daily-quiz` |
| `src/pages/user/DailyQuizSettingsPage.tsx` | `/daily-quiz/settings` |

### New Components

| File | Used By |
|---|---|
| `src/components/daily-quiz/DailyQuizCard.tsx` | `DailyQuizPage` |
| `src/components/daily-quiz/DailyQuizSession.tsx` | `DailyQuizPage` |
| `src/components/daily-quiz/QuizStatusBadge.tsx` | `DailyQuizCard` |
| `src/components/daily-quiz/QuizProgressBar.tsx` | `DailyQuizCard`, `DailyQuizSession` |

### Modified Files

| File | Change |
|---|---|
| `src/components/AppSidebar.tsx` | Update `userLinks` only |
| `src/App.tsx` | Add 2 new user routes, import 2 new page components |
| `src/lib/api.ts` | Append new Daily Quiz API functions and types |

### Hidden (Not Deleted) Files

| File | Status |
|---|---|
| `src/pages/user/SubmitQuestionPage.tsx` | Route kept, nav link removed |
| `src/pages/user/MySubmissionsPage.tsx` | Route kept, nav link removed |

---

## 10. Design Guidelines

Follow the existing design system exactly. Do **not** introduce new design tokens or custom CSS classes.

- All layout must use the existing `Card`, `CardHeader`, `CardContent`, `CardFooter` from `@/components/ui/card`.
- Use `Badge` from `@/components/ui/badge` for status labels.
- Use `Progress` from `@/components/ui/progress` for progress bars.
- Use `Button` from `@/components/ui/button` for all actions.
- Use `Switch` from `@/components/ui/switch` for toggles.
- Use `RadioGroup`, `RadioGroupItem` from `@/components/ui/radio-group` for question count pickers.
- Use `Input` from `@/components/ui/input` for custom number entry.
- Use `Skeleton` from `@/components/ui/skeleton` for loading states.
- Use `toast` from `sonner` (not the old `useToast` hook) for notifications.
- All new pages use `useQuery` and `useMutation` from `@tanstack/react-query`.
- Auth token is automatically injected via the `request()` helper in `api.ts` — no manual token handling needed in components.

---

## 11. TanStack Query Key Conventions

Use these consistent query keys:

| Data | Query Key |
|---|---|
| Daily Quiz Settings | `["daily-quiz-settings"]` |
| Today's Quizzes | `["daily-quizzes-today"]` |
| Quiz Status for a paper | `["daily-quiz-status", paperId]` |
| Papers list | `["papers"]` (already used in other pages) |
| Progress stats | `["progress-stats"]` (already used in other pages) |

---

## 12. Important Constraints

- Do **not** modify the Admin Portal.
- Do **not** delete any existing files.
- Do **not** remove existing routes from `App.tsx`.
- Only remove the nav link entries for Submit Question and My Submissions from `userLinks` in `AppSidebar.tsx`.
- Do **not** break any existing API functions in `api.ts`.
- Reuse existing quiz/practice UI components (MathRenderer, explanation panel, etc.) wherever possible.
- Keep all new Daily Quiz components in `src/components/daily-quiz/` for clean separation.
- Keep the implementation modular so the hidden features (`/submit`, `/my-submissions`) can be re-enabled by simply adding them back to `userLinks` and the nav.
