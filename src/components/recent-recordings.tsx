"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Video, 
  Clock, 
  Users, 
  Calendar, 
  Play,
  Download,
  FileVideo,
  AlertCircle,
  CloudDownload,
  Monitor
} from "lucide-react"
import { ploneAPI } from "@/lib/api"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface RecentRecording {
  id: string;
  title: string;
  meetingTitle: string;
  classId: string;
  meetingId: string;
  created: string;
  downloadUrl: string;
  metadata?: {
    duration: number;
    participantCount: number;
    fileSize: number;
    storageType?: 's3' | 'plone';
    s3Key?: string;
    s3Url?: string;
  };
}

interface RecentRecordingsProps {
  limit?: number;
}

export function RecentRecordings({ limit = 5 }: RecentRecordingsProps) {
  const [recordings, setRecordings] = useState<RecentRecording[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    loadRecentRecordings()
  }, [limit])

  const loadRecentRecordings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get all classes first
      const classes = await ploneAPI.getClasses()
      const allRecordings: RecentRecording[] = []
      
      // Get recordings from each class
      for (const cls of classes) {
        try {
          const meetings = await ploneAPI.getMeetings(cls.id)
          
          for (const meeting of meetings) {
            try {
              const meetingRecordings = await ploneAPI.getMeetingRecordings(meeting.id, cls.id)
              
              for (const recording of meetingRecordings) {
                let metadata = null
                try {
                  if (recording.description) {
                    metadata = JSON.parse(recording.description)
                  }
                } catch (e) {
                  // Ignore parse errors
                }

                allRecordings.push({
                  id: recording.id,
                  title: recording.title,
                  meetingTitle: meeting.title,
                  classId: cls.id,
                  meetingId: meeting.id,
                  created: recording.created,
                  downloadUrl: recording['@id'],
                  metadata
                })
              }
            } catch (recordingError) {
              console.warn(`Could not load recordings for meeting ${meeting.id}:`, recordingError)
            }
          }
        } catch (meetingError) {
          console.warn(`Could not load meetings for class ${cls.id}:`, meetingError)
        }
      }
      
      // Sort by creation date (newest first) and limit
      const sortedRecordings = allRecordings
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
        .slice(0, limit)
      
      setRecordings(sortedRecordings)
    } catch (err) {
      console.error('Error loading recent recordings:', err)
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
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleViewRecordings = (classId: string, meetingId: string) => {
    router.push(`/classes/${classId}/meetings/${meetingId}/recordings`)
  }

  const handleDownloadRecording = async (recording: RecentRecording) => {
    try {
      // Check if this is an S3 recording
      const metadata = recording.metadata;
      
      if (metadata?.storageType === 's3' && metadata.s3Key) {
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

      // For Plone recordings, use traditional method
      const response = await fetch(recording.downloadUrl, {
        headers: {
          'Authorization': `Bearer ${ploneAPI.getToken()}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to download recording')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${recording.title.replace(/[^a-zA-Z0-9\s]/g, '_')}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Download Started",
        description: "Recording download has begun",
      })
    } catch (error) {
      console.error('Download failed:', error)
      toast({
        title: "Download Failed",
        description: "Could not download recording",
        variant: "destructive",
      })
    }
  }

  const getStorageTypeBadge = (recording: RecentRecording) => {
    const metadata = recording.metadata;
    if (metadata?.storageType === 's3') {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
          <CloudDownload className="h-2 w-2 mr-1" />
          Cloud
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
          <Monitor className="h-2 w-2 mr-1" />
          Local
        </Badge>
      );
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Recent Recordings
          </CardTitle>
          <CardDescription>Latest meeting recordings from your classes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Recent Recordings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Recent Recordings
        </CardTitle>
        <CardDescription>Latest meeting recordings from your classes</CardDescription>
      </CardHeader>
      
      <CardContent>
        {recordings.length === 0 ? (
          <div className="text-center py-6">
            <FileVideo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No Recordings Yet</h3>
            <p className="text-sm text-muted-foreground">
              Meeting recordings will appear here after you record virtual classes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recordings.map((recording) => (
              <div key={recording.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    <FileVideo className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{recording.title}</h4>
                      {getStorageTypeBadge(recording)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {recording.meetingTitle}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
                            {recording.metadata.participantCount}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {formatFileSize(recording.metadata.fileSize)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewRecordings(recording.classId, recording.meetingId)}
                    className="h-8 px-2"
                    title="View recordings"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownloadRecording(recording)}
                    className="h-8 px-2"
                    title="Download recording"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 