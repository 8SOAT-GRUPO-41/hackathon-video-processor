import { S3Event, SQSHandler } from "aws-lambda";
import { publishStatusUpdate } from "./services/sqs.service";
import { processVideoRecord } from "./services/video.service";

const MAX_RETRIES = 5;

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const { Records: S3EventRecords } = JSON.parse(record.body) as S3Event;

      const retryCount =
        parseInt(record.attributes.ApproximateReceiveCount || "1") - 1;

      for (const s3EventRecord of S3EventRecords) {
        try {
          await processVideoRecord(s3EventRecord, retryCount >= MAX_RETRIES);
        } catch (error) {
          console.error("Error processing S3 record:", error);
          if (retryCount >= MAX_RETRIES) {
            throw error;
          }
          console.log(
            `Retry ${retryCount + 1}/${MAX_RETRIES} for this message`
          );
        }
      }
    } catch (error) {
      console.error("Error processing SQS record:", error);
      throw error;
    }
  }
};

export { publishStatusUpdate };
