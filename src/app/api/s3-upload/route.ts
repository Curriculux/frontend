import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  console.log('S3 Upload API called');
  
  try {
    console.log('Parsing form data...');
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const key = formData.get('key') as string;
    const bucketName = formData.get('bucket') as string;
    const contentType = formData.get('contentType') as string;
    const classId = formData.get('classId') as string;
    const meetingId = formData.get('meetingId') as string;
    const metadata = formData.get('metadata') as string;

    console.log('Form data parsed:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      key,
      bucketName,
      contentType,
      classId,
      meetingId,
      hasMetadata: !!metadata,
    });

    if (!file || !key || !bucketName) {
      return NextResponse.json(
        { error: 'Missing required fields: file, key, or bucket' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    console.log('Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    console.log('Buffer created, size:', buffer.length);

    // Parse metadata
    let parsedMetadata = {};
    try {
      parsedMetadata = JSON.parse(metadata || '{}');
      console.log('Metadata parsed:', parsedMetadata);
    } catch (e) {
      console.warn('Failed to parse metadata:', e);
    }

    // Upload to S3
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType || file.type,
      Metadata: {
        classId: classId || '',
        meetingId: meetingId || '',
        ...Object.fromEntries(
          Object.entries(parsedMetadata).map(([k, v]) => [k, String(v)])
        ),
        uploadedAt: new Date().toISOString(),
      },
      ACL: 'private' as const,
    };

    console.log('Server-side S3 upload to region:', process.env.NEXT_PUBLIC_AWS_REGION);
    console.log('Upload params:', {
      bucket: bucketName,
      key,
      size: buffer.length,
      type: contentType,
    });

    const command = new PutObjectCommand(uploadParams);
    const result = await s3Client.send(command);

    console.log('S3 upload successful:', result);

    const url = `https://${bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      url,
      key,
      size: file.size,
      etag: result.ETag,
    });

  } catch (error) {
    console.error('Server-side S3 upload error:', error);
    return NextResponse.json(
      { 
        error: 'Upload failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 