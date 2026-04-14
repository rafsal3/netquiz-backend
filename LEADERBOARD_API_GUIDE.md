# 🏆 Leaderboard API Guide

This guide covers everything you need to integrate the leaderboard into your Flutter app.

---

## Endpoint

```
GET /progress/leaderboard
```

**Auth required:** Yes — `Authorization: Bearer <firebase_id_token>`

---

## Query Parameters

| Parameter | Type    | Default | Max | Description                          |
|-----------|---------|---------|-----|--------------------------------------|
| `limit`   | integer | `50`    | `200` | Number of top users to return       |

**Example:**
```
GET /progress/leaderboard?limit=100
```

---

## Response

```json
{
  "leaderboard": [
    {
      "rank": 1,
      "uid": "firebase_uid_abc",
      "displayName": "Alice",
      "photoURL": "https://lh3.googleusercontent.com/...",
      "totalPoints": 4200,
      "streak": 14
    },
    {
      "rank": 2,
      "uid": "firebase_uid_def",
      "displayName": "Bob",
      "photoURL": null,
      "totalPoints": 3750,
      "streak": 7
    }
  ],
  "total": 312,
  "myRank": {
    "rank": 47,
    "uid": "firebase_uid_me",
    "displayName": "You",
    "photoURL": "https://...",
    "totalPoints": 830,
    "streak": 3
  }
}
```

### Response Fields

| Field                       | Type            | Description                                                      |
|-----------------------------|-----------------|------------------------------------------------------------------|
| `leaderboard`               | `array`         | Top N users sorted by `totalPoints` descending                   |
| `leaderboard[].rank`        | `int`           | 1-based rank position                                            |
| `leaderboard[].uid`         | `string`        | Firebase UID of the user                                         |
| `leaderboard[].displayName` | `string`        | User's display name (falls back to `"Anonymous"`)                |
| `leaderboard[].photoURL`    | `string\|null`  | Profile picture URL (falls back to `null`)                       |
| `leaderboard[].totalPoints` | `int`           | Total points earned from correct answers                         |
| `leaderboard[].streak`      | `int`           | Current daily activity streak                                    |
| `total`                     | `int`           | Total number of users on the leaderboard (with points > 0)       |
| `myRank`                    | `object\|null`  | The calling user's own rank entry. `null` if they have 0 points  |

> **Note:** `myRank` is always returned even if the user's rank falls outside the requested `limit`. This allows you to always show "You are #47" even when only showing the top 20.

---

## Points System

Points are awarded automatically when progress is synced via `POST /progress/sync`:

- **+10 points** per correct answer submitted in a sync

---

## Dart Model

```dart
class LeaderboardEntry {
  final int rank;
  final String uid;
  final String displayName;
  final String? photoURL;
  final int totalPoints;
  final int streak;

  const LeaderboardEntry({
    required this.rank,
    required this.uid,
    required this.displayName,
    this.photoURL,
    required this.totalPoints,
    required this.streak,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return LeaderboardEntry(
      rank: json['rank'] as int,
      uid: json['uid'] as String,
      displayName: json['displayName'] as String? ?? 'Anonymous',
      photoURL: json['photoURL'] as String?,
      totalPoints: json['totalPoints'] as int,
      streak: json['streak'] as int,
    );
  }
}

class LeaderboardResponse {
  final List<LeaderboardEntry> leaderboard;
  final int total;
  final LeaderboardEntry? myRank;

  const LeaderboardResponse({
    required this.leaderboard,
    required this.total,
    this.myRank,
  });

  factory LeaderboardResponse.fromJson(Map<String, dynamic> json) {
    return LeaderboardResponse(
      leaderboard: (json['leaderboard'] as List)
          .map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: json['total'] as int,
      myRank: json['myRank'] != null
          ? LeaderboardEntry.fromJson(json['myRank'] as Map<String, dynamic>)
          : null,
    );
  }
}
```

---

## Service / API Call (Dart)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';

class LeaderboardService {
  static const String _baseUrl = 'https://netquiz-backend.onrender.com';

  /// Fetches the leaderboard.
  /// [limit] defaults to 50. Max 200.
  static Future<LeaderboardResponse> fetchLeaderboard({int limit = 50}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');

    final token = await user.getIdToken();

    final uri = Uri.parse('$_baseUrl/progress/leaderboard?limit=$limit');

    final response = await http.get(uri, headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    });

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return LeaderboardResponse.fromJson(data);
    } else {
      throw Exception('Failed to load leaderboard: ${response.statusCode}');
    }
  }
}
```

---

## Flutter UI Integration Tips

### Showing the List + Your Rank

The recommended layout for a leaderboard screen:

1. **Sticky header / pinned card** — Show `myRank` at the top (or bottom) so the user always sees their position regardless of scroll position.
2. **ListView** — Render `leaderboard` entries as tiles.
3. **Highlight the current user** — Inside the list, check `entry.uid == currentUser.uid` and style that tile differently (e.g. accent background, bold text).

```dart
// Inside your build() / ListView.builder
final isMe = entry.uid == FirebaseAuth.instance.currentUser?.uid;

ListTile(
  leading: CircleAvatar(
    backgroundImage: entry.photoURL != null
        ? NetworkImage(entry.photoURL!)
        : null,
    child: entry.photoURL == null
        ? Text(entry.displayName[0].toUpperCase())
        : null,
  ),
  title: Text(
    entry.displayName,
    style: TextStyle(
      fontWeight: isMe ? FontWeight.bold : FontWeight.normal,
    ),
  ),
  subtitle: Text('${entry.totalPoints} pts  •  🔥 ${entry.streak} day streak'),
  trailing: Text(
    '#${entry.rank}',
    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
  ),
  tileColor: isMe ? Colors.amber.withOpacity(0.15) : null,
);
```

### Handling `myRank == null`

If `myRank` is `null`, the user hasn't earned any points yet. Show a prompt instead:

```dart
if (response.myRank == null)
  const Padding(
    padding: EdgeInsets.all(12),
    child: Text(
      'Complete quizzes to earn points and appear on the leaderboard!',
      textAlign: TextAlign.center,
    ),
  ),
```

### Pagination / Load More

The API doesn't use cursor-based pagination — it returns all ranked users and slices by `limit`. To implement "load more":

- Start with `limit=20`
- On "Load more" button press, refetch with `limit=50`, then `limit=100`, etc.

---

## Error Responses

| Status | Reason                          |
|--------|---------------------------------|
| `401`  | Missing or invalid Firebase token |
| `500`  | Internal server error           |
