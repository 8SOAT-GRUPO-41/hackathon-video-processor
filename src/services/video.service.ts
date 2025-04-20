import archiver from "archiver";
import { spawn } from "child_process";
import { createWriteStream } from "fs";
import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import { downloadFromS3, FRAMES_PREFIX, uploadToS3 } from "./s3.service";
import { publishStatusUpdate } from "./sqs.service";

export async function processVideoRecord(s3EventRecord: any): Promise<void> {
  const {
    s3: { bucket, object },
  } = s3EventRecord;
  const videoId = path.basename(object.key, path.extname(object.key));

  try {
    await publishStatusUpdate({
      status: "QUEUED",
      videoId,
    });

    await publishStatusUpdate({
      status: "RUNNING",
      videoId,
    });

    await extractAndUploadFrames(bucket.name, object.key, videoId);

    await publishStatusUpdate({
      status: "COMPLETED",
      videoId,
    });
  } catch (error) {
    console.error(`Error processing video ${videoId}:`, error);

    await publishStatusUpdate({
      status: "FAILED",
      videoId,
      errorMessage: error instanceof Error ? error.message : undefined,
    });

    throw error;
  }
}

async function extractAndUploadFrames(
  bucketName: string,
  objectKey: string,
  videoId: string
): Promise<void> {
  const videoPath = path.join(tmpdir(), `${videoId}.mp4`);
  const framesPattern = path.join(tmpdir(), `${videoId}-%04d.jpg`);
  const zipPath = path.join(tmpdir(), `${videoId}.zip`);

  try {
    await downloadFromS3(bucketName, objectKey, videoPath);

    await extractFrames(videoPath, framesPattern);

    await createFramesArchive(videoId, zipPath);

    await uploadToS3(zipPath, `${FRAMES_PREFIX}/${videoId}.zip`);
  } finally {
    await cleanupTempFiles(videoId, videoPath);
  }
}

async function extractFrames(
  videoPath: string,
  framesPattern: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("/opt/ffmpeg/bin", [
      "-i",
      videoPath,
      "-vf",
      "fps=1",
      framesPattern,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.log(`FFmpeg: ${data}`);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (error) => reject(error));
  });
}

async function createFramesArchive(
  videoId: string,
  zipPath: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", (error) => reject(error));

    archive.on("error", (error) => reject(error));
    archive.on("warning", (warning) => console.warn(warning));

    archive.pipe(output);
    archive.glob(`${videoId}-*.jpg`, { cwd: tmpdir() });
    archive.finalize();
  });
}

async function cleanupTempFiles(
  videoId: string,
  videoPath: string
): Promise<void> {
  try {
    await fs.rm(videoPath, { force: true });

    const tmpFiles = await fs.readdir(tmpdir());
    await Promise.all(
      tmpFiles
        .filter((file) => file.startsWith(videoId))
        .map((file) => fs.rm(path.join(tmpdir(), file), { force: true }))
    );
  } catch (error) {
    console.warn("Error cleaning up temporary files:", error);
  }
}
