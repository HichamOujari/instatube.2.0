# Instatube 2.0 API Documentation

This service provides endpoints to merge YouTube audio and video segments and download the resulting video, tailored for Instagram Reels and similar platforms.

## Base URL

```
http://localhost:3000
```

---

## POST `/merge`

Merge a segment of audio from one YouTube video with a segment of video from another YouTube video. The result is a downloadable video file.

### Request Body

```
{
  "audio": {
    "url": "<AUDIO_YOUTUBE_URL>",
    "from": <start_seconds>,   // optional, default: 0
    "to": <end_seconds>        // optional, default: audio duration
  },
  "video": {
    "url": "<VIDEO_YOUTUBE_URL>",
    "from": <start_seconds>,   // optional, default: 0
    "to": <end_seconds>        // optional, default: video duration
  },
  "format": "portrait" | "paysage" // optional, default: "portrait"
}
```

#### Example

```
POST /merge
Content-Type: application/json

{
  "audio": {
    "url": "https://www.youtube.com/watch?v=audio_id",
    "from": 10,
    "to": 70
  },
  "video": {
    "url": "https://www.youtube.com/watch?v=video_id",
    "from": 5,
    "to": 65
  },
  "format": "portrait"
}
```

### Success Response

- **Status:** 200 OK
- **Content:**

```
{
  "url": "/download/2b1e3c7e-7c2a-4e2b-9b1a-8e2c3d4f5a6b",
  "message": "This download link will expire in 2 hours."
}
```

#### Response Schema

| Field   | Type   | Description                                  |
| ------- | ------ | -------------------------------------------- |
| url     | string | The endpoint to download the merged video.   |
| message | string | Info about link expiration.                  |

### Error Responses

- **400 Bad Request**
  - Missing URLs:
    ```
    { "error": "Both audioUrl and videoUrl are required." }
    ```
  - Invalid time range:
    ```
    { "error": "start should be small then end" }
    ```
  - Video too long:
    ```
    { "error": "The generated video must be no longer than 3 minutes." }
    ```
- **500 Internal Server Error**
  - Download/processing error:
    ```
    { "error": "An error occurred while processing the request." }
    ```

---

## GET `/download/:uuid`

Download the merged video file using the UUID provided by the `/merge` endpoint.

### Path Parameters

- `uuid` (string): The unique identifier for the merged video.

### Example

```
GET /download/2b1e3c7e-7c2a-4e2b-9b1a-8e2c3d4f5a6b
```

### Success Response

- **Status:** 200 OK
- **Content:**
  - Returns the video file as an attachment (MIME type: `video/mp4`).

### Error Response

- **404 Not Found**
  - File expired or not found:
    ```
    { "error": "File is expired" }
    ```
---

## Notes
- The download link is valid for 2 hours after creation.
- The maximum allowed merged video duration is 3 minutes.
- The `format` parameter can be `portrait` (720x1280) or `paysage` (1280x720). Default is `portrait`.
- All time values are in seconds.
