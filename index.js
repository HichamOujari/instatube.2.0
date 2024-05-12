const express = require("express");
const ytdl = require("ytdl-core");
const fs = require("fs-extra");
const uuid = require("uuid");
const localtunnel = require("localtunnel");
const { exec } = require("child_process");

const app = express();

app.use(express.json());

app.post("/merge", (req, res) => {
  let {
    audio: { url: audioUrl, from: audiostart, to: audioend },
    video: { url: videoUrl, from: videostart, to: videoend },
  } = req.body;

  console.log("=> urls : ", {
    audioUrl,
    videoUrl,
  });

  if (!audiostart) audiostart = 0;
  if (!videostart) videostart = 0;

  if (!audioUrl || !videoUrl) {
    return res
      .status(400)
      .json({ error: "Both audioUrl and videoUrl are required." });
  }

  const id = `./${uuid.v4()}`;
  fs.mkdirSync(id);
  const tempAudioFile = `${id}/temp_audio.mp3`;
  const tempVideoFile = `${id}/temp_video.mp4`;
  const outputFilePath = `${id}/output.mp4`;

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

          audioDuration = parseFloat(audioDuration);
          videoDuration = parseFloat(videoDuration);

          if (!audioend || (audioend && audioend > audioDuration))
            audioend = audioDuration;
          if (!videoend || (videoend && videoend > videoDuration))
            videoend = videoDuration;

          if (audiostart > audioend || videostart > videoend)
            res.status(400).json({ error: "start should be small then end" });

          // Determine the shorter duration
          const shorterDuration = Math.min(
            audioend - audiostart,
            videoend - videostart,
            60 * 10
          );

          // Trim longer file to match shorter duration and adapt to Instagram Reels specs
          const ffmpegCommand = `ffmpeg -ss ${convertSecondsToHMS(
            audiostart
          )} -i ${tempAudioFile} -ss ${convertSecondsToHMS(
            videostart
          )} -i ${tempVideoFile} -t ${shorterDuration} -vf "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:-1:-1,setsar=1" -c:v libx264 -b:v 250k -c:a aac -strict experimental -preset veryfast ${outputFilePath} `;

          // Merge audio and video using ffmpeg
          exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error: ${error.message}`);
              return;
            }
            console.log(`Video with merged audio saved to: ${outputFilePath}`);

            // Send the merged video as a response
            res.download(outputFilePath, (err) => {
              if (err) {
                console.error(`Error sending video: ${err.message}`);
              } else {
                console.log("Video sent successfully.");
                // Delete the output file after sending
                fs.removeSync(id);
              }
            });
          });
        });
      });
    })
    .catch((error) => {
      console.error("Error downloading streams:", error);
      fs.removeSync(id);
      res
        .status(500)
        .json({ error: "An error occurred while processing the request." });
    });
});

function convertSecondsToHMS(seconds) {
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds % 3600) / 60);
  var remainingSeconds = seconds % 60;

  // Add leading zeros if necessary
  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  remainingSeconds =
    remainingSeconds < 10 ? "0" + remainingSeconds : remainingSeconds;

  return hours + ":" + minutes + ":" + remainingSeconds;
}

const port = process.env.prod ?? 5501;

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
  localtunnel({ port: parseInt(port), subdomain: "instatube-generator" });
});
