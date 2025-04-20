import { SQSHandler, S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import archiver from "archiver";
import { createWriteStream, createReadStream } from "fs";
import { tmpdir } from "os";

const s3 = new S3Client({});

export const processVideo: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const { Records: S3EventRecords } = JSON.parse(record.body) as S3Event;
    for (const s3EventRecord of S3EventRecords) {
      const {
        s3: { bucket, object },
      } = s3EventRecord;
      const baseName = path.basename(object.key, path.extname(object.key));
      const videoPath = path.join(tmpdir(), `${baseName}.mp4`);
      const framesPattern = path.join(tmpdir(), `${baseName}-%04d.jpg`);
      const zipPath = path.join(tmpdir(), `${baseName}.zip`);

      const get = await s3.send(
        new GetObjectCommand({ Bucket: bucket.name, Key: object.key })
      );
      await new Promise<void>((res, rej) => {
        const ws = createWriteStream(videoPath);
        (get.Body as NodeJS.ReadableStream)
          .pipe(ws)
          .on("finish", () => res())
          .on("error", (e) => rej(e));
      });

      await new Promise<void>((res, rej) => {
        const ff = spawn("/opt/ffmpeg/bin", [
          "-i",
          videoPath,
          "-vf",
          "fps=1",
          framesPattern,
        ]);
        ff.on("close", (code) =>
          code === 0 ? res() : rej(new Error(`FFmpeg exited with ${code}`))
        );
      });

      await new Promise<void>((res, rej) => {
        const output = createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        output.on("close", () => res());
        archive.on("error", (err) => rej(err));
        archive.pipe(output);
        archive.glob(`${baseName}-*.jpg`, { cwd: tmpdir() });
        archive.finalize();
      });

      const zipStream = createReadStream(zipPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: "hackathon-g41-video-bucket",
          Key: `frames/${baseName}.zip`,
          Body: zipStream,
        })
      );

      await fs.rm(videoPath, { force: true });
      const tmpFiles = await fs.readdir(tmpdir());
      await Promise.all(
        tmpFiles
          .filter((f) => f.startsWith(baseName))
          .map((f) => fs.rm(path.join(tmpdir(), f), { force: true }))
      );
    }
  }
};
