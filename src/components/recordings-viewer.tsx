"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { 
  Play, 
  Download, 
  Clock, 
  Users, 
  Calendar, 
  Video, 
  FileVideo,
  Loader2,
  AlertCircle,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Pause,
  Monitor,
  CloudDownload
} from "lucide-react"
import { ploneAPI } from "@/lib/api"
import { formatLocaleDateTime } from "@/lib/date-utils"
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
    storageType?: 's3' | 'plone';
    s3Key?: string;
    s3Url?: string;
  };
}

interface RecordingsViewerProps {
  meetingId: string;
  classId?: string;
  meetingTitle?: string;
}

export function RecordingsViewer({ meetingId, classId, meetingTitle }: RecordingsViewerProps) {
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [playbackOpen, setPlaybackOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)
  
  // Video player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)

  useEffect(() => {
    loadRecordings()
  }, [meetingId, classId])

  // Video player event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    const updateDuration = () => setDuration(video.duration)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleVolumeChange = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
    }
    const handleError = (e: Event) => {
      console.error('Video error:', e)
      const target = e.target as HTMLVideoElement
      if (target.error) {
        setVideoError(getVideoErrorMessage(target.error.code))
      }
    }

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('durationchange', updateDuration)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('volumechange', handleVolumeChange)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('durationchange', updateDuration)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('volumechange', handleVolumeChange)
      video.removeEventListener('error', handleError)
    }
  }, [videoUrl])

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
            // Try to parse as direct JSON first (S3 recordings)
            if (recording.description.startsWith('{') || recording.description.includes('storageType')) {
              metadata = JSON.parse(recording.description)
            } else {
              // Fall back to direct JSON parsing for legacy format
              metadata = JSON.parse(recording.description)
            }
          }
        } catch (e) {
          console.warn('Could not parse recording metadata:', e)
          // Try alternative parsing if available
          try {
            if (recording.description && recording.description.includes('[METADATA]')) {
              // This might be legacy format - extract JSON part
              const jsonMatch = recording.description.match(/\{.*\}/)
              if (jsonMatch) {
                metadata = JSON.parse(jsonMatch[0])
              }
            }
          } catch (e2) {
            console.warn('Alternative metadata parsing also failed:', e2)
          }
        }

        return {
          id: recording.id,
          title: recording.title,
          '@id': recording['@id'],
          created: recording.created,
          modified: recording.modified,
          description: recording.description,
          downloadUrl: recording.downloadUrl,
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
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatDate = (dateString: string) => {
    return formatLocaleDateTime(dateString)
  }

  const getVideoErrorMessage = (errorCode: number): string => {
    switch (errorCode) {
      case 1:
        return "Video loading was aborted"
      case 2:
        return "Network error while loading video"
      case 3:
        return "Video format not supported or file corrupted"
      case 4:
        return "Video source not available"
      default:
        return `Video error (code: ${errorCode})`
    }
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
        // Get a presigned URL valid for 3 hours (for longer viewing sessions)
        const presignedUrl = await ploneAPI.getSecureFileUrl(metadata.s3Key, 180);
        console.log('Got presigned URL for S3 recording');
        return presignedUrl;
      } catch (error) {
        console.error('Error getting presigned URL:', error);
        // Fall back to direct S3 URL if available
        if (metadata.s3Url) {
          console.log('Falling back to direct S3 URL');
          return metadata.s3Url;
        }
        throw new Error(`Failed to get S3 access URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // For Plone-stored recordings, return the download URL
    return recording.downloadUrl;
  }

  const handlePlayRecording = async (recording: any) => {
    try {
      setSelectedRecording(recording)
      setPlaybackOpen(true)
      setVideoError(null)
      
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

      // Try different approaches to get the video file for Plone recordings
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
            }
          }
        } catch (error) {
          console.log(`Failed to fetch from ${url}:`, error);
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
      
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty')
      }

      const url = window.URL.createObjectURL(blob)
      console.log('Created blob URL:', url)
      
      setVideoUrl(url)
    } catch (error) {
      console.error('Failed to load video for playback:', error)
      setVideoError(error instanceof Error ? error.message : "Could not load video for playback")
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
      // Check if this is an S3 recording
      let metadata: any = {};
      try {
        metadata = JSON.parse(recording.description || '{}');
      } catch (e) {
        // Ignore parsing errors
      }

      if (metadata.storageType === 's3' && metadata.s3Key) {
        // For S3 recordings, get a presigned URL for download
        console.log('Downloading S3 recording:', metadata.s3Key);
        const downloadUrl = await ploneAPI.getSecureFileUrl(metadata.s3Key, 60); // 1 hour expiry for download
        
        // Create download link
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${recording.title.replace(/[^a-zA-Z0-9\s]/g, '_')}.webm`;
        a.setAttribute('target', '_blank');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast({
          title: "Download Started",
          description: "S3 recording download has begun",
        });
        return;
      }

      // For Plone recordings, try the same URLs as in playback to find the actual video file
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
        a.download = `${recording.title.replace(/[^a-zA-Z0-9\s]/g, '_')}.webm`;
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

  // Video player controls
  const togglePlayPause = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
  }

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return
    videoRef.current.volume = newVolume
    setVolume(newVolume)
    if (newVolume === 0) {
      videoRef.current.muted = true
      setIsMuted(true)
    } else if (isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const skipTime = (seconds: number) => {
    if (!videoRef.current) return
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    handleSeek(newTime)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Try to fullscreen the video container instead of just the video element
      const videoContainer = videoRef.current?.parentElement
      if (videoContainer) {
        videoContainer.requestFullscreen()
      } else {
        videoRef.current?.requestFullscreen()
      }
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const getStorageTypeBadge = (recording: Recording) => {
    const metadata = recording.metadata;
    if (metadata?.storageType === 's3') {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300">
          <CloudDownload className="h-3 w-3 mr-1" />
          Cloud Storage
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-green-600 border-green-300">
          <Monitor className="h-3 w-3 mr-1" />
          Local Storage
        </Badge>
      );
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
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Recordings ({recordings.length})</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    console.log('=== DEBUG: Fetching recordings folder directly ===')
                    const meetingPath = classId ? 
                      `/classes/${classId}/meetings/${meetingId}` : 
                      `/meetings/${meetingId}`;
                    
                    const recordingsFolder = await ploneAPI.getMeetingRecordings(meetingId, classId);
                    console.log('Recordings response:', recordingsFolder);
                    
                    if (recordingsFolder && recordingsFolder.length > 0) {
                      console.log('Found recordings:', recordingsFolder.length);
                      recordingsFolder.forEach((item: any, index: number) => {
                        console.log(`Recording ${index + 1}:`, {
                          title: item.title,
                          type: item['@type'],
                          id: item.id,
                          '@id': item['@id'],
                          created: item.created,
                          description: item.description?.substring(0, 200) + '...'
                        });
                      });
                    } else {
                      console.log('No recordings found in folder');
                    }
                    
                    toast({
                      title: "Debug Complete",
                      description: "Check console for recordings folder details",
                    });
                  } catch (error) {
                    console.error('Debug error:', error);
                    toast({
                      title: "Debug Failed",
                      description: "Error accessing recordings folder",
                      variant: "destructive",
                    });
                  }
                }}
                className="text-xs"
              >
                Debug Folder
              </Button>
            </div>
            
            {recordings.map((recording, index) => (
              <div key={recording.id || recording['@id'] || index}>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50/50 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileVideo className="h-4 w-4 text-blue-600" />
                      <h4 className="font-medium">{recording.title}</h4>
                      {getStorageTypeBadge(recording)}
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

      {/* Enhanced Recording Playback Dialog */}
      <Dialog open={playbackOpen} onOpenChange={(open) => {
        setPlaybackOpen(open)
        if (!open && videoUrl) {
          // Clean up blob URL when dialog closes
          if (videoUrl.startsWith('blob:')) {
            window.URL.revokeObjectURL(videoUrl)
          }
          setVideoUrl(null)
          setVideoError(null)
          setCurrentTime(0)
          setDuration(0)
          setIsPlaying(false)
          setIsTheaterMode(false)
        }
      }}>
        <DialogContent className={`${isTheaterMode ? 'max-w-[98vw] w-[98vw] max-h-[98vh] p-1' : 'max-w-[95vw] w-[95vw] sm:max-w-[95vw] md:max-w-[95vw] lg:max-w-[95vw] xl:max-w-[95vw] max-h-[95vh] p-3'}`}>
          {!isTheaterMode && (
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
          )}
          
                      {selectedRecording && (
              <div className={`${isTheaterMode ? 'h-full' : 'space-y-4'}`}>
                <div className={`bg-black rounded-lg overflow-hidden relative ${isTheaterMode ? 'h-[90vh]' : 'h-[80vh] min-h-[500px]'} flex items-center justify-center`}>
                {loadingVideo ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                    <span className="ml-2 text-white">Loading video...</span>
                  </div>
                ) : videoError ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
                      <h3 className="text-lg font-semibold mb-2">Video Error</h3>
                      <p className="text-sm text-gray-300">{videoError}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4"
                        onClick={() => handleDownloadRecording(selectedRecording)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Instead
                      </Button>
                    </div>
                  </div>
                ) : videoUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      className="max-w-full max-h-full object-contain"
                      src={videoUrl}
                      onLoadStart={() => console.log('Video load started')}
                      onLoadedMetadata={() => console.log('Video metadata loaded')}
                      onCanPlay={() => console.log('Video can start playing')}
                    >
                      Your browser does not support video playback.
                    </video>
                    
                    {/* Custom Video Controls */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <Progress 
                          value={duration > 0 ? (currentTime / duration) * 100 : 0} 
                          className="h-2 cursor-pointer"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const percentage = x / rect.width;
                            handleSeek(percentage * duration);
                          }}
                        />
                        <div className="flex justify-between text-xs text-white mt-1">
                          <span>{formatDuration(currentTime)}</span>
                          <span>{formatDuration(duration)}</span>
                        </div>
                      </div>
                      
                      {/* Control Buttons */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => skipTime(-10)}
                            className="text-white hover:bg-white/20"
                          >
                            <SkipBack className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={togglePlayPause}
                            className="text-white hover:bg-white/20"
                          >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => skipTime(10)}
                            className="text-white hover:bg-white/20"
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={toggleMute}
                            className="text-white hover:bg-white/20"
                          >
                            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </Button>
                          
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="w-20 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                          />
                                                 </div>
                         
                         <div className="flex items-center gap-2">
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={() => setIsTheaterMode(!isTheaterMode)}
                             className="text-white hover:bg-white/20"
                             title={isTheaterMode ? "Exit Theater Mode" : "Theater Mode"}
                           >
                             {isTheaterMode ? (
                               <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                               </svg>
                             ) : (
                               <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                               </svg>
                             )}
                           </Button>
                           
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={toggleFullscreen}
                             className="text-white hover:bg-white/20"
                             title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                           >
                             {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                           </Button>
                         </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-white">Failed to load video</span>
                  </div>
                )}
              </div>
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
                    {debugInfo.recording.metadata?.storageType && (
                      <div>Storage Type: {debugInfo.recording.metadata.storageType}</div>
                    )}
                    {debugInfo.recording.metadata?.s3Key && (
                      <div>S3 Key: {debugInfo.recording.metadata.s3Key}</div>
                    )}
                  </div>
                </div>
              )}
              
              {debugInfo.debug && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Debug Results</h3>
                  <div className="bg-gray-100 p-3 rounded text-xs font-mono whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.debug, null, 2)}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 