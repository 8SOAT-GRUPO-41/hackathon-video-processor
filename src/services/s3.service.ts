import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream } from "fs";

const s3 = new S3Client({});

export const OUTPUT_BUCKET = "hackathon-g41-video-bucket";
export const FRAMES_PREFIX = "frames";

export async function downloadFromS3(
  bucketName: string,
  objectKey: string,
  localPath: string
): Promise<void> {
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  const response = await s3.send(getCommand);

  return new Promise<void>((resolve, reject) => {
    const writeStream = createWriteStream(localPath);
    (response.Body as NodeJS.ReadableStream)
      .pipe(writeStream)
      .on("finish", () => resolve())
      .on("error", (error) => reject(error));
  });
}

export async function uploadToS3(
  localPath: string,
  s3Key: string
): Promise<void> {
  const fileStream = createReadStream(localPath);

  const putCommand = new PutObjectCommand({
    Bucket: OUTPUT_BUCKET,
    Key: s3Key,
    Body: fileStream,
  });

  await s3.send(putCommand);
}
