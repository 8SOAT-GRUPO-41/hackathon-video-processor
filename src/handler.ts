import { SQSHandler } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream, createReadStream } from 'fs';
import { tmpdir } from 'os';

const s3 = new S3Client({});

interface Payload { bucket: string; key: string; }

export const processVideo: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const { bucket, key } = JSON.parse(record.body) as Payload;
    const baseName = path.basename(key, path.extname(key));
    const videoPath = path.join(tmpdir(), `${baseName}.mp4`);
    const framesPattern = path.join(tmpdir(), `${baseName}-%04d.jpg`);
    const zipPath = path.join(tmpdir(), `${baseName}-frames.zip`);

    // 1. Download video
    const get = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    await new Promise<void>((res, rej) => {
      const ws = createWriteStream(videoPath);
      (get.Body as NodeJS.ReadableStream)
        .pipe(ws)
        .on('finish', () => res())
        .on('error', e => rej(e));
    });

    // 2. Extract frames via FFmpeg layer
    await new Promise<void>((res, rej) => {
      const ff = spawn('/opt/ffmpeg/bin/ffmpeg', [
        '-i', videoPath,
        '-vf', 'fps=1',      // e.g. one frame per second; remove to dump all frames
        framesPattern
      ]);
      ff.on('close', code => code === 0 ? res() : rej(new Error(`FFmpeg exited with ${code}`)));
    });

    // 3. Zip all frames
    await new Promise<void>((res, rej) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => res());
      archive.on('error', err => rej(err));
      archive.pipe(output);
      archive.glob(`${baseName}-*.jpg`, { cwd: tmpdir() });
      archive.finalize();
    });

    // 4. Upload zip back to S3
    const zipStream = createReadStream(zipPath);
    await s3.send(new PutObjectCommand({
      Bucket: process.env.DEST_BUCKET!,
      Key: `frames/${baseName}-frames.zip`,
      Body: zipStream
    }));

    // 5. Cleanup /tmp
    await fs.rm(videoPath, { force: true });
    const tmpFiles = await fs.readdir(tmpdir());
    await Promise.all(tmpFiles
      .filter(f => f.startsWith(baseName))
      .map(f => fs.rm(path.join(tmpdir(), f), { force: true })));
  }
};
