# Pagination Guide

This guide explains how to use the newly implemented pagination for the `questions`, `questions/search`, `submissions`, and `admin/users` endpoints in the Netquiz API.

## Overview

All list endpoints that support pagination now use query parameters (`page` and `limit`) to control the amount of data returned, and they include a `pagination` object in the response.

### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | Integer | `1` | The page number to fetch. |
| `limit` | Integer | `20` / `50` | The number of documents to return per page. Use `limit=0` to fetch **all** available data without pagination (useful for downloads). |

### Response Structure

Paginated endpoints will now return an object that contains the data array and a `pagination` metadata object.

```json
{
  "questions": [ ... ], // or "submissions", or "users"
  "pagination": {
    "total": 150,        // Total number of items matching the query
    "page": 1,           // Current page number
    "limit": 20,         // Current items limit
    "totalPages": 8      // Total number of available pages
  }
}
```

---

## Example Usage

### 1. Questions Endpoint

**Fetch default page (page 1, limit 20):**
```http
GET /questions
```

**Fetch specific page (page 3, limit 15):**
```http
GET /questions?page=3&limit=15
```

**Fetch all questions in a module (no limit):**
```http
GET /questions?moduleId=abc123def456&limit=0
```

### 2. General Search Endpoint

**Search questions by text (page 1, limit 50 by default):**
```http
GET /questions/search?q=network
```

**Paginate search results:**
```http
GET /questions/search?q=network&page=2&limit=10
```

### 3. Submissions Endpoint

**Fetch submissions for the user (or all submissions for admin):**
```http
GET /submissions?page=1&limit=20
```

**Fetch specific status submissions with pagination:**
```http
GET /submissions?status=pending&page=2&limit=10
```

### 4. Admin Users List

**Fetch users (already supported):**
```http
GET /admin/users?page=1&limit=20
```

## Integrating on the Client (Flutter)

When fetching paginated data, you can read the `pagination.totalPages` property to determine whether a "Load More" or "Next Page" button is necessary.

```dart
final response = await http.get(Uri.parse('$baseUrl/questions?page=$currentPage&limit=20'));
final data = jsonDecode(response.body);

final List questions = data['questions'];
final pagination = data['pagination'];

if (pagination['page'] < pagination['totalPages']) {
  // Show "Next Page" button or trigger auto-load
}
```
