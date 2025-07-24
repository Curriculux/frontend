# S3 Storage Setup for Curriculux

This guide will help you set up Amazon S3 storage for meeting recordings and whiteboards.

## Why Use S3?

- **Better Performance**: Large files don't slow down Plone
- **Scalability**: S3 handles massive files and traffic
- **Cost Effective**: Pay only for what you store and transfer
- **Global Access**: Can add CloudFront CDN for worldwide delivery
- **Security**: Private buckets with presigned URLs for secure access

## Prerequisites

1. AWS Account
2. AWS CLI installed (optional but recommended)

## Step 1: Create S3 Bucket

### Option A: Using AWS Console
1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click "Create bucket"
3. Bucket name: `curriculux-media` (or your preferred name)
4. Region: Choose closest to your users (e.g., `us-east-1`)
5. **Block all public access**: ✅ (Keep this checked for security)
6. **Bucket versioning**: Enable (recommended)
7. **Default encryption**: Enable with SSE-S3
8. Click "Create bucket"

### Option B: Using AWS CLI
```bash
aws s3 mb s3://curriculux-media --region us-east-1
aws s3api put-bucket-versioning --bucket curriculux-media --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket curriculux-media --server-side-encryption-configuration '{
  "Rules": [
    {
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }
  ]
}'
```

## Step 2: Create IAM User and Policy

### Create IAM Policy
1. Go to [IAM Policies](https://console.aws.amazon.com/iam/home#/policies)
2. Click "Create policy"
3. Choose "JSON" tab and paste:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::curriculux-media/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::curriculux-media"
        }
    ]
}
```

4. Name it `CurriculuxS3Policy`
5. Click "Create policy"

### Create IAM User
1. Go to [IAM Users](https://console.aws.amazon.com/iam/home#/users)
2. Click "Create user"
3. Username: `curriculux-s3-user`
4. Select "Attach policies directly"
5. Search and select `CurriculuxS3Policy`
6. Click "Create user"

### Get Access Keys
1. Click on the created user
2. Go to "Security credentials" tab
3. Click "Create access key"
4. Select "Application running outside AWS"
5. Click "Create access key"
6. **Save the Access Key ID and Secret Access Key** (you won't see them again!)

## Step 3: Configure Environment Variables

Update your `frontend/.env.local` file:

```bash
# AWS S3 Configuration for media storage
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_S3_BUCKET_NAME=curriculux-media
NEXT_PUBLIC_AWS_ACCESS_KEY_ID=your_access_key_here
NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

**⚠️ Security Note**: In production, use IAM roles or AWS Secrets Manager instead of hardcoded keys.

## Step 4: Test Configuration

1. Restart your Next.js development server:
```bash
npm run dev
```

2. Try uploading a meeting recording or creating a whiteboard
3. Check the browser console for S3 upload logs
4. Verify files appear in your S3 bucket

## Step 5: Production Considerations

### CORS Configuration
If you experience CORS issues, add this CORS policy to your S3 bucket:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["https://your-domain.com"],
        "ExposeHeaders": ["ETag"]
    }
]
```

### CloudFront CDN (Optional)
For better global performance:

1. Create CloudFront distribution
2. Set origin to your S3 bucket
3. Enable caching for static assets
4. Update URLs in your app to use CloudFront domain

### Security Best Practices

1. **Use IAM Roles** in production instead of access keys
2. **Enable S3 bucket logging** for audit trails
3. **Set up S3 lifecycle policies** to archive old recordings
4. **Use presigned URLs** for secure file access (already implemented)
5. **Monitor costs** with AWS Cost Explorer

## File Organization

The system automatically organizes files as:

```
curriculux-media/
├── recordings/
│   └── {classId}/
│       └── {meetingId}/
│           └── recording-{timestamp}.webm
└── whiteboards/
    └── {classId}/
        └── whiteboard-{timestamp}.png
```

## Fallback Behavior

If S3 is not configured, the system automatically falls back to storing files in Plone (the original behavior).

## Troubleshooting

### Common Issues

1. **"Access Denied" errors**: Check IAM policy and bucket permissions
2. **CORS errors**: Add CORS policy to S3 bucket
3. **Large file timeouts**: Increase timeout settings in your load balancer
4. **High costs**: Set up S3 lifecycle policies to move old files to cheaper storage

### Debug Mode

Add this to see detailed S3 logs:
```javascript
// In browser console
localStorage.setItem('debug', 's3:*');
```

## Cost Optimization

1. **Lifecycle Policies**: Move recordings older than 90 days to Glacier
2. **Compression**: Consider compressing recordings before upload
3. **Resolution Settings**: Allow users to choose recording quality
4. **Cleanup**: Automatically delete recordings after a certain period

Example lifecycle policy:
```json
{
    "Rules": [
        {
            "ID": "ArchiveOldRecordings",
            "Status": "Enabled",
            "Filter": {"Prefix": "recordings/"},
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                }
            ]
        }
    ]
}
``` 