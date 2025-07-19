const express = require("express");
const ytdl = require("@distube/ytdl-core");
const fs = require("fs-extra");
const uuid = require("uuid");
const { exec } = require("child_process");

const app = express();

app.use(express.json());

app.post("/merge", (req, res) => {
  let {
    audio: { url: audioUrl, from: audiostart, to: audioend },
    video: { url: videoUrl, from: videostart, to: videoend },
    format,
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
            return res
              .status(400)
              .json({ error: "start should be small then end" });

          // Determine the shorter duration
          const shorterDuration = Math.min(
            audioend - audiostart,
            videoend - videostart
          );

          if (shorterDuration >= 600 * 3) {
            fs.removeSync(id);
            return res.status(400).json({
              error: "The generated video must be no longer than 3 minutes.",
            });
          }

          // Determine ffmpeg scaling and padding based on format
          let scalePad;
          if (format === "paysage") {
            scalePad =
              "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1,setsar=1";
          } else {
            // Default to portrait
            scalePad =
              "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:-1:-1,setsar=1";
          }

          // Trim longer file to match shorter duration and adapt to Instagram Reels specs
          const ffmpegCommand = `ffmpeg -ss ${convertSecondsToHMS(
            audiostart
          )} -i ${tempAudioFile} -ss ${convertSecondsToHMS(
            videostart
          )} -i ${tempVideoFile} -t ${shorterDuration} -vf "${scalePad}" -c:v libx264 -b:v 1M -c:a aac -strict experimental -preset veryfast ${outputFilePath} `;

          // Merge audio and video using ffmpeg
          exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error: ${error.message}`);
              return;
            }
            console.log(`Video with merged audio saved to: ${outputFilePath}`);

            // Instead of sending the file, return a download link
            const uuidOnly = id.replace("./", "");
            res.json({
              url: `/download/${uuidOnly}`,
              message: "This download link will expire in 2 hours.",
            });
            // Delete only the audio and video files, keep the output file
            try {
              if (fs.existsSync(tempAudioFile)) fs.removeSync(tempAudioFile);
              if (fs.existsSync(tempVideoFile)) fs.removeSync(tempVideoFile);
            } catch (e) {
              console.error("Error deleting temp files:", e);
            }
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

app.get("/download/:uuid", (req, res) => {
  const uuid = req.params.uuid;
  const outputFilePath = `./${uuid}/output.mp4`;
  if (!fs.existsSync(outputFilePath)) {
    return res.status(404).json({ error: "File is expired" });
  }
  res.download(outputFilePath, `output-${uuid}.mp4`, (err) => {
    if (err) {
      console.error(`Error sending file: ${err.message}`);
    } else {
      console.log(`File ${outputFilePath} sent successfully.`);
    }
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

const port = 3000;

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
