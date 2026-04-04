# User Profile Update API documentation

This document provides details for the API to update user profile information such as Name, Profile Image URL, and Password.

## Base URL
All API requests should be sent to:
`HTTP POST/PATCH [BASE_URL]/auth`

## 1. Update Profile Details
This endpoint allows an authenticated user to update their display name, photo URL, and password.

- **Endpoint**: `/auth/profile`
- **Method**: `PATCH`
- **Authentication**: Required (Include Firebase ID Token in Headers)
- **Headers**:
  ```json
  {
    "Authorization": "Bearer <YOUR_ID_TOKEN>"
  }
  ```

### Request Body
You can provide any combination of the following fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `displayName` | `string` | The new name for the user. |
| `photoURL` | `string` | The new profile image URL. |
| `password` | `string` | The new password for the account (must be at least 6 characters). |

**Example Request:**
```json
{
    "displayName": "John Doe",
    "photoURL": "https://example.com/profiles/johndoe.jpg",
    "password": "NewSecurePassword123"
}
```

### Response
- **Success (200 OK)**:
  ```json
  {
    "message": "Profile updated successfully",
    "user": {
        "uid": "...",
        "email": "user@example.com",
        "displayName": "John Doe",
        "photoURL": "https://example.com/profiles/johndoe.jpg",
        "role": "user",
        "createdAt": "..."
    }
  }
  ```
- **Error (400 Bad Request)**: No fields provided or invalid data.
- **Error (401 Unauthorized)**: Invalid or missing token.
- **Error (500 Server Error)**: Firebase or database error.

---

## 2. Get Current Profile
Use this endpoint to fetch the updated profile data.

- **Endpoint**: `/auth/me`
- **Method**: `GET`
- **Authentication**: Required
- **Headers**:
  ```json
  {
    "Authorization": "Bearer <YOUR_ID_TOKEN>"
  }
  ```

### Response
```json
{
  "user": {
    "uid": "...",
    "email": "...",
    "displayName": "...",
    "photoURL": "...",
    "role": "...",
    "createdAt": "..."
  }
}
```

---

## Implementation Notes:
- Updates are synced to both **Firebase Auth** (for authentication) and **MongoDB** (for application data).
- The `photoURL` field has been added to the MongoDB User model.
- If you update the password, ensure the frontend handles potential needs for re-authentication according to Firebase best practices if the token expires.
