"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  Circle,
  Square,
  Users
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ploneAPI } from "@/lib/api"

interface SimpleMeetingRoomProps {
  meetingId: string
  isTeacher?: boolean
  classId?: string
}

export function SimpleMeetingRoom({ meetingId, isTeacher = false, classId }: SimpleMeetingRoomProps) {
  const { toast } = useToast()
  
  // Video/Audio state
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [isInCall, setIsInCall] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  
  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  
  // WebRTC refs
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    // Initialize when component mounts
    return () => {
      // Cleanup when component unmounts
      stopCall()
    }
  }, [])

  const startCall = async () => {
    try {
      // Get user media (camera + microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoOn,
        audio: isAudioOn
      })
      
      localStreamRef.current = stream
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      
      setIsInCall(true)
      setParticipants(['You'])
      
      toast({
        title: "Meeting Started",
        description: "You're now in the meeting room",
      })
      
    } catch (error) {
      console.error('Error starting call:', error)
      toast({
        title: "Error",
        description: "Could not access camera/microphone",
        variant: "destructive",
      })
    }
  }

  const stopCall = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop()
      })
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    // Stop recording if active
    if (isRecording) {
      stopRecording()
    }
    
    setIsInCall(false)
    setParticipants([])
    
    toast({
      title: "Meeting Ended",
      description: "You've left the meeting room",
    })
  }

  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn
        setIsVideoOn(!isVideoOn)
      }
    }
  }

  const toggleAudio = async () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn
        setIsAudioOn(!isAudioOn)
      }
    }
  }

  const startRecording = async () => {
    if (!localStreamRef.current) return
    
    try {
      // Create MediaRecorder with the current stream
      const mediaRecorder = new MediaRecorder(localStreamRef.current, {
        mimeType: 'video/webm;codecs=vp9' // Good quality, widely supported
      })
      
      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        saveRecording()
      }
      
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      
      toast({
        title: "Recording Started",
        description: "Meeting is now being recorded",
      })
      
    } catch (error) {
      console.error('Error starting recording:', error)
      toast({
        title: "Recording Error",
        description: "Could not start recording",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const saveRecording = async () => {
    if (recordedChunksRef.current.length === 0) return
    
    try {
      // Create blob from recorded chunks
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
      
      // Calculate recording metadata
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - (recordedChunksRef.current.length * 1000)) // Approximate
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      
      toast({
        title: "Uploading Recording",
        description: "Please wait while we save your recording...",
      })
      
      // Upload to Plone backend
      const result = await ploneAPI.uploadMeetingRecording(
        meetingId,
        classId,
        blob,
        {
          duration: duration,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          participantCount: participants.length
        }
      )
      
      toast({
        title: "Recording Saved",
        description: `Recording uploaded successfully and is now available for students to view.`,
      })
      
      console.log('Recording uploaded:', result)
      
    } catch (error) {
      console.error('Error saving recording:', error)
      toast({
        title: "Upload Error",
        description: "Could not upload recording. It has been saved locally instead.",
        variant: "destructive",
      })
      
      // Fallback to local download if upload fails
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const fileName = `meeting-${meetingId}-${timestamp}.webm`
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-6">
      {/* Meeting Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Meeting Room: {meetingId}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {isTeacher ? 'You are the host' : 'Student participant'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isInCall ? "default" : "secondary"}>
                {isInCall ? "In Call" : "Not Connected"}
              </Badge>
              {isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  <Circle className="w-3 h-3 mr-1 fill-current" />
                  Recording
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Video */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              You {isTeacher && "(Host)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
              )}
              {!isAudioOn && (
                <div className="absolute top-2 right-2">
                  <MicOff className="w-5 h-5 text-red-500" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Remote Video (placeholder for now) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants ({participants.length - 1})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover hidden"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Waiting for participants...</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Share meeting link to invite students
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meeting Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-4">
            {!isInCall ? (
              <Button onClick={startCall} size="lg" className="px-8">
                <Phone className="w-5 h-5 mr-2" />
                Join Meeting
              </Button>
            ) : (
              <>
                {/* Video Toggle */}
                <Button
                  variant={isVideoOn ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleVideo}
                >
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>

                {/* Audio Toggle */}
                <Button
                  variant={isAudioOn ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleAudio}
                >
                  {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>

                {/* Recording Toggle (Teacher only) */}
                {isTeacher && (
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="lg"
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? (
                      <>
                        <Square className="w-5 h-5 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Circle className="w-5 h-5 mr-2 fill-current" />
                        Start Recording
                      </>
                    )}
                  </Button>
                )}

                {/* End Call */}
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={stopCall}
                >
                  <PhoneOff className="w-5 h-5 mr-2" />
                  Leave Meeting
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Meeting Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Meeting Link:</strong> {window.location.href}
            </p>
            <p>
              Share this link with students to join the meeting
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 