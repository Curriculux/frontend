'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff,
  Settings,
  Users,
  Camera,
  Download,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PloneAPI } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WebRTCMeetingClientProps {
  meetingId: string;
  classId?: string;
  userId: string;
  username: string;
  onEnd?: () => void;
}

interface VideoGridItemProps {
  stream?: MediaStream;
  username: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHost?: boolean;
}

const VideoGridItem: React.FC<VideoGridItemProps> = ({ 
  stream, 
  username, 
  isLocal, 
  isMuted, 
  isVideoOff,
  isHost 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream && stream instanceof MediaStream) {
      try {
        videoRef.current.srcObject = stream;
      } catch (error) {
        console.error('Error setting video srcObject:', error);
      }
    } else if (videoRef.current) {
      // Clear the srcObject if no valid stream
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  return (
    <Card className="relative overflow-hidden bg-gray-900 aspect-video">
      {stream && stream instanceof MediaStream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.error('Video element error:', e);
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-2xl font-semibold text-gray-300">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-400">{username}</p>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
          {username} {isLocal && '(You)'}
        </span>
        {isHost && (
          <Badge variant="secondary" className="text-xs">Host</Badge>
        )}
      </div>

      <div className="absolute top-2 right-2 flex gap-1">
        {isMuted && (
          <div className="bg-red-500 p-1 rounded">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
        {isVideoOff && (
          <div className="bg-red-500 p-1 rounded">
            <VideoOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </Card>
  );
};

export function WebRTCMeetingClient({ meetingId, classId, userId, username, onEnd }: WebRTCMeetingClientProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, any>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [isWebRTCLoaded, setIsWebRTCLoaded] = useState(false);
  const [localStreamKey, setLocalStreamKey] = useState(0); // Force re-render of local video
  
  const webrtcManagerRef = useRef<any>(null);
  const WebRTCManagerClass = useRef<any>(null);
  const { toast } = useToast();
  const api = new PloneAPI();

  // Load WebRTC manager on client side only
  useEffect(() => {
    const loadWebRTCManager = async () => {
      try {
        const module = await import('@/lib/webrtc-manager');
        WebRTCManagerClass.current = module.WebRTCManager;
        setIsWebRTCLoaded(true);
      } catch (error) {
        console.error('Failed to load WebRTC manager:', error);
        toast({
          title: "Loading error",
          description: "Failed to load video meeting components",
          variant: "destructive",
        });
      }
    };

    loadWebRTCManager();
  }, [toast]);

  const handleParticipantJoined = useCallback((participant: any) => {
    console.log('👤 Participant joined:', participant.username, 'socketId:', participant.socketId);
    
    setParticipants(prev => {
      const updated = new Map(prev);
      // Ensure participant has proper stream state
      const participantWithState = {
        ...participant,
        videoEnabled: participant.stream?.video || false,
        audioEnabled: participant.stream?.audio || false
      };
      console.log('Adding participant to state:', participantWithState);
      updated.set(participant.socketId, participantWithState);
      console.log('Total participants now:', updated.size);
      return updated;
    });
    
    toast({
      title: "Participant joined",
      description: `${participant.username} has joined the meeting`,
    });
  }, [toast]);

  const handleParticipantLeft = useCallback((socketId: string) => {
    setParticipants(prev => {
      const updated = new Map(prev);
      const participant = updated.get(socketId);
      if (participant) {
        toast({
          title: "Participant left",
          description: `${participant.username} has left the meeting`,
        });
      }
      updated.delete(socketId);
      return updated;
    });
  }, [toast]);

  const handleStreamUpdated = useCallback((socketId: string, stream: MediaStream) => {
    // Validate that we have a proper MediaStream
    if (!(stream instanceof MediaStream)) {
      console.warn('Received invalid stream for participant:', socketId);
      return;
    }

    console.log('🎥 Stream updated for socketId:', socketId, 'Stream tracks:', stream.getTracks().length);

    // Check if this is our own stream (local stream update)
    if (socketId === 'local' || (webrtcManagerRef.current && socketId === webrtcManagerRef.current.getSocket()?.id)) {
      console.log('🎥 Updating local stream with new video track');
      setLocalStream(stream);
      setLocalStreamKey(prev => prev + 1); // Force re-render
      return;
    }

    setParticipants(prev => {
      const updated = new Map(prev);
      const participant = updated.get(socketId);
      if (participant) {
        console.log('✅ Updating stream for participant:', participant.username);
        participant.stream = stream;
        updated.set(socketId, { ...participant });
      } else {
        console.warn('❌ No participant found for socketId:', socketId);
        console.log('Current participants:', Array.from(prev.keys()));
      }
      return updated;
    });
  }, []);

  const handleRecordingStarted = useCallback(() => {
    setIsRecording(true);
    setRecordingStartTime(new Date());
    toast({
      title: "Recording started",
      description: "The meeting is now being recorded",
    });
  }, [toast]);

  const handleRecordingStopped = useCallback(() => {
    setIsRecording(false);
    toast({
      title: "Recording stopped",
      description: "The meeting recording has been saved",
    });
  }, [toast]);

  const handleParticipantUpdated = useCallback((participant: any) => {
    console.log('🔄 Participant updated:', participant.username, 'video:', participant.videoEnabled, 'audio:', participant.audioEnabled);
    setParticipants(prev => {
      const updated = new Map(prev);
      const existingParticipant = updated.get(participant.socketId);
      if (existingParticipant) {
        // Update the participant's enabled states
        updated.set(participant.socketId, {
          ...existingParticipant,
          videoEnabled: participant.videoEnabled,
          audioEnabled: participant.audioEnabled
        });
      }
      return updated;
    });
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('WebRTC Error:', error);
    toast({
      title: "Connection error",
      description: error.message,
      variant: "destructive",
    });
  }, [toast]);

  useEffect(() => {
    if (!isWebRTCLoaded || !WebRTCManagerClass.current) return;

    const signalingServerUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3001';
    
    const manager = new WebRTCManagerClass.current({
      signalingServerUrl,
      roomId: meetingId,
      userId,
      username,
      onParticipantJoined: handleParticipantJoined,
      onParticipantLeft: handleParticipantLeft,
      onStreamUpdated: handleStreamUpdated,
      onParticipantUpdated: handleParticipantUpdated,
      onRecordingStarted: handleRecordingStarted,
      onRecordingStopped: handleRecordingStopped,
      onError: handleError,
    });

    webrtcManagerRef.current = manager;

    const connectToMeeting = async () => {
      try {
        await manager.connect();
        const localStream = manager.getLocalStream();
        if (localStream && localStream instanceof MediaStream) {
          setLocalStream(localStream);
        } else {
          console.warn('No valid local stream available');
        }
        setIsConnecting(false);
      } catch (error) {
        console.error('Failed to connect to meeting:', error);
        setIsConnecting(false);
        toast({
          title: "Connection failed",
          description: "Failed to connect to the meeting. Please check your camera and microphone permissions.",
          variant: "destructive",
        });
      }
    };

    connectToMeeting();

    return () => {
      manager.disconnect();
    };
  }, [isWebRTCLoaded, meetingId, userId, username, handleParticipantJoined, handleParticipantLeft, handleStreamUpdated, handleRecordingStarted, handleRecordingStopped, handleError, toast]);

  const toggleVideo = async () => {
    if (webrtcManagerRef.current) {
      const newState = !isVideoEnabled;
      console.log('🎬 Toggling video from', isVideoEnabled, 'to', newState);
      await webrtcManagerRef.current.toggleVideo(newState);
      setIsVideoEnabled(newState);
      console.log('🎬 Video toggle completed, UI state updated to', newState);
    }
  };

  const toggleAudio = async () => {
    if (webrtcManagerRef.current) {
      const newState = !isAudioEnabled;
      await webrtcManagerRef.current.toggleAudio(newState);
      setIsAudioEnabled(newState);
    }
  };

  const downloadRecording = (recordingBlob: Blob, filename: string) => {
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleRecording = async () => {
    if (!webrtcManagerRef.current) return;

    try {
      if (!isRecording) {
        await webrtcManagerRef.current.startRecording();
      } else {
        setIsUploading(true);
        const recordingBlob = await webrtcManagerRef.current.stopRecording();
        
        // Try to upload recording to Plone
        if (classId && recordingStartTime) {
          const endTime = new Date();
          const duration = Math.floor((endTime.getTime() - recordingStartTime.getTime()) / 1000);
          
          try {
            // Test if recording upload is possible before attempting
            const uploadTest = await api.testRecordingUpload(meetingId, classId);
            
            if (!uploadTest.canUpload) {
              const errorDetails = uploadTest.errors.join('; ');
              console.error('Recording upload test failed:', uploadTest);
              throw new Error(`Cannot upload recording: ${errorDetails}`);
            }
            
            console.log('Recording upload test passed:', uploadTest.details);
            
            await api.uploadMeetingRecording(meetingId, classId, recordingBlob, {
              duration,
              startTime: recordingStartTime.toISOString(),
              endTime: endTime.toISOString(),
              participantCount: participants.size + 1 // +1 for local user
            });
            
            toast({
              title: "Recording uploaded",
              description: "The recording has been saved to the class",
            });
          } catch (uploadError) {
            console.error('Upload failed, offering download:', uploadError);
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `meeting-${meetingId}-${timestamp}.webm`;
            
            // Download the recording as fallback
            downloadRecording(recordingBlob, filename);
            
            // Show more specific error message
            const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error occurred';
            toast({
              title: "Upload failed - Downloaded instead",
              description: `${errorMessage}. Recording saved as ${filename}`,
              variant: "destructive",
            });
          }
        } else {
          // No classId, just download
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `meeting-${meetingId}-${timestamp}.webm`;
          downloadRecording(recordingBlob, filename);
          
          toast({
            title: "Recording downloaded",
            description: `Recording saved as ${filename}`,
          });
        }
        
        setIsUploading(false);
        setRecordingStartTime(null);
      }
    } catch (error) {
      console.error('Recording error:', error);
      toast({
        title: "Recording error",
        description: error instanceof Error ? error.message : "Failed to handle recording",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  };

  const switchCamera = async () => {
    if (webrtcManagerRef.current) {
      try {
        await webrtcManagerRef.current.switchCamera();
        toast({
          title: "Camera switched",
          description: "Switched to the other camera",
        });
      } catch (error) {
        toast({
          title: "Camera switch failed",
          description: "Failed to switch camera",
          variant: "destructive",
        });
      }
    }
  };

  const endMeeting = () => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.disconnect();
    }
    onEnd?.();
  };

  const getVideoGridLayout = () => {
    const totalParticipants = participants.size + 1; // +1 for local user
    
    if (totalParticipants <= 1) return 'grid-cols-1';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  if (isConnecting || !isWebRTCLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-lg">Connecting to meeting...</p>
            <p className="text-sm text-muted-foreground">
              Please allow camera and microphone access when prompted
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const isHost = webrtcManagerRef.current?.isHostUser() || false;

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className={cn(
          "grid gap-4 h-full",
          getVideoGridLayout()
        )}>
          {/* Local Video */}
          <VideoGridItem
            key={`local-${localStreamKey}`}
            stream={localStream && localStream instanceof MediaStream ? localStream : undefined}
            username={username}
            isLocal
            isMuted={!isAudioEnabled}
            isVideoOff={!isVideoEnabled}
            isHost={isHost}
          />
          
          {/* Remote Participants */}
          {Array.from(participants.values()).map(participant => {
            const hasValidStream = participant.stream && participant.stream instanceof MediaStream;
            const trackCount = hasValidStream ? participant.stream.getTracks().length : 0;
            console.log('🎬 Rendering participant:', participant.username, 'hasStream:', hasValidStream, 'streamTracks:', trackCount);
            return (
              <VideoGridItem
                key={participant.socketId}
                stream={hasValidStream ? participant.stream : undefined}
                username={participant.username}
                isMuted={!participant.audioEnabled}
                isVideoOff={!participant.videoEnabled}
                isHost={false}
              />
            );
          })}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-center gap-4 p-4">
          {/* Audio Toggle */}
          <Button
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="icon"
            onClick={toggleAudio}
            className="rounded-full"
          >
            {isAudioEnabled ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </Button>

          {/* Video Toggle */}
          <Button
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="icon"
            onClick={toggleVideo}
            className="rounded-full"
          >
            {isVideoEnabled ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </Button>

          {/* Camera Switch */}
          <Button
            variant="secondary"
            size="icon"
            onClick={switchCamera}
            className="rounded-full"
          >
            <Camera className="w-5 h-5" />
          </Button>

          {/* Recording (Host Only) */}
          {isHost && (
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleRecording}
              disabled={isUploading}
              className="rounded-full relative"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {isRecording && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </>
              )}
            </Button>
          )}

          {/* Settings Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Settings className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Users className="w-4 h-4 mr-2" />
                {participants.size + 1} Participants
              </DropdownMenuItem>
              {isHost && (
                <DropdownMenuItem className="text-blue-600">
                  <Badge className="mr-2" variant="secondary">Host</Badge>
                  You are the host
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* End Call */}
          <Button
            variant="destructive"
            size="icon"
            onClick={endMeeting}
            className="rounded-full ml-8"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="text-center pb-2">
            <Badge variant="destructive" className="animate-pulse">
              Recording in progress...
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
} 