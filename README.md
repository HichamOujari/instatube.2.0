# InstaTube Generator

InstaTube Generator is a Node.js application designed to simplify the process of creating Instagram Reels by merging audio and video tracks from YouTube links. This API-based tool offers a seamless solution for generating engaging content by combining audio from one YouTube video with video from another.

## Usage

To use InstaTube Generator, make an API call to the following endpoint: [https://instatube-generator.loca.lt](https://montreal-apparent-arrived-chan.trycloudflare.com/)/merge


The payload should include the URLs of the audio and video to merge, structured as follows:

```json
{
  "audioUrl": "YouTube_audio_link",
  "videoUrl": "YouTube_video_link"
}


Ensure both audioUrl and videoUrl are valid YouTube links.
