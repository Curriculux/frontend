import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
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
    className: string,
    assignmentName: string,
    studentUsername: string,
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
        const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Clean up names for safe S3 paths
        const safeClassName = className.replace(/[^a-zA-Z0-9._-]/g, '_');
        const safeAssignmentName = assignmentName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const safeStudentUsername = studentUsername.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Use the new path structure: submissions/(class name)/(assignment name)/(student username)/filename
        const key = `submissions/${safeClassName}/${safeAssignmentName}/${safeStudentUsername}/${safeFilename}`;

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
            className,
            assignmentName,
            studentUsername,
            originalFilename: file.name,
            fileSize: file.size.toString(),
            uploadedAt: new Date().toISOString(),
          },
          // Make submissions private by default
          ACL: 'private' as const,
        };

        console.log(`Uploading submission file to S3: ${file.name} (${file.size} bytes) to ${key}`);
        
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

        console.log(`Successfully uploaded: ${file.name} to ${key}`);
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
      console.log(`Generating presigned URL for key: ${key}, expires in: ${expiresInSeconds}s`)
      
      // Validate that the key exists and is accessible
      // First check if the object exists
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });
        
        const headResult = await this.s3Client.send(headCommand);
        console.log('Object exists and is accessible:', {
          key,
          lastModified: headResult.LastModified,
          contentLength: headResult.ContentLength,
          contentType: headResult.ContentType
        });
      } catch (headError: any) {
        console.error('Object not found or not accessible:', headError);
        if (headError.name === 'NotFound') {
          throw new Error(`File not found: ${key}`);
        } else if (headError.name === 'Forbidden') {
          throw new Error(`Access denied to file: ${key}`);
        } else {
          throw new Error(`Unable to verify file access: ${headError.message}`);
        }
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      console.log('Successfully generated presigned URL');
      return presignedUrl;
    } catch (error: any) {
      console.error('Error generating presigned URL:', error);
      
      // Provide more specific error messages
      if (error.name === 'AccessDenied') {
        throw new Error('You do not have permission to access this file');
      } else if (error.name === 'NoSuchKey') {
        throw new Error('The requested file does not exist');
      } else if (error.name === 'NoSuchBucket') {
        throw new Error('File storage configuration error');
      } else if (error.message?.includes('credentials')) {
        throw new Error('File storage authentication error');
      } else {
        throw new Error(`Failed to generate access URL: ${error.message || 'Unknown error'}`);
      }
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
   * List submission files for a specific submission
   */
  async listSubmissionFiles(
    className: string,
    assignmentName: string,
    studentUsername: string
  ): Promise<Array<{
    url: string;
    key: string;
    size: number;
    filename: string;
    contentType: string;
    lastModified: Date;
  }>> {
    try {
      // Clean up names for safe S3 paths
      const safeClassName = className.replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeAssignmentName = assignmentName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeStudentUsername = studentUsername.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      const prefix = `submissions/${safeClassName}/${safeAssignmentName}/${safeStudentUsername}/`;
      console.log(`Listing S3 objects with prefix: ${prefix}`);

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: 100, // Reasonable limit for submission files
      });

      const response = await this.s3Client.send(command);
      const files = [];

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Size !== undefined) {
            // Extract filename from key (remove the path prefix)
            const keyParts = object.Key.split('/');
            const filename = keyParts[keyParts.length - 1];

            // Get object metadata to determine content type
            try {
              const headCommand = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: object.Key,
              });
              const headResponse = await this.s3Client.send(headCommand);

              const url = `https://${this.bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${object.Key}`;

              files.push({
                url,
                key: object.Key,
                size: object.Size,
                filename: headResponse.Metadata?.originalFilename || filename,
                contentType: headResponse.ContentType || 'application/octet-stream',
                lastModified: object.LastModified || new Date(),
              });
            } catch (headError) {
              console.warn(`Failed to get metadata for ${object.Key}:`, headError);
              // Still include the file but with basic info
              files.push({
                url: `https://${this.bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${object.Key}`,
                key: object.Key,
                size: object.Size,
                filename,
                contentType: 'application/octet-stream',
                lastModified: object.LastModified || new Date(),
              });
            }
          }
        }
      }

      console.log(`Found ${files.length} files for submission ${studentUsername}/${assignmentName}`);
      return files;
    } catch (error) {
      console.error('Error listing submission files from S3:', error);
      return [];
    }
  }

  /**
   * List all students who have submitted to a specific assignment
   */
  async listSubmissionStudents(
    className: string,
    assignmentName: string
  ): Promise<string[]> {
    try {
      // Clean up names for safe S3 paths
      const safeClassName = className.replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeAssignmentName = assignmentName.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      const prefix = `submissions/${safeClassName}/${safeAssignmentName}/`;
      console.log(`Listing student submissions with prefix: ${prefix}`);

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        Delimiter: '/', // This will give us the "folders" (student usernames)
        MaxKeys: 1000,
      });

      const response = await this.s3Client.send(command);
      const students = [];

      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          if (prefix.Prefix) {
            // Extract student username from prefix
            const pathParts = prefix.Prefix.split('/');
            const studentUsername = pathParts[pathParts.length - 2]; // -2 because last part is empty due to trailing /
            if (studentUsername) {
              students.push(studentUsername);
            }
          }
        }
      }

      console.log(`Found submissions from ${students.length} students for ${assignmentName}`);
      return students;
    } catch (error) {
      console.error('Error listing submission students from S3:', error);
      return [];
    }
  }

  /**
   * List all submissions for a specific assignment across all students
   */
  async listAssignmentSubmissions(
    className: string,
    assignmentName: string
  ): Promise<Array<{
    studentUsername: string;
    files: Array<{
      url: string;
      key: string;
      size: number;
      filename: string;
      contentType: string;
      lastModified: Date;
    }>;
  }>> {
    try {
      const students = await this.listSubmissionStudents(className, assignmentName);
      const submissions = [];

      for (const studentUsername of students) {
        const files = await this.listSubmissionFiles(className, assignmentName, studentUsername);
        if (files.length > 0) {
          submissions.push({
            studentUsername,
            files
          });
        }
      }

      console.log(`Found ${submissions.length} submissions for assignment ${assignmentName}`);
      return submissions;
    } catch (error) {
      console.error('Error listing assignment submissions from S3:', error);
      return [];
    }
  }

  /**
   * List all submissions for a specific class across all assignments and students
   */
  async listClassSubmissions(
    className: string
  ): Promise<Array<{
    assignmentName: string;
    studentUsername: string;
    files: Array<{
      url: string;
      key: string;
      size: number;
      filename: string;
      contentType: string;
      lastModified: Date;
    }>;
  }>> {
    try {
      // Clean up names for safe S3 paths
      const safeClassName = className.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      const prefix = `submissions/${safeClassName}/`;
      console.log(`Listing all class submissions with prefix: ${prefix}`);

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: 10000, // Larger limit for class-wide search
      });

      const response = await this.s3Client.send(command);
      const submissions = [];

      if (response.Contents) {
        // Group files by assignment and student
        const submissionMap: { [key: string]: any } = {};

        for (const object of response.Contents) {
          if (object.Key && object.Size !== undefined) {
            const keyParts = object.Key.split('/');
            if (keyParts.length >= 5) { // submissions/className/assignmentName/studentUsername/filename
              const assignmentName = keyParts[2];
              const studentUsername = keyParts[3];
              const filename = keyParts[4];
              
              const submissionKey = `${assignmentName}/${studentUsername}`;
              
              if (!submissionMap[submissionKey]) {
                submissionMap[submissionKey] = {
                  assignmentName,
                  studentUsername,
                  files: []
                };
              }

              // Get object metadata if possible
              try {
                const headCommand = new HeadObjectCommand({
                  Bucket: this.bucketName,
                  Key: object.Key,
                });
                const headResponse = await this.s3Client.send(headCommand);

                submissionMap[submissionKey].files.push({
                  url: `https://${this.bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${object.Key}`,
                  key: object.Key,
                  size: object.Size,
                  filename: headResponse.Metadata?.originalFilename || filename,
                  contentType: headResponse.ContentType || 'application/octet-stream',
                  lastModified: object.LastModified || new Date(),
                });
              } catch (headError) {
                console.warn(`Failed to get metadata for ${object.Key}:`, headError);
                submissionMap[submissionKey].files.push({
                  url: `https://${this.bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${object.Key}`,
                  key: object.Key,
                  size: object.Size,
                  filename,
                  contentType: 'application/octet-stream',
                  lastModified: object.LastModified || new Date(),
                });
              }
            }
          }
        }

        submissions.push(...Object.values(submissionMap));
      }

      console.log(`Found ${submissions.length} submissions for class ${className}`);
      return submissions;
    } catch (error) {
      console.error('Error listing class submissions from S3:', error);
      return [];
    }
  }

  /**
   * Upload gradebook data to S3 (settings, enhanced grades, rubrics)
   */
  async uploadGradebookData(classId: string, dataType: 'settings' | 'grades' | 'rubrics', data: any, fileName?: string): Promise<{
    key: string;
    url: string;
    size: number;
  }> {
    try {
      // Clean up class ID for safe S3 paths
      const safeClassId = classId.replace(/[^a-zA-Z0-9-]/g, '-');
      
      // Generate key based on data type
      let key: string;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      switch (dataType) {
        case 'settings':
          key = `gradebook/${safeClassId}/settings.json`;
          break;
        case 'grades':
          key = `gradebook/${safeClassId}/grades/${fileName || `grades-${timestamp}.json`}`;
          break;
        case 'rubrics':
          key = `gradebook/${safeClassId}/rubrics/${fileName || `rubric-${timestamp}.json`}`;
          break;
        default:
          throw new Error(`Unknown gradebook data type: ${dataType}`);
      }

      const jsonData = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonData, 'utf-8');

      console.log(`Uploading gradebook ${dataType} to S3: ${key} (${buffer.length} bytes)`);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/json',
        ContentDisposition: `attachment; filename="${fileName || `gradebook-${dataType}.json`}"`,
        Metadata: {
          classId: classId,
          dataType: dataType,
          uploadedAt: new Date().toISOString(),
          originalFilename: fileName || `gradebook-${dataType}.json`
        }
      });

      const result = await this.s3Client.send(command);
      console.log('Gradebook data upload result:', result);

      const url = `https://${this.bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      return {
        key,
        url,
        size: buffer.length
      };
    } catch (error) {
      console.error(`Error uploading gradebook ${dataType} to S3:`, error);
      throw error;
    }
  }

  /**
   * Download gradebook data from S3
   */
  async downloadGradebookData(classId: string, dataType: 'settings' | 'grades' | 'rubrics', fileName?: string): Promise<any> {
    try {
      // Clean up class ID for safe S3 paths
      const safeClassId = classId.replace(/[^a-zA-Z0-9-]/g, '-');
      
      let key: string;
      switch (dataType) {
        case 'settings':
          key = `gradebook/${safeClassId}/settings.json`;
          break;
        case 'grades':
          key = `gradebook/${safeClassId}/grades/${fileName}`;
          break;
        case 'rubrics':
          key = `gradebook/${safeClassId}/rubrics/${fileName}`;
          break;
        default:
          throw new Error(`Unknown gradebook data type: ${dataType}`);
      }

      console.log(`Downloading gradebook ${dataType} from S3: ${key}`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No data received from S3');
      }

      // Convert stream to string
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      const jsonString = new TextDecoder().decode(buffer);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error(`Error downloading gradebook ${dataType} from S3:`, error);
      throw error;
    }
  }

  /**
   * List gradebook files for a class
   */
  async listGradebookFiles(classId: string, dataType?: 'settings' | 'grades' | 'rubrics'): Promise<Array<{
    key: string;
    size: number;
    lastModified: Date;
    fileName: string;
    dataType: string;
  }>> {
    try {
      // Clean up class ID for safe S3 paths
      const safeClassId = classId.replace(/[^a-zA-Z0-9-]/g, '-');
      
      let prefix = `gradebook/${safeClassId}/`;
      if (dataType) {
        prefix += `${dataType}/`;
      }

      console.log(`Listing gradebook files with prefix: ${prefix}`);

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      const files = [];
      for (const object of response.Contents) {
        if (!object.Key || !object.Size || !object.LastModified) continue;

        // Extract data type from path
        const pathParts = object.Key.split('/');
        const fileDataType = pathParts[2] || 'unknown';
        const fileName = pathParts[pathParts.length - 1];

        files.push({
          key: object.Key,
          size: object.Size,
          lastModified: object.LastModified,
          fileName,
          dataType: fileDataType
        });
      }

      return files;
    } catch (error) {
      console.error('Error listing gradebook files from S3:', error);
      return [];
    }
  }

  /**
   * Delete gradebook data from S3
   */
  async deleteGradebookData(key: string): Promise<void> {
    try {
      console.log(`Deleting gradebook data from S3: ${key}`);

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
      console.log(`Successfully deleted gradebook data: ${key}`);
    } catch (error) {
      console.error('Error deleting gradebook data from S3:', error);
      throw error;
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