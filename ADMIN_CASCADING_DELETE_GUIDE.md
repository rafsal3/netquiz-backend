# Admin Cascading Delete & Question Handling Guide

This guide explains how to use the new cascading delete functionality for Papers, Modules, and Submodules, specifically regarding how associated questions are handled.

## Overview

When deleting a curriculum entity (Paper, Module, or Submodule), the system now requires you to specify what should happen to the questions currently assigned to it. You have two options:
1. **Delete**: All questions under that entity will be permanently removed from the database.
2. **Uncategorize**: All questions will remain in the database but will have their curriculum links (Paper, Module, or Submodule) removed. These questions can then be found in the "Uncategorized" section and reassigned later.

## API Usage for Admin

When making a `DELETE` request to the curriculum endpoints, you must include a `questionsAction` query parameter.

### 1. Deleting a Paper
**Endpoint:** `DELETE /curriculum/papers/:id?questionsAction=[action]`

*   **Action `delete`**: Deletes the Paper, all its Modules, all its Submodules, and **all Questions** linked to this Paper.
*   **Action `uncategorize`**: Deletes the Paper and its child curriculum, but **keeps the Questions**. The questions will have their `paperId`, `moduleId`, and `subModuleId` cleared.

### 2. Deleting a Module
**Endpoint:** `DELETE /curriculum/modules/:id?questionsAction=[action]`

*   **Action `delete`**: Deletes the Module, its Submodules, and **all Questions** linked to this Module.
*   **Action `uncategorize`**: Deletes the Module and its Submodules, but **keeps the Questions**. The questions will have their `moduleId` and `subModuleId` cleared (they will still retain their `paperId`).

### 3. Deleting a Submodule
**Endpoint:** `DELETE /curriculum/submodules/:id?questionsAction=[action]`

*   **Action `delete`**: Deletes the Submodule and **all Questions** linked to it.
*   **Action `uncategorize`**: Deletes the Submodule but **keeps the Questions**. The questions will have their `subModuleId` cleared (they will still retain their `paperId` and `moduleId`).

## UI Implementation Hint

In the Admin Panel, when a user clicks the "Delete" icon for a Paper, Module, or Submodule:

1.  **Show a Confirmation Dialog**:
    "Are you sure you want to delete this [Paper/Module/Submodule]? This action will also delete all its child curriculum elements."

2.  **Add Question Handling Options**:
    Ask the user: "What should happen to the questions under this [Paper/Module/Submodule]?"
    *   ( ) **Delete all questions** (Action: `delete`)
    *   ( ) **Keep questions as uncategorized** (Action: `uncategorize`)

3.  **Execute Request**:
    Send the `DELETE` request with the chosen `questionsAction` as a query parameter.

## Finding Uncategorized Questions

To retrieve questions that have been "uncategorized" (specifically those with no Module assigned), use:
`GET /questions?uncategorized=true`

This will help you find orphans and reassign them to new curriculum paths.
