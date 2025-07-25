import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';

class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME || 'curriculux-media';
    
    // Debug: Log configuration (remove in production)
    console.log('S3 Configuration:', {
      bucketName: this.bucketName,
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
      hasAccessKey: !!(process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID),
      hasSecretKey: !!(process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY),
      accessKeyPreview: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID?.substring(0, 8) + '...',
    });
    
    this.s3Client = new S3Client({
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
      },
      // Use browser-compatible HTTP handler
      requestHandler: new FetchHttpHandler({
        requestTimeout: 300000, // 5 minutes for large uploads
      }),
      maxAttempts: 3,
    });
  }

  /**
   * Upload a recording file to S3
   */
  async uploadRecording(
    classId: string,
    meetingId: string,
    recordingBlob: Blob,
    metadata: {
      duration: number;
      startTime: string;
      endTime: string;
      participantCount: number;
    }
  ): Promise<{
    url: string;
    key: string;
    size: number;
  }> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const key = `recordings/${classId}/${meetingId}/recording-${timestamp}.webm`;

    try {
      // Convert Blob to ArrayBuffer for better browser compatibility
      const arrayBuffer = await recordingBlob.arrayBuffer();
      
      console.log('Uploading to S3:', {
        bucket: this.bucketName,
        key,
        size: recordingBlob.size,
        type: recordingBlob.type,
      });
      
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: recordingBlob.type || 'video/webm',
        Metadata: {
          classId,
          meetingId,
          duration: metadata.duration.toString(),
          startTime: metadata.startTime,
          endTime: metadata.endTime,
          participantCount: metadata.participantCount.toString(),
          uploadedAt: new Date().toISOString(),
        },
        // Make recordings private by default
        ACL: 'private' as const,
      };

      console.log('S3 Upload params (without body):', {
        ...uploadParams,
        Body: `[Uint8Array ${uploadParams.Body.length} bytes]`,
      });

      const command = new PutObjectCommand(uploadParams);
      console.log('Sending S3 command...');
      const result = await this.s3Client.send(command);
      console.log('S3 upload result:', result);

      const url = `https://${this.bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      return {
        url,
        key,
        size: recordingBlob.size,
      };
    } catch (error) {
      console.error('Error uploading recording to S3:', error);
      throw new Error(`Failed to upload recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a whiteboard image to S3
   */
  async uploadWhiteboard(
    classId: string,
    whiteboardData: {
      title: string;
      dataUrl: string;
      description?: string;
    }
  ): Promise<{
    url: string;
    key: string;
    size: number;
  }> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const key = `whiteboards/${classId}/whiteboard-${timestamp}.png`;

    try {
      // Convert data URL to blob, then to ArrayBuffer
      const response = await fetch(whiteboardData.dataUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: 'image/png',
        Metadata: {
          classId,
          title: whiteboardData.title,
          description: whiteboardData.description || '',
          uploadedAt: new Date().toISOString(),
        },
        // Make whiteboards accessible to class members
        ACL: 'private' as const,
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      return {
        url,
        key,
        size: blob.size,
      };
    } catch (error) {
      console.error('Error uploading whiteboard to S3:', error);
      throw new Error(`Failed to upload whiteboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload assignment submission files to S3
   */
  async uploadSubmissionFiles(
    classId: string,
    assignmentId: string,
    submissionId: string,
    files: File[]
  ): Promise<Array<{
    url: string;
    key: string;
    size: number;
    filename: string;
    contentType: string;
  }>> {
    const uploadedFiles = [];

    for (const file of files) {
      try {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `submissions/${classId}/${assignmentId}/${submissionId}/${timestamp}-${safeFilename}`;

        // Convert file to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        const uploadParams = {
          Bucket: this.bucketName,
          Key: key,
          Body: new Uint8Array(arrayBuffer),
          ContentType: file.type || 'application/octet-stream',
          Metadata: {
            classId,
            assignmentId,
            submissionId,
            originalFilename: file.name,
            fileSize: file.size.toString(),
            uploadedAt: new Date().toISOString(),
          },
          // Make submissions private by default
          ACL: 'private' as const,
        };

        console.log(`Uploading submission file to S3: ${file.name} (${file.size} bytes)`);
        
        const command = new PutObjectCommand(uploadParams);
        await this.s3Client.send(command);

        const url = `https://${this.bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

        uploadedFiles.push({
          url,
          key,
          size: file.size,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
        });

        console.log(`Successfully uploaded: ${file.name}`);
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        throw new Error(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return uploadedFiles;
  }

  /**
   * Generate a presigned URL for secure access to private files
   */
  async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      return presignedUrl;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error(`Failed to generate access URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test S3 connection and bucket access
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('Testing S3 connection...');
      
      // Try to list bucket contents (doesn't require any objects to exist)
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1, // Just need to test access, not get all objects
      });
      
      const result = await this.s3Client.send(command);
      console.log('S3 connection test successful:', result);
      
      return { 
        success: true, 
        details: {
          bucketName: this.bucketName,
          region: process.env.NEXT_PUBLIC_AWS_REGION,
          objectCount: result.KeyCount || 0,
        }
      };
    } catch (error: any) {
      console.error('S3 connection test failed:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        details: {
          bucketName: this.bucketName,
          region: process.env.NEXT_PUBLIC_AWS_REGION,
          errorCode: error.Code,
          errorName: error.name,
        }
      };
    }
  }

  /**
   * Get S3 configuration status
   */
  isConfigured(): boolean {
    return !!(
      process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID &&
      process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY &&
      process.env.NEXT_PUBLIC_S3_BUCKET_NAME
    );
  }
}

export const s3Service = new S3Service(); 