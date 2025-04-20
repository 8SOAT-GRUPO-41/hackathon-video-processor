import { S3Event, SQSHandler } from "aws-lambda";
import { publishStatusUpdate } from "./services/sqs.service";
import { processVideoRecord } from "./services/video.service";

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const { Records: S3EventRecords } = JSON.parse(record.body) as S3Event;
      for (const s3EventRecord of S3EventRecords) {
        await processVideoRecord(s3EventRecord);
      }
    } catch (error) {
      console.error("Error processing SQS record:", error);
      throw error;
    }
  }
};

export { publishStatusUpdate };
