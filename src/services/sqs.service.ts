import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createHash } from "crypto";
import { ProcessingJobStatusUpdate } from "../types";

const sqs = new SQSClient({});

const generateDeduplicationId = (videoId: string, status: string): string => {
  return createHash("sha256")
    .update(`${videoId}-${status}-${Date.now()}`)
    .digest("hex");
};

export async function publishStatusUpdate(
  statusUpdateParams: ProcessingJobStatusUpdate
): Promise<void> {
  const { status, videoId } = statusUpdateParams;
  const messageBody = JSON.stringify({ videoId, status });

  const deduplicationId = generateDeduplicationId(videoId, status);

  const command = new SendMessageCommand({
    QueueUrl: process.env.UPDATE_PROCESSING_STATUS_QUEUE_URL,
    MessageBody: messageBody,
    MessageGroupId: videoId,
    MessageDeduplicationId: deduplicationId,
  });

  try {
    await sqs.send(command);
    console.log(`Status update published: ${status} for video ${videoId}`);
  } catch (error) {
    console.error(
      `Failed to publish status update for video ${videoId}:`,
      error
    );
    throw error;
  }
}
