const express = require("express");
const ytdl = require("ytdl-core");
const localtunnel = require("localtunnel");
const { exec } = require("child_process");

const app = express();

app.use(express.json());

app.post("/merge", async (req, res) => {
  const { audioUrl, videoUrl, audioStart, videoStart, audioEnd, videoEnd } =
    req.body;

  if (!audioUrl || !videoUrl) {
    return res
      .status(400)
      .json({ error: "Both audioUrl and videoUrl are required." });
  }

  try {
    // Download audio and video streams
    const audioStream = ytdl(audioUrl, { filter: "audioonly" });
    const videoStream = ytdl(videoUrl, { filter: "videoandaudio" });

    // Wait for both streams to finish downloading
    const [audioInfo, videoInfo] = await Promise.all([
      ytdl.getInfo(audioUrl),
      ytdl.getInfo(videoUrl),
    ]);

    const audioDuration = parseFloat(audioInfo.videoDetails.lengthSeconds);
    const videoDuration = parseFloat(videoInfo.videoDetails.lengthSeconds);

    // Determine the shorter duration
    const shortestDuration = Math.min(audioDuration, videoDuration);

    // Calculate audio start and end times
    const audioStartSecond = audioStart || 0;
    const audioEndSecond = audioEnd
      ? Math.min(audioEnd, audioDuration)
      : audioDuration;
    const audioDurationToUse = audioEndSecond - audioStartSecond;

    // Calculate video start and end times
    const videoStartSecond = videoStart || 0;
    const videoEndSecond = videoEnd
      ? Math.min(videoEnd, videoDuration)
      : videoDuration;
    const videoDurationToUse = videoEndSecond - videoStartSecond;

    // Determine overall duration
    const overallDuration = Math.min(audioDurationToUse, videoDurationToUse);

    // FFmpeg command to merge audio and video
    const ffmpegCommand = `ffmpeg -ss ${audioStartSecond} -i pipe:0 -ss ${videoStartSecond} -i pipe:1 -t ${overallDuration} -vf "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:-1:-1,setsar=1" -c:v libx264 -b:v 1M -c:a aac -strict experimental -f mp4 pipe:2 -preset veryfast`;

    // Spawn FFmpeg process
    const ffmpegProcess = exec(
      ffmpegCommand,
      { stdio: ["pipe", "pipe", "pipe"] },
      (error) => {
        if (error) {
          console.error(`FFmpeg error: ${error.message}`);
          res
            .status(500)
            .json({ error: "An error occurred while processing the request." });
        }
      }
    );

    // Pipe streams to FFmpeg
    audioStream.pipe(ffmpegProcess.stdin);
    videoStream.pipe(ffmpegProcess.stdin);

    // Pipe FFmpeg output to response
    ffmpegProcess.stdout.pipe(res);
  } catch (error) {
    console.error("Error downloading streams:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request." });
  }
});

const port = process.env.PORT || 5501;

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
  localtunnel({ port: parseInt(port), subdomain: "instatube-generator" });
});
