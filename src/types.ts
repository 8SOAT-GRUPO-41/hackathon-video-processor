export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type ProcessingJobStatusUpdate = {
  status: JobStatus;
  videoId: string;
};
