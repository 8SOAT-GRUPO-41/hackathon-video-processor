# Hackathon Video Processor

A serverless application for processing video files into frames. This project is part of the FIAP Hackathon for Group 41.

## Overview

This application takes videos uploaded to an S3 bucket, processes them using FFmpeg to extract frames (1 frame per second), packages the frames into a ZIP file, and uploads the result to a destination S3 bucket.

## Architecture

- **AWS Lambda**: Executes the video processing function
- **AWS SQS**: Triggers the Lambda function when new videos are uploaded
- **AWS S3**: Stores the original videos and processed frame archives
- **FFmpeg**: Used for video processing (included as a Lambda layer)

## Technologies

- Node.js 20.x
- TypeScript
- Serverless Framework
- AWS SDK
- FFmpeg
- Archiver

## Project Structure

```
.
├── src/                 # Source code
│   └── handler.ts       # Lambda function handler
├── ffmpeg/              # FFmpeg binaries for Lambda layer
├── serverless.yml       # Serverless configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 20.x
- Yarn or npm
- AWS CLI configured with appropriate permissions
- Serverless Framework

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/8SOAT-GRUPO-41/hackathon-video-processor.git
   cd hackathon-video-processor
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Configure the required environment parameters in your AWS account.

### Local Development

Start the serverless offline environment:
```bash
yarn dev
```

### Deployment

This project is configured for deployment using the Serverless Framework:

```bash
serverless deploy --param="VIDEO_PROCESSOR_SQS_ARN=<your-sqs-arn>" --param="LAB_ROLE_ARN=<your-role-arn>"
```

## Function Workflow

1. An S3 event is generated when a video is uploaded to the source bucket
2. The event is published to SQS
3. The Lambda function is triggered by the SQS message
4. The function:
   - Downloads the video from S3
   - Extracts frames using FFmpeg (1 frame per second)
   - Creates a ZIP archive containing all frames
   - Uploads the ZIP to the destination S3 bucket
   - Cleans up temporary files

## License

ISC License

## Repository

https://github.com/8SOAT-GRUPO-41/hackathon-video-processor
