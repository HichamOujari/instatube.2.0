# InstaTube Generator

InstaTube Generator is a Node.js application designed to simplify the process of creating Instagram Reels by merging audio and video tracks from YouTube links. This API-based tool offers a seamless solution for generating engaging content by combining audio from one YouTube video with video from another.

## Usage

To use InstaTube Generator, make an API call to the following endpoint: [https://montreal-apparent-arrived-chan.trycloudflare.com/merge](https://montreal-apparent-arrived-chan.trycloudflare.com/merge)

The payload should include the URLs of the audio and video to merge, structured as follows:

```json
{
  "audio": { "url": "YouTube_audio_link", "from": 0, "to": 60 },
  "video": { "url": "YouTube_video_link", "from": 0, "to": 60 },
  "format": "portrait" // or "paysage" (optional, default is "portrait")
}
```

- `format` (optional):
  - `portrait` (default): Output video will be 720x1280 (vertical/Reels/TikTok style)
  - `paysage`: Output video will be 1280x720 (horizontal/landscape style)

Ensure both audioUrl and videoUrl are valid YouTube links.
