const express = require("express");
const ytdl = require("ytdl-core");
const fs = require("fs");
const localtunnel = require("localtunnel");
const { exec } = require("child_process");

const app = express();

app.use(express.json());

app.post("/merge", (req, res) => {
  const { audioUrl, videoUrl } = req.body;

  if (!audioUrl || !videoUrl) {
    return res
      .status(400)
      .json({ error: "Both audioUrl and videoUrl are required." });
  }

  const tempAudioFile = "temp_audio.mp3";
  const tempVideoFile = "temp_video.mp4";
  const outputFilePath = "output.mp4";

  // Download audio
  const audioStream = ytdl(audioUrl, { filter: "audioonly" });
  audioStream.pipe(fs.createWriteStream(tempAudioFile));

  // Download video
  const videoStream = ytdl(videoUrl, { filter: "videoandaudio" });
  videoStream.pipe(fs.createWriteStream(tempVideoFile));

  // Wait for both streams to finish downloading
  Promise.all([
    new Promise((resolve, reject) => {
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
    }),
    new Promise((resolve, reject) => {
      videoStream.on("end", resolve);
      videoStream.on("error", reject);
    }),
  ])
    .then(() => {
      // Get durations of audio and video
      const getDurationCommand = (file) =>
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${file}`;
      exec(getDurationCommand(tempAudioFile), (error, audioDuration) => {
        if (error) {
          console.error(`Error getting audio duration: ${error.message}`);
          return;
        }
        exec(getDurationCommand(tempVideoFile), (error, videoDuration) => {
          if (error) {
            console.error(`Error getting video duration: ${error.message}`);
            return;
          }

          // Determine the shorter duration
          const shorterDuration = Math.min(
            parseFloat(audioDuration),
            parseFloat(videoDuration)
          );

          // Adjust duration to fit Instagram Reels limit (e.g., 60 seconds)
          const reelsDuration = Math.min(shorterDuration, 60);

          // Trim longer file to match shorter duration and adapt to Instagram Reels specs
          const ffmpegCommand = `ffmpeg -i ${tempAudioFile} -i ${tempVideoFile} -t ${reelsDuration} -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1,setsar=1" -c:v libx264 -c:a aac -strict experimental ${outputFilePath}`;

          // Merge audio and video using ffmpeg
          exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error: ${error.message}`);
              return;
            }
            console.log(`Video with merged audio saved to: ${outputFilePath}`);

            // Clean up temporary files
            fs.unlinkSync(tempAudioFile);
            fs.unlinkSync(tempVideoFile);

            // Send the merged video as a response
            res.download(outputFilePath, (err) => {
              if (err) {
                console.error(`Error sending video: ${err.message}`);
              } else {
                console.log("Video sent successfully.");
                // Delete the output file after sending
                fs.unlinkSync(outputFilePath);
              }
            });
          });
        });
      });
    })
    .catch((error) => {
      console.error("Error downloading streams:", error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the request." });
    });
});

const port = process.env.prod ?? 3000;

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
  localtunnel({ port: parseInt(port), subdomain: "instatube-generator" });
});
