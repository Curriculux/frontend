"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Play, 
  Download, 
  Clock, 
  Users, 
  Calendar, 
  Video, 
  FileVideo,
  Loader2,
  AlertCircle 
} from "lucide-react"
import { ploneAPI } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface Recording {
  id: string;
  title: string;
  '@id': string;
  '@type'?: string;
  created: string;
  modified: string;
  description?: string;
  downloadUrl: string;
  metadata?: {
    duration: number;
    startTime: string;
    endTime: string;
    participantCount: number;
    fileSize: number;
    mimeType: string;
    recordingDate: string;
  };
}

interface RecordingsViewerProps {
  meetingId: string;
  classId: string;
  meetingTitle?: string;
}

export function RecordingsViewer({ meetingId, classId, meetingTitle }: RecordingsViewerProps) {
  const { toast } = useToast()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [playbackOpen, setPlaybackOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    loadRecordings()
  }, [meetingId, classId])

  const loadRecordings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const recordingsList = await ploneAPI.getMeetingRecordings(meetingId, classId)
      
      // Parse metadata from description and format recordings
      const formattedRecordings: Recording[] = recordingsList.map((recording: any) => {
        let metadata = null
        
        try {
          if (recording.description) {
            metadata = JSON.parse(recording.description)
          }
        } catch (e) {
          console.warn('Could not parse recording metadata:', e)
        }

        return {
          id: recording.id,
          title: recording.title,
          '@id': recording['@id'],
          created: recording.created,
          modified: recording.modified,
          description: recording.description,
          downloadUrl: recording['@id'],
          metadata
        }
      })

      setRecordings(formattedRecordings)
    } catch (err) {
      console.error('Error loading recordings:', err)
      setError(err instanceof Error ? err.message : 'Failed to load recordings')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRecordingVideoUrl = async (recording: any): Promise<string> => {
    // Check if this is an S3-stored recording
    let metadata: any = {};
    try {
      metadata = JSON.parse(recording.description || '{}');
    } catch (e) {
      // Ignore parsing errors
    }

    if (metadata.storageType === 's3' && metadata.s3Key) {
      console.log('Getting presigned URL for S3 recording:', metadata.s3Key);
      try {
        // Get a presigned URL valid for 2 hours
        const presignedUrl = await ploneAPI.getSecureFileUrl(metadata.s3Key, 120);
        console.log('Got presigned URL for S3 recording');
        return presignedUrl;
      } catch (error) {
        console.error('Error getting presigned URL:', error);
        // Fall back to direct S3 URL if available
        if (metadata.s3Url) {
          console.log('Falling back to direct S3 URL');
          return metadata.s3Url;
        }
        throw error;
      }
    }

    // For Plone-stored recordings, return the download URL
    return recording.downloadUrl;
  }

  const handlePlayRecording = async (recording: any) => {
    try {
      setSelectedRecording(recording)
      setPlaybackOpen(true)
      
      setLoadingVideo(true)
      setVideoUrl(null)

      // Get the appropriate video URL (S3 presigned or Plone direct)
      const videoUrl = await getRecordingVideoUrl(recording);
      console.log('Using video URL:', videoUrl);

      // For S3 URLs, we can use them directly
      let metadata: any = {};
      try {
        metadata = JSON.parse(recording.description || '{}');
      } catch (e) {
        // Ignore parsing errors
      }

      if (metadata.storageType === 's3') {
        // S3 recordings can be used directly
        setVideoUrl(videoUrl);
        setLoadingVideo(false);
        return;
      }

      console.log('Attempting to fetch video from:', videoUrl)

      // Try different approaches to get the video file
      let response;
      let blob: Blob | null = null;
      
      // List of URLs to try in order
      const urlsToTry = [
        recording.downloadUrl,                                    // The generated download URL from API
        `${recording['@id']}/@@download/file`,                   // Standard Plone file download
        `${recording['@id']}/@@download`,                        // Alternative download endpoint  
        `${recording['@id']}/file/@@download`,                   // File field specific download
        recording['@id'],                                         // Direct content URL
        `${recording.downloadUrl}/@@download`,                   // Backup download endpoints
        `${recording.downloadUrl}/file`,                         // File field access
      ];
      
      console.log('Will try these URLs:', urlsToTry);
      
      for (const url of urlsToTry) {
        try {
          console.log(`Trying URL: ${url}`);
          response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${ploneAPI.getToken()}`,
            },
          });
          
          console.log(`Response for ${url}:`, {
            status: response.status,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
          });
          
          if (response.ok) {
            // Check if we got a video content type or binary data
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.startsWith('video/') || 
                contentType.includes('webm') || 
                contentType.includes('mp4') ||
                contentType === 'application/octet-stream') {
              console.log(`Found video content at: ${url}`);
              blob = await response.blob();
              break;
            } else if (contentType.includes('json')) {
              console.log(`Got JSON response from ${url}, trying next URL...`);
              // For debugging, let's see what JSON is being returned
              try {
                const jsonData = await response.json();
                console.log(`JSON response from ${url}:`, jsonData);
                
                // Check if the JSON contains file information
                if (jsonData.file) {
                  // Plone REST API returns file info with download URL
                  if (jsonData.file.download) {
                    console.log(`Found file download URL in JSON:`, jsonData.file.download);
                    // Try the download URL from the JSON response
                    const fileResponse = await fetch(jsonData.file.download, {
                      headers: {
                        'Authorization': `Bearer ${ploneAPI.getToken()}`,
                      },
                    });
                    if (fileResponse.ok) {
                      blob = await fileResponse.blob();
                      if (blob.size > 1000) {
                        console.log(`Successfully downloaded file from JSON URL:`, {
                          size: blob.size,
                          type: blob.type
                        });
                        break;
                      }
                    }
                  }
                  
                  // Also check for filename property which indicates a file field
                  if (jsonData.file.filename) {
                    // Try constructing download URL from current URL
                    const fileDownloadUrl = `${url}/@@download/file`;
                    console.log(`Trying constructed download URL:`, fileDownloadUrl);
                    const fileResponse = await fetch(fileDownloadUrl, {
                      headers: {
                        'Authorization': `Bearer ${ploneAPI.getToken()}`,
                      },
                    });
                    if (fileResponse.ok) {
                      const contentType = fileResponse.headers.get('content-type') || '';
                      if (!contentType.includes('json')) {
                        blob = await fileResponse.blob();
                        if (blob.size > 1000) {
                          console.log(`Successfully downloaded file from constructed URL:`, {
                            size: blob.size,
                            type: blob.type
                          });
                          break;
                        }
                      }
                    }
                  }
                }
              } catch (jsonError) {
                console.log(`Failed to parse JSON response from ${url}:`, jsonError);
              }
              continue;
            } else {
              // Unknown content type, let's try to get it anyway and check
              blob = await response.blob();
              if (blob.size > 1000) { // Assume files > 1KB might be video
                console.log(`Got potentially valid blob from ${url}:`, {
                  size: blob.size,
                  type: blob.type
                });
                break;
              }
            }
          }
        } catch (urlError) {
          console.log(`Failed to fetch from ${url}:`, urlError);
          continue;
        }
      }
      
      if (!blob) {
        throw new Error('Could not fetch video file from any URL');
      }

      console.log('Final blob info:', {
        size: blob.size,
        type: blob.type
      })

      // Check if the blob is actually a video
      if (!blob.type.startsWith('video/') && !blob.type.includes('webm') && !blob.type.includes('mp4')) {
        console.warn('Downloaded blob is not a video type:', blob.type)
        
        // Check if it's JSON/text content
        if (blob.size < 10000) { // Only read small files as text
          const textContent = await blob.slice(0, 500).text()
          console.log('Blob content preview:', textContent)
          
          // If it's JSON or HTML content, it's not a video file
          if (textContent.includes('{') || textContent.includes('<')) {
            throw new Error('Server returned metadata instead of video file. The recording may not have been uploaded correctly.');
          }
        }
      }
      
      // For debugging: check file signature for video files
      if (blob.size > 12) {
        const firstBytes = await blob.slice(0, 12).arrayBuffer()
        const bytes = new Uint8Array(firstBytes)
        const signature = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
        console.log('File signature (first 12 bytes):', signature)
        
        // Common video file signatures
        const signatureString = String.fromCharCode(...bytes)
        const isVideo = signatureString.includes('ftyp') ||     // MP4
                       bytes[0] === 0x1A && bytes[1] === 0x45 || // WebM
                       signatureString.includes('WEBM') ||      // WebM
                       bytes[0] === 0x00 && bytes[1] === 0x00   // Some MP4 variants
        
        if (isVideo) {
          console.log('File signature indicates valid video file')
        } else {
          console.warn('File signature does not look like a video file')
        }
      }
      
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty')
      }

      const url = window.URL.createObjectURL(blob)
      console.log('Created blob URL:', url)
      
      setVideoUrl(url)
    } catch (error) {
      console.error('Failed to load video for playback:', error)
      toast({
        title: "Video Load Error",
        description: error instanceof Error ? error.message : "Could not load video for playback. Try downloading instead.",
        variant: "destructive",
      })
    } finally {
      setLoadingVideo(false)
    }
  }

  const handleDownloadRecording = async (recording: Recording) => {
    try {

      
      // Try the same URLs as in playback to find the actual video file
      const urlsToTry = [
        `${recording.downloadUrl}/@@download/file`,
        `${recording.downloadUrl}/@@download`,
        recording.downloadUrl,
        `${recording.downloadUrl}/file`,
        `${recording['@id']}/@@download/file`,
      ];
      
      let blob: Blob | null = null;
      
      for (const url of urlsToTry) {
        try {
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${ploneAPI.getToken()}`,
            },
          });
          
          if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            
            // Look for video content or binary data
            if (contentType.startsWith('video/') || 
                contentType.includes('webm') || 
                contentType.includes('mp4') ||
                contentType === 'application/octet-stream') {
              blob = await response.blob();
              break;
            } else if (!contentType.includes('json')) {
              // Try non-JSON responses that might be video
              const testBlob = await response.blob();
              if (testBlob.size > 1000) {
                blob = testBlob;
                break;
              }
            }
          }
        } catch (error) {
          continue;
        }
      }
      
      if (blob) {
        // Create download link with the actual video data
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${recording.title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Download Started",
          description: "Recording download has begun",
        });
      } else {
        throw new Error('Could not access video file for download');
      }
    } catch (error) {
      console.error('Download failed:', error)
      toast({
        title: "Download Failed",
        description: "Could not download recording. The file may not have been uploaded correctly.",
        variant: "destructive",
      })
    }
  }

  const handleDebugRecording = async (recording: Recording) => {
    try {
      setDebugInfo(null);
      const recordingId = recording.id || recording['@id']?.split('/').pop() || 'unknown';
      const debug = await ploneAPI.testRecordingDownload(recordingId, meetingId, classId);
      setDebugInfo({ recording, debug });
      setShowDebug(true);
      
      toast({
        title: "Debug Complete",
        description: `Debug info generated for ${recording.title}`,
      });
    } catch (error) {
      console.error('Debug failed:', error);
      toast({
        title: "Debug Failed",
        description: "Could not run debug analysis",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading recordings...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Meeting Recordings
              {meetingTitle && <span className="text-sm font-normal text-muted-foreground">- {meetingTitle}</span>}
            </div>
          </CardTitle>
          <CardDescription>
            {recordings.length === 0 
              ? "No recordings available for this meeting"
              : `${recordings.length} recording${recordings.length !== 1 ? 's' : ''} available`
            }
          </CardDescription>
        </CardHeader>
        
        {recordings.length > 0 && (
          <CardContent className="space-y-4">
            {recordings.map((recording, index) => (
              <div key={recording.id || recording['@id'] || index}>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileVideo className="h-4 w-4 text-blue-600" />
                      <h4 className="font-medium">{recording.title}</h4>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(recording.created)}
                      </div>
                      
                      {recording.metadata && (
                        <>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(recording.metadata.duration)}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {recording.metadata.participantCount} participant{recording.metadata.participantCount !== 1 ? 's' : ''}
                          </div>
                          
                          <Badge variant="outline">
                            {formatFileSize(recording.metadata.fileSize)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handlePlayRecording(recording)}
                      className="flex items-center gap-1"
                    >
                      <Play className="h-3 w-3" />
                      Play
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadRecording(recording)}
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDebugRecording(recording)}
                      className="flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Debug
                    </Button>
                  </div>
                </div>
                
                {index < recordings.length - 1 && <Separator className="my-4" />}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Recording Playback Dialog */}
      <Dialog open={playbackOpen} onOpenChange={(open) => {
        setPlaybackOpen(open)
        if (!open && videoUrl) {
          // Clean up blob URL when dialog closes
          window.URL.revokeObjectURL(videoUrl)
          setVideoUrl(null)
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              {selectedRecording?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedRecording && formatDate(selectedRecording.created)}
              {selectedRecording?.metadata && (
                <span> • {formatDuration(selectedRecording.metadata.duration)} • {selectedRecording.metadata.participantCount} participants</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecording && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {loadingVideo ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                  <span className="ml-2 text-white">Loading video...</span>
                </div>
              ) : videoUrl ? (
                <video
                  controls
                  className="w-full h-full"
                  src={videoUrl}
                  onError={(e) => {
                    console.error('Video playback error:', e)
                    const video = e.target as HTMLVideoElement
                    console.error('Video element error:', video.error)
                    console.error('Video src:', video.src)
                    console.error('Video readyState:', video.readyState)
                    console.error('Video networkState:', video.networkState)
                    
                    let errorMessage = "Could not play recording. Try downloading instead."
                    if (video.error) {
                      const errorCode = video.error.code
                      switch (errorCode) {
                        case 1:
                          errorMessage = "Video loading aborted"
                          break
                        case 2:
                          errorMessage = "Network error while loading video"
                          break
                        case 3:
                          errorMessage = "Video format not supported or corrupted"
                          break
                        case 4:
                          errorMessage = "Video source not available"
                          break
                        default:
                          errorMessage = `Video error (code: ${errorCode})`
                      }
                    }
                    
                    toast({
                      title: "Playback Error",
                      description: errorMessage,
                      variant: "destructive",
                    })
                  }}
                  onLoadStart={() => console.log('Video load started')}
                  onLoadedMetadata={() => console.log('Video metadata loaded')}
                  onCanPlay={() => console.log('Video can start playing')}
                >
                  Your browser does not support video playback.
                </video>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-white">Failed to load video</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Debug Dialog */}
      <Dialog open={showDebug} onOpenChange={setShowDebug}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Debug Information</DialogTitle>
            <DialogDescription>
              Technical details about recording accessibility
            </DialogDescription>
          </DialogHeader>
          
          {debugInfo && (
            <div className="space-y-4">
              {debugInfo.recording && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Recording Info</h3>
                  <div className="bg-gray-100 p-3 rounded text-xs font-mono">
                    <div>Title: {debugInfo.recording.title}</div>
                    <div>ID: {debugInfo.recording.id}</div>
                    <div>Download URL: {debugInfo.recording.downloadUrl}</div>
                    <div>@id: {debugInfo.recording['@id']}</div>
                  </div>
                </div>
              )}
              
              {debugInfo.testResults && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Upload Method Test Results</h3>
                  <div className="bg-gray-100 p-3 rounded text-xs font-mono space-y-3">
                    {debugInfo.testResults.methods.map((method: any, i: number) => (
                      <div key={i} className="border-b border-gray-300 pb-2 last:border-b-0">
                        <div className="font-medium">{method.name}</div>
                        <div className="ml-2">
                          <div>Success: {method.success ? '✅ Yes' : '❌ No'}</div>
                          {method.success && (
                            <>
                              <div>Downloadable: {method.downloadable ? '✅ Yes' : '❌ No'}</div>
                              {method.downloadUrl && <div>Download URL: {method.downloadUrl}</div>}
                            </>
                          )}
                          {method.error && <div className="text-red-600">Error: {method.error}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debugInfo.debug && (
                <>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Download Test Results</h3>
                    <div className="bg-gray-100 p-3 rounded text-xs font-mono space-y-2">
                      <div>Can Download: {debugInfo.debug.canDownload ? '✅ Yes' : '❌ No'}</div>
                      <div>Working URL: {debugInfo.debug.workingUrl || 'None found'}</div>
                      
                      {debugInfo.debug.errors.length > 0 && (
                        <div>
                          <div className="font-medium text-red-600">Errors:</div>
                          {debugInfo.debug.errors.map((error: string, i: number) => (
                            <div key={i} className="text-red-600 ml-2">• {error}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">URL Test Details</h3>
                    <div className="bg-gray-100 p-3 rounded text-xs font-mono space-y-2">
                      {Object.entries(debugInfo.debug.details).map(([url, info]: [string, any]) => (
                        <div key={url} className="border-b border-gray-300 pb-2">
                          <div className="font-medium">{url}</div>
                          <div className="ml-2">
                            <div>Status: {info.status}</div>
                            {info.contentType && <div>Content-Type: {info.contentType}</div>}
                            {info.contentLength && <div>Content-Length: {info.contentLength}</div>}
                            {info.error && <div className="text-red-600">Error: {info.error}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 