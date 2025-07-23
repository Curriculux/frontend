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
  const [demoMode, setDemoMode] = useState(false)
  
  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  
  // WebRTC refs
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map())
  const [currentUsername, setCurrentUsername] = useState<string>('')

  const signalPollingInterval = useRef<NodeJS.Timeout | null>(null)
  const lastSignalSent = useRef<number>(0)
  const signalQueue = useRef<Array<{ participant: string, message: any }>>([])
  const isProcessingSignalQueue = useRef<boolean>(false)

  // WebRTC Configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }

  useEffect(() => {
    // Initialize when component mounts
    return () => {
      // Cleanup when component unmounts
      stopCall()
    }
  }, [])

  // Periodically refresh participant list and initiate connections
  useEffect(() => {
    if (!isInCall) return

    const interval = setInterval(async () => {
      try {
        console.log('Refreshing participants for meeting:', { meetingId, classId })
        const currentParticipants = await ploneAPI.getMeetingParticipants(meetingId, classId)
        console.log('Current participants:', currentParticipants)
        
        // Always include "You" in the participant list
        const allParticipants = ['You', ...currentParticipants.filter(p => p !== 'You')]
        // Remove duplicates
        const uniqueParticipants = [...new Set(allParticipants)]
        setParticipants(uniqueParticipants)
        
        // Try to connect to new participants (real WebRTC)
        const otherParticipants = currentParticipants.filter(p => p !== 'You' && p !== currentUsername)
        console.log('Other participants to connect:', otherParticipants, 'Current username:', currentUsername)
        
        for (const participant of otherParticipants) {
          if (!peerConnections.has(participant) && participant.trim() !== '') {
            console.log('Checking if should connect to:', participant)
            // Only create offer if our username is "smaller" (alphabetically) to avoid both sides creating offers
            if (!currentUsername || currentUsername.toLowerCase() < participant.toLowerCase()) {
              console.log(`${currentUsername} will initiate connection to ${participant}`)
              try {
                await connectToParticipant(participant)
              } catch (error) {
                console.warn('Failed to connect to participant:', participant, error)
              }
            } else {
              console.log(`${currentUsername} waiting for ${participant} to initiate connection`)
            }
          }
        }
        
        // Poll for WebRTC signaling messages
        await pollForSignalMessages()
      } catch (error) {
        console.warn('Could not refresh participants:', error)
        // Keep existing participants list if refresh fails
      }
    }, 3000) // Check every 3 seconds

    return () => clearInterval(interval)
  }, [isInCall, meetingId, classId, peerConnections, currentUsername])

  // Separate interval for signal polling (more frequent)
  useEffect(() => {
    if (!isInCall) return

    // Add randomization to spread out polling requests and reduce database conflicts
    const baseInterval = 1500 // 1.5 seconds base
    const jitter = Math.random() * 500 // Add up to 500ms jitter
    const interval = baseInterval + jitter

    const signalInterval = setInterval(async () => {
      await pollForSignalMessages()
    }, interval)

    return () => clearInterval(signalInterval)
  }, [isInCall, meetingId, classId])

  // Rate-limited signal sender to prevent database conflicts
  const sendSignalWithRateLimit = async (participant: string, message: any) => {
    const now = Date.now()
    const minInterval = 100 // Minimum 100ms between signals
    
    if (now - lastSignalSent.current < minInterval) {
      // Queue the signal instead of sending immediately
      signalQueue.current.push({ participant, message })
      processSignalQueue()
      return
    }
    
    lastSignalSent.current = now
    try {
      await ploneAPI.sendSignalMessage(meetingId, classId, participant, message)
    } catch (error) {
      console.warn('Failed to send signal:', error)
    }
  }

  const processSignalQueue = async () => {
    if (isProcessingSignalQueue.current || signalQueue.current.length === 0) {
      return
    }
    
    isProcessingSignalQueue.current = true
    
    while (signalQueue.current.length > 0) {
      const { participant, message } = signalQueue.current.shift()!
      const now = Date.now()
      
      if (now - lastSignalSent.current >= 100) {
        lastSignalSent.current = now
        try {
          await ploneAPI.sendSignalMessage(meetingId, classId, participant, message)
        } catch (error) {
          console.warn('Failed to send queued signal:', error)
        }
      } else {
        // Put it back if we need to wait longer
        signalQueue.current.unshift({ participant, message })
        await new Promise(resolve => setTimeout(resolve, 100 - (now - lastSignalSent.current)))
      }
    }
    
    isProcessingSignalQueue.current = false
  }

  // WebRTC Helper Functions
  const createPeerConnection = (participantId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(rtcConfiguration)
    
    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }
    
    // Handle incoming remote stream
    pc.ontrack = (event) => {
      console.log('Received remote stream from:', participantId, 'Stream tracks:', event.streams[0].getTracks().length)
      const stream = event.streams[0]
      
      setRemoteStreams(prev => {
        const newStreams = new Map(prev)
        newStreams.set(participantId, stream)
        console.log('Updated remote streams, total:', newStreams.size)
        return newStreams
      })
      
      // Stream will be assigned when video element ref is called
    }
    
    // Handle ICE candidates (for NAT traversal)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Generated ICE candidate for:', participantId)
        // Send ICE candidate to the other participant using rate limiting
        sendSignalWithRateLimit(participantId, {
          type: 'ice-candidate',
          candidate: event.candidate
        })
      }
    }
    
    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${participantId}: ${pc.connectionState}`)
      if (pc.connectionState === 'connected') {
        console.log(`Successfully connected to ${participantId}`)
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log(`Connection to ${participantId} failed or disconnected`)
        // Remove remote stream when disconnected
        setRemoteStreams(prev => {
          const newStreams = new Map(prev)
          newStreams.delete(participantId)
          return newStreams
        })
        // Clean up peer connection
        setPeerConnections(prev => {
          const newConnections = new Map(prev)
          newConnections.delete(participantId)
          return newConnections
        })
      }
    }
    
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state for ${participantId}: ${pc.iceGatheringState}`)
    }
    
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${participantId}: ${pc.iceConnectionState}`)
    }
    
    return pc
  }

  const connectToParticipant = async (participantId: string) => {
    try {
      console.log('Setting up peer connection for:', participantId)
      const pc = createPeerConnection(participantId)
      
      // Store peer connection first
      setPeerConnections(prev => {
        const newConnections = new Map(prev)
        newConnections.set(participantId, pc)
        return newConnections
      })
      
      // Create offer with proper constraints
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
      await pc.setLocalDescription(offer)
      
      console.log('Created offer for participant:', participantId, 'SDP type:', offer.type)
      
      // Send offer to the other participant via signaling
      await sendSignalWithRateLimit(participantId, {
        type: 'offer',
        offer: offer,
        from: currentUsername || 'unknown'
      })
      
      console.log('Sent offer to:', participantId)
      
    } catch (error) {
      console.error('Error connecting to participant:', participantId, error)
      // Remove failed connection
      setPeerConnections(prev => {
        const newConnections = new Map(prev)
        newConnections.delete(participantId)
        return newConnections
      })
      throw error
    }
  }

  // Real WebRTC signal handling
  const handleSignalMessage = async (signal: any) => {
    try {
      // Handle signals that failed to parse
      if (signal.parseError) {
        console.warn('Skipping signal with parse error:', signal.description)
        await ploneAPI.deleteSignalMessage(signal['@id'])
        return
      }
      
      const { from, message } = signal
      
      // Skip messages from ourselves
      if (from === currentUsername) {
        await ploneAPI.deleteSignalMessage(signal['@id'])
        return
      }
      
      console.log('Processing signal from:', from, 'type:', message?.type)
      
      switch (message?.type) {
        case 'offer':
          // Received offer from another participant
          console.log('Received offer from:', from, 'SDP type:', message.offer?.type)
          
          // Don't create duplicate connections
          if (peerConnections.has(from)) {
            console.log('Already have connection to:', from)
            break
          }
          
          const pc = createPeerConnection(from)
          
          // Store peer connection first
          setPeerConnections(prev => {
            const newConnections = new Map(prev)
            newConnections.set(from, pc)
            return newConnections
          })
          
          await pc.setRemoteDescription(new RTCSessionDescription(message.offer))
          
          // Create answer
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          
          // Send answer back
          await sendSignalWithRateLimit(from, {
            type: 'answer',
            answer: answer,
            from: currentUsername || 'unknown'
          })
          
          console.log('Sent answer to:', from)
          break

        case 'answer':
          // Received answer to our offer
          console.log('Received answer from:', from)
          const existingPc = peerConnections.get(from)
          if (existingPc && existingPc.signalingState === 'have-local-offer') {
            await existingPc.setRemoteDescription(new RTCSessionDescription(message.answer))
            console.log('Set remote description for answer from:', from)
          } else {
            console.warn('No pending offer for answer from:', from, 'state:', existingPc?.signalingState)
          }
          break

        case 'ice-candidate':
          // Received ICE candidate
          console.log('Received ICE candidate from:', from)
          const candidatePc = peerConnections.get(from)
          if (candidatePc && candidatePc.remoteDescription) {
            await candidatePc.addIceCandidate(new RTCIceCandidate(message.candidate))
            console.log('Added ICE candidate from:', from)
          } else {
            console.warn('Cannot add ICE candidate from:', from, 'no remote description')
          }
          break
          
        default:
          console.warn('Unknown signal type:', message?.type, 'from:', from)
      }
      
      // Delete the processed signal message
      try {
        await ploneAPI.deleteSignalMessage(signal['@id'])
      } catch (deleteError: any) {
        // Signal deletion errors are handled in the API layer
        // No need to log here as non-critical errors are already logged there
      }
      
    } catch (error) {
      console.error('Error handling signal message:', error)
      // Try to clean up the problematic signal
      try {
        await ploneAPI.deleteSignalMessage(signal['@id'])
      } catch (deleteError) {
        // Ignore deletion errors for error cleanup
      }
    }
  }

  const pollForSignalMessages = async () => {
    try {
      const signals = await ploneAPI.getSignalMessages(meetingId, classId)
      
      for (const signal of signals) {
        await handleSignalMessage(signal)
      }
    } catch (error: any) {
      // If it's a database conflict, don't spam the console
      if (error.message && error.message.includes('ConflictError')) {
        console.debug('Database conflict during signal polling (will retry automatically)')
      } else {
        console.warn('Error polling for signals:', error)
      }
    }
  }

  const startCall = async () => {
    try {
      // Get user media (camera + microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true }
      })
      
      localStreamRef.current = stream
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        localVideoRef.current.play().catch(e => console.warn('Local video play failed:', e))
      }
      
      setIsInCall(true)
      console.log('Local stream started with tracks:', stream.getTracks().map(t => t.kind))
      
      // Join meeting and track participants
      try {
        console.log('Joining meeting as participant:', { meetingId, classId })
        
        // Get current user info for WebRTC signaling
        const user = await ploneAPI.getCurrentUser()
        if (user) {
          setCurrentUsername(user.username)
          console.log('Current user for WebRTC:', user.username, 'fullname:', user.fullname)
          console.log('Full user object:', user)
        } else {
          console.warn('No current user found!')
        }
        
        const result = await ploneAPI.joinMeetingAsParticipant(meetingId, classId)
        console.log('Participant tracking result:', result)
        
        // Always include "You" in the participant list if not already there
        const participants = result.participants || []
        if (!participants.includes('You')) {
          participants.unshift('You')
        }
        setParticipants(participants)
      } catch (participantError) {
        console.warn('Could not join participant tracking:', participantError)
        
        // Fallback: try to get existing participants without joining
        try {
          const existingParticipants = await ploneAPI.getMeetingParticipants(meetingId, classId)
          setParticipants(['You', ...existingParticipants])
        } catch {
          setParticipants(['You'])
        }
      }
      
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
    // Leave meeting participant tracking
    ploneAPI.leaveMeeting(meetingId, classId).catch(error => {
      console.warn('Could not leave participant tracking:', error)
    })
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop()
      })
    }
    
    // Close all peer connections
    peerConnections.forEach((pc, participantId) => {
      console.log('Closing connection to:', participantId)
      pc.close()
    })
    setPeerConnections(new Map())
    setRemoteStreams(new Map())
    
    // Close legacy peer connection (if exists)
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
        
        // Update all peer connections with new track state
        peerConnections.forEach((pc, participantId) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender && sender.track) {
            sender.track.enabled = !isVideoOn
          }
        })
        
        console.log('Video toggled:', !isVideoOn)
      }
    }
  }

  const toggleAudio = async () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn
        setIsAudioOn(!isAudioOn)
        
        // Update all peer connections with new track state
        peerConnections.forEach((pc, participantId) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio')
          if (sender && sender.track) {
            sender.track.enabled = !isAudioOn
          }
        })
        
        console.log('Audio toggled:', !isAudioOn)
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

        {/* Remote Participants */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Other Participants ({Math.max(0, participants.length - 1)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {remoteStreams.size > 0 ? (
              <div className="space-y-2">
                {Array.from(remoteStreams.entries()).map(([participantId, stream]) => (
                  <div key={participantId} className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      autoPlay
                      playsInline
                      muted={false}
                      className="w-full h-full object-cover"
                      ref={(video) => {
                        if (video && stream) {
                          // Only set up if not already set up
                          if (video.srcObject !== stream) {
                            console.log('Setting up video element for:', participantId)
                            video.srcObject = stream
                            
                            // Ensure video plays
                            video.play().catch((e: any) => {
                              console.warn('Remote video play failed for', participantId, ':', e)
                            })
                            
                            // Debug stream info
                            console.log('Stream for', participantId, 'has tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`))
                          }
                        }
                      }}
                      onLoadedMetadata={() => {
                        console.log('Video metadata loaded for:', participantId)
                      }}
                      onCanPlay={() => {
                        console.log('Video can play for:', participantId)
                      }}
                    />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                      {participantId}
                    </div>
                    <div className="absolute top-2 right-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded">
                      Live
                    </div>
                  </div>
                ))}
              </div>
            ) : (
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
                    {participants.length > 1 ? (
                      <div>
                        <p className="text-gray-700 font-medium">Other participants:</p>
                        <div className="mt-2 space-y-1">
                          {participants.filter(p => p !== 'You').map((participant, index) => (
                            <p key={index} className="text-sm text-gray-600 bg-white/80 px-2 py-1 rounded">
                              {participant}
                            </p>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Video streams will appear when participants enable their cameras
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-500">Waiting for participants...</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Share meeting link to invite students
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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

                {/* Test Camera */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={async () => {
                    try {
                      console.log('Testing camera access...')
                      const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                      console.log('Camera test successful, tracks:', testStream.getTracks().map(t => t.kind))
                      toast({
                        title: "Camera Test",
                        description: `Camera access works! Video: ${testStream.getVideoTracks().length}, Audio: ${testStream.getAudioTracks().length}`,
                      })
                      testStream.getTracks().forEach(track => track.stop())
                    } catch (error) {
                      console.error('Camera test failed:', error)
                      toast({
                        title: "Camera Test Failed",
                        description: `Error: ${error}`,
                        variant: "destructive"
                      })
                    }
                  }}
                >
                  Test Camera
                </Button>

                {/* Force Reconnect */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={async () => {
                    console.log('Force reconnecting to participants...')
                    // Clear existing connections
                    peerConnections.forEach((pc, participantId) => {
                      console.log('Closing connection to:', participantId)
                      pc.close()
                    })
                    setPeerConnections(new Map())
                    setRemoteStreams(new Map())
                    
                    // Attempt to reconnect
                    try {
                      const currentParticipants = await ploneAPI.getMeetingParticipants(meetingId, classId)
                      console.log('Current participants for reconnect:', currentParticipants)
                      
                      const otherParticipants = currentParticipants.filter(p => p !== 'You' && p !== currentUsername)
                      for (const participant of otherParticipants) {
                        if (participant.trim() !== '') {
                          console.log('Attempting to reconnect to:', participant)
                          try {
                            await connectToParticipant(participant)
                          } catch (error) {
                            console.warn('Failed to reconnect to participant:', participant, error)
                          }
                        }
                      }
                      
                      toast({
                        title: "Reconnecting",
                        description: `Attempting to reconnect to ${otherParticipants.length} participants`,
                      })
                    } catch (error) {
                      console.error('Reconnect failed:', error)
                    }
                  }}
                >
                                     Force Reconnect
                 </Button>

                 {/* Test Signaling */}
                 <Button
                   variant="outline"
                   size="lg"
                   onClick={async () => {
                     console.log('Testing signaling...')
                     try {
                       const currentParticipants = await ploneAPI.getMeetingParticipants(meetingId, classId)
                       console.log('Participants for signaling test:', currentParticipants)
                       
                       const otherParticipants = currentParticipants.filter(p => p !== 'You' && p !== currentUsername)
                       if (otherParticipants.length > 0) {
                         const testParticipant = otherParticipants[0]
                         console.log('Sending test signal to:', testParticipant)
                         
                         await sendSignalWithRateLimit(testParticipant, {
                           type: 'test',
                           message: 'Hello from ' + currentUsername,
                           timestamp: Date.now()
                         })
                         
                         toast({
                           title: "Test Signal Sent",
                           description: `Sent test signal to ${testParticipant}`,
                         })
                       } else {
                         toast({
                           title: "No Participants",
                           description: "No other participants to test signaling with",
                           variant: "destructive"
                         })
                       }
                     } catch (error) {
                       console.error('Signaling test failed:', error)
                       toast({
                         title: "Signaling Test Failed",
                         description: `Error: ${error}`,
                         variant: "destructive"
                       })
                     }
                   }}
                 >
                   Test Signaling
                 </Button>

                 {/* Debug Signals */}
                 <Button
                   variant="outline"
                   size="lg"
                   onClick={async () => {
                     console.log('Checking signals...')
                     try {
                       const signals = await ploneAPI.getSignalMessages(meetingId, classId)
                       console.log('Current signals:', signals)
                       
                       toast({
                         title: "Signal Debug",
                         description: `Found ${signals.length} signals. Check console for details.`,
                       })
                     } catch (error) {
                       console.error('Signal debug failed:', error)
                       toast({
                         title: "Signal Debug Failed",
                         description: `Error: ${error}`,
                         variant: "destructive"
                       })
                     }
                   }}
                 >
                   Debug Signals
                 </Button>

                 {/* Manual Connect */}
                 <Button
                   variant="outline"
                   size="lg"
                   onClick={async () => {
                     console.log('Manual connect to participants...')
                     try {
                       const currentParticipants = await ploneAPI.getMeetingParticipants(meetingId, classId)
                       console.log('All participants:', currentParticipants)
                       
                       const otherParticipants = currentParticipants.filter(p => p !== 'You' && p !== currentUsername)
                       if (otherParticipants.length > 0) {
                         const targetParticipant = otherParticipants[0]
                         console.log('Manually connecting to:', targetParticipant)
                         
                         // Force close existing connection if any
                         const existingPc = peerConnections.get(targetParticipant)
                         if (existingPc) {
                           console.log('Closing existing connection')
                           existingPc.close()
                           peerConnections.delete(targetParticipant)
                           setPeerConnections(new Map(peerConnections))
                         }
                         
                         // Create new connection
                         await connectToParticipant(targetParticipant)
                         
                         toast({
                           title: "Manual Connect",
                           description: `Initiated connection to ${targetParticipant}`,
                         })
                       } else {
                         toast({
                           title: "No Participants",
                           description: "No other participants to connect to",
                           variant: "destructive"
                         })
                       }
                     } catch (error) {
                       console.error('Manual connect failed:', error)
                       toast({
                         title: "Connect Failed",
                         description: `Error: ${error}`,
                         variant: "destructive"
                       })
                     }
                   }}
                 >
                   Manual Connect
                 </Button>

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

      {/* Debug Info (for development) */}
      {process.env.NODE_ENV === 'development' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>Participants: {participants.length} ({participants.join(', ')})</div>
            <div>Current Username: {currentUsername}</div>
            <div>Peer Connections: {peerConnections.size}</div>
            <div>Remote Streams: {remoteStreams.size}</div>
            <div>Local Stream Tracks: {localStreamRef.current?.getTracks().map(t => `${t.kind}:${t.enabled}`).join(', ') || 'None'}</div>
            <div>Peer Connection States:</div>
            {Array.from(peerConnections.entries()).map(([id, pc]) => (
              <div key={id} className="ml-4 text-xs">
                - {id}: {pc.connectionState} / {pc.iceConnectionState} / {pc.signalingState}
              </div>
            ))}
            <div>Remote Streams Detail:</div>
            {Array.from(remoteStreams.entries()).map(([id, stream]) => (
              <div key={id} className="ml-4">
                - {id}: {stream.getTracks().map(t => `${t.kind}:${t.enabled}`).join(', ')}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
} 