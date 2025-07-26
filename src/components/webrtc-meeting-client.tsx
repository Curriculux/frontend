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
  Loader2,
  PenTool,
  X,
  SwitchCamera,
  Circle,
  Square
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
import { InteractiveWhiteboard } from './interactive-whiteboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WebRTCManager } from '@/lib/webrtc-manager';
import { io } from 'socket.io-client';



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

interface Participant {
  socketId: string;
  username: string;
  stream?: MediaStream;
  videoEnabled: boolean;
  audioEnabled: boolean;
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
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localStreamKey, setLocalStreamKey] = useState(0);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [isWebRTCLoaded, setIsWebRTCLoaded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Whiteboard collaboration state
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const [whiteboardHost, setWhiteboardHost] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  
  // Use refs for remote events to avoid unnecessary re-renders
  const remoteDrawingEventRef = useRef<any>(null);
  const remoteClearEventRef = useRef<number>(0);
  const remoteUndoEventRef = useRef<number>(0);
  const whiteboardRef = useRef<any>(null);

  const webrtcManagerRef = useRef<any>(null);
  const webrtcManagerClassRef = useRef<any>(null);
  const { toast } = useToast();
  const api = new PloneAPI();

  // Load WebRTC manager on client side only
  useEffect(() => {
    const loadWebRTCManager = async () => {
      try {
        const module = await import('@/lib/webrtc-manager');
        // Store the WebRTCManager class for later instantiation
        webrtcManagerClassRef.current = module.WebRTCManager;
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
    // setRecordingStartTime(new Date()); // This line is removed
    toast({
      title: "Recording started",
      description: "The meeting is now being recorded",
    });
  }, [toast]);

  const handleRecordingStopped = useCallback(() => {
    setIsRecording(false);
  }, []);

  // Whiteboard collaboration handlers
  const handleWhiteboardStateChanged = useCallback((active: boolean, hostName?: string) => {
    console.log('🎨 Whiteboard state changed:', { active, hostName, currentUser: username });
    setWhiteboardActive(active);
    setWhiteboardHost(hostName || null);
    
    if (active && hostName) {
      console.log('✅ Showing whiteboard for all participants');
      toast({
        title: "Whiteboard started",
        description: `${hostName} is sharing their whiteboard`,
      });
      
      // Show whiteboard for ALL participants when it becomes active
      setShowWhiteboard(true);
    } else {
      console.log('❌ Hiding whiteboard for all participants');
      toast({
        title: "Whiteboard stopped", 
        description: "Whiteboard sharing has ended",
      });
      
      // Hide whiteboard for ALL participants when it stops
      setShowWhiteboard(false);
    }
  }, [username, toast]);

  const handleWhiteboardDrawUpdate = useCallback((drawingData: any) => {
    // Store the remote drawing event to trigger updates in the whiteboard
    console.log('📝 Received remote drawing event:', drawingData);
    remoteDrawingEventRef.current = drawingData;
    // Call the whiteboard method directly if available
    if (whiteboardRef.current?.handleRemoteDrawing) {
      whiteboardRef.current.handleRemoteDrawing(drawingData);
    }
  }, []);

  const handleWhiteboardCleared = useCallback(() => {
    // Trigger a clear event by incrementing the counter
    console.log('🧹 Received remote clear event');
    remoteClearEventRef.current += 1;
    // Call the whiteboard method directly if available
    if (whiteboardRef.current?.handleRemoteClear) {
      whiteboardRef.current.handleRemoteClear();
    }
  }, []);

  const handleWhiteboardUndo = useCallback(() => {
    // Trigger an undo event by incrementing the counter
    console.log('↩️ Received remote undo event');
    remoteUndoEventRef.current += 1;
    // Call the whiteboard method directly if available
    if (whiteboardRef.current?.handleRemoteUndo) {
      whiteboardRef.current.handleRemoteUndo();
    }
  }, []);

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
    if (!isWebRTCLoaded || !webrtcManagerClassRef.current) return;

    const signalingServerUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3001';
    
    const WebRTCManagerClass = webrtcManagerClassRef.current;
    const manager = new WebRTCManagerClass({
      signalingServerUrl,
      roomId: meetingId,
      userId,
      username,
      onParticipantJoined: handleParticipantJoined,
      onParticipantLeft: handleParticipantLeft,
      onStreamUpdated: handleStreamUpdated,
      onError: handleError,
      onRecordingStatusChanged: (isRecording: boolean) => {
        if (isRecording) {
          handleRecordingStarted();
        } else {
          handleRecordingStopped();
        }
      },
      onWhiteboardStateChanged: handleWhiteboardStateChanged,
      onWhiteboardDrawUpdate: handleWhiteboardDrawUpdate,
      onWhiteboardCleared: handleWhiteboardCleared,
      onWhiteboardUndo: handleWhiteboardUndo,
    });

    // Store the manager instance
    webrtcManagerRef.current = manager;

    const connectToMeeting = async () => {
      try {
        console.log('🚀 Starting WebRTC connection...', {
          signalingServerUrl,
          roomId: meetingId,
          userId,
          username
        });
        
        await manager.connect();
        console.log('✅ WebRTC manager connected successfully');
        
        const localStream = manager.getLocalStream();
        console.log('🎥 Local stream:', localStream);
        
        if (localStream && localStream instanceof MediaStream) {
          setLocalStream(localStream);
          console.log('✅ Local stream set successfully');
        } else {
          console.warn('⚠️ No valid local stream available');
        }
        setIsConnecting(false);
        console.log('✅ Connection complete, no longer connecting');
      } catch (error) {
        console.error('❌ Failed to connect to meeting:', error);
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
    // Validate that we have a proper Blob
    if (!recordingBlob || !(recordingBlob instanceof Blob)) {
      console.error('Invalid recording blob:', recordingBlob);
      toast({
        title: "Download failed",
        description: "Recording data is invalid or corrupted",
        variant: "destructive",
      });
      return;
    }

    if (recordingBlob.size === 0) {
      console.error('Recording blob is empty');
      toast({
        title: "Download failed", 
        description: "Recording is empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = URL.createObjectURL(recordingBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating download URL:', error);
      toast({
        title: "Download failed",
        description: "Could not create download link",
        variant: "destructive",
      });
    }
  };

  const toggleRecording = async () => {
    if (!webrtcManagerRef.current) return;

    try {
      if (!isRecording) {
        setRecordingStartTime(new Date());
        await webrtcManagerRef.current.startRecording();
      } else {
        setIsUploading(true);
        const recordingBlob = await webrtcManagerRef.current.stopRecording();
        
        // Validate the recording blob
        if (!recordingBlob || !(recordingBlob instanceof Blob) || recordingBlob.size === 0) {
          console.error('Invalid or empty recording blob:', recordingBlob);
          toast({
            title: "Recording failed",
            description: "No recording data was captured",
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }

        console.log('Recording stopped successfully, blob size:', recordingBlob.size);
        
        // Debug upload conditions
        console.log('Upload conditions:', {
          hasClassId: !!classId,
          hasRecordingStartTime: !!recordingStartTime,
          classId,
          recordingStartTime: recordingStartTime?.toISOString()
        });
        
        // Try to upload recording to Plone
        if (classId && recordingStartTime) {
          console.log('✅ Starting upload process...');
          const endTime = new Date();
          const duration = Math.floor((endTime.getTime() - recordingStartTime.getTime()) / 1000);
          
          try {
            // Test if recording upload is possible before attempting
            console.log('🧪 Testing recording upload capability...');
            const uploadTest = await api.testRecordingUpload(meetingId, classId);
            console.log('📋 Upload test result:', uploadTest);
            
            if (!uploadTest.canUpload) {
              const errorDetails = uploadTest.errors.join('; ');
              console.error('❌ Recording upload test failed:', uploadTest);
              throw new Error(`Cannot upload recording: ${errorDetails}`);
            }
            
            console.log('✅ Recording upload test passed:', uploadTest.details);
            
            console.log('📤 Starting recording upload...');
            const uploadResult = await api.uploadMeetingRecording(meetingId, classId, recordingBlob, {
              duration,
              startTime: recordingStartTime.toISOString(),
              endTime: endTime.toISOString(),
              participantCount: participants.size + 1 // +1 for local user
            });
            
            console.log('✅ Recording uploaded successfully:', uploadResult);
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
          // No classId or recordingStartTime, just download
          console.log('⬇️ No upload conditions met, downloading recording instead');
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

  const handleWhiteboardSave = async (dataUrl: string) => {
    if (!classId) {
      toast({
        title: "Cannot save whiteboard",
        description: "No class associated with this meeting",
        variant: "destructive"
      });
      return;
    }

    try {
      await api.saveWhiteboard(classId, {
        title: `Whiteboard from ${new Date().toLocaleString()}`,
        dataUrl,
        description: `Created during meeting: ${meetingId}`
      });
      
      toast({
        title: "Whiteboard saved",
        description: "The whiteboard has been saved to the class",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Failed to save whiteboard to class",
        variant: "destructive"
      });
    }
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

  console.log('🖼️ Render state:', { showWhiteboard, whiteboardActive, isHost });

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Whiteboard Overlay Mode */}
      {(showWhiteboard || whiteboardActive) ? (
        <div className="h-full flex">
          {/* Main Whiteboard Area */}
          <div className="flex-1 flex flex-col">
            {/* Whiteboard Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-white text-xl font-semibold">Meeting Whiteboard</h2>
                  <Badge variant="secondary">Shared Screen</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWhiteboard(false)}
                    className="text-white border-gray-600 hover:bg-gray-700"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Stop Sharing
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Whiteboard Canvas */}
            <div className="flex-1 bg-white">
              <InteractiveWhiteboard 
                ref={whiteboardRef}
                className="h-full w-full"
                height="100%"
                onSave={handleWhiteboardSave}
                webrtcManager={webrtcManagerRef.current}
                isCollaborative={true}
                isHost={isHost}
                onDrawingEvent={handleWhiteboardDrawUpdate}
                onClearEvent={handleWhiteboardCleared}
                onUndoEvent={handleWhiteboardUndo}
              />
            </div>
          </div>
          
          {/* Video Sidebar - Zoom-style thumbnails */}
          <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white text-sm font-medium">Participants ({participants.size + 1})</h3>
            </div>
            
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {/* Local Video Thumbnail */}
              <div className="relative">
                <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                  {localStream && localStream instanceof MediaStream && isVideoEnabled ? (
                    <video
                      ref={(video) => {
                        if (video && localStream) {
                          video.srcObject = localStream;
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-1 rounded-full bg-gray-700 flex items-center justify-center">
                          <span className="text-lg font-semibold text-gray-300">
                            {username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{username} (You)</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                  {!isAudioEnabled && <MicOff className="w-3 h-3 text-red-400" />}
                  {!isVideoEnabled && <VideoOff className="w-3 h-3 text-red-400" />}
                  {isHost && <Badge variant="secondary" className="text-xs">Host</Badge>}
                </div>
              </div>
              
              {/* Remote Participants Thumbnails */}
              {Array.from(participants.values()).map((participant) => (
                <div key={participant.socketId} className="relative">
                  <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                    {participant.stream && participant.videoEnabled ? (
                      <video
                        ref={(video) => {
                          if (video && participant.stream) {
                            video.srcObject = participant.stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-12 h-12 mx-auto mb-1 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-lg font-semibold text-gray-300">
                              {participant.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{participant.username}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    {!participant.audioEnabled && <MicOff className="w-3 h-3 text-red-400" />}
                    {!participant.videoEnabled && <VideoOff className="w-3 h-3 text-red-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Normal Video Grid Mode */}
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
              {Array.from(participants.values()).map((participant) => (
                <VideoGridItem
                  key={participant.socketId}
                  stream={participant.stream}
                  username={participant.username}
                  isLocal={false}
                  isMuted={!participant.audioEnabled}
                  isVideoOff={!participant.videoEnabled}
                  isHost={false}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Controls Bar */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex justify-center gap-4">
          <Button
            variant={isAudioEnabled ? "default" : "destructive"}
            size="lg"
            onClick={toggleAudio}
            className="w-14 h-14 rounded-full"
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </Button>

          <Button
            variant={isVideoEnabled ? "default" : "destructive"}
            size="lg"
            onClick={toggleVideo}
            className="w-14 h-14 rounded-full"
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>

          {/* Record Button */}
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="lg"
            onClick={toggleRecording}
            disabled={isUploading}
            className="w-14 h-14 rounded-full"
          >
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isRecording ? (
              <Square className="w-6 h-6" />
            ) : (
              <Circle className="w-6 h-6" />
            )}
          </Button>

          {/* Whiteboard Button */}
          {isHost && (
            <Button
              variant={showWhiteboard ? "secondary" : "outline"}
              size="lg"
              onClick={() => {
                console.log('🎨 Whiteboard button clicked:', { showWhiteboard, whiteboardActive, isHost });
                if (showWhiteboard || whiteboardActive) {
                  console.log('🛑 Stopping whiteboard');
                  // Stop whiteboard sharing
                  webrtcManagerRef.current?.stopWhiteboard();
                  // Immediately hide for host, server event will handle others
                  setShowWhiteboard(false);
                } else {
                  console.log('▶️ Starting whiteboard');
                  // Start whiteboard sharing
                  webrtcManagerRef.current?.startWhiteboard();
                  // Immediately show for host, server event will handle others
                  setShowWhiteboard(true);
                }
              }}
              className="w-14 h-14 rounded-full"
            >
              <PenTool className="w-6 h-6" />
            </Button>
          )}

          <Button
            variant="outline"
            size="lg"
            onClick={switchCamera}
            className="w-14 h-14 rounded-full"
          >
            <SwitchCamera className="w-6 h-6" />
          </Button>

          <Button
            variant="destructive"
            size="lg"
            onClick={endMeeting}
            className="w-14 h-14 rounded-full"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
} 