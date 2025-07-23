'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { JitsiMeeting } from '@jitsi/react-sdk';
import type { IJitsiMeetExternalApi } from '@jitsi/react-sdk/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Users, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { PloneAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const api = new PloneAPI();

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const meetingId = params.meetingId as string;
  const classId = searchParams.get('classId') || undefined;
  
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const apiRef = useRef<IJitsiMeetExternalApi | null>(null);

  useEffect(() => {
    loadMeetingData();
  }, [meetingId, classId]);

  const loadMeetingData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const currentUser = await api.getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);

      // Get meeting details
      const meetingData = await api.getMeeting(meetingId, classId);
      if (!meetingData) {
        throw new Error('Meeting not found');
      }
      
      // Check if user has permission to join
      const userRoles = currentUser.roles || [];
      const isTeacherOrAdmin = userRoles.some((role: string) => 
        ['Manager', 'Site Administrator', 'Teacher'].includes(role)
      );
      
      if (!isTeacherOrAdmin && meetingData.classId) {
        // Check if student is enrolled in the class
        const userClasses = await api.getStudentClasses(currentUser.username);
        const isEnrolled = userClasses.some(cls => cls['@id'].includes(meetingData.classId!));
        
        if (!isEnrolled) {
          throw new Error('You are not enrolled in this class');
        }
      }
      
      setMeeting(meetingData);
      setError(null);
    } catch (err) {
      console.error('Error loading meeting:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleJitsiApi = useCallback((jitsiApi: IJitsiMeetExternalApi) => {
    apiRef.current = jitsiApi;
    
    // Set up event listeners
    jitsiApi.addEventListener('videoConferenceJoined', () => {
      setIsInMeeting(true);
      console.log('Successfully joined video conference');
      toast({
        title: "Joined meeting",
        description: "You have successfully joined the meeting",
      });
    });

    jitsiApi.addEventListener('participantJoined', ((participant: any) => {
      console.log('Participant joined:', participant);
      toast({
        title: "Someone joined",
        description: `${participant.displayName || 'A participant'} joined the meeting`,
      });
    }) as any);

    jitsiApi.addEventListener('participantLeft', ((participant: any) => {
      console.log('Participant left:', participant);
      toast({
        title: "Someone left",
        description: `${participant.displayName || 'A participant'} left the meeting`,
      });
    }) as any);

    jitsiApi.addEventListener('videoConferenceLeft', () => {
      setIsInMeeting(false);
      if (isRecording && recordingStartTime) {
        handleRecordingStopped();
      }
    });

    jitsiApi.addEventListener('recordingStatusChanged', ((status: any) => {
      if (status.on) {
        setIsRecording(true);
        setRecordingStartTime(new Date());
        toast({
          title: "Recording started",
          description: "The meeting is now being recorded",
        });
      } else if (isRecording && recordingStartTime) {
        handleRecordingStopped();
      }
    }) as any);

    // Auto-start recording if configured
    if (meeting?.autoRecord && (user?.roles?.includes('Teacher') || user?.roles?.includes('Manager'))) {
      setTimeout(() => {
        jitsiApi.executeCommand('startRecording', {
          mode: 'file',
          shouldShare: false
        });
      }, 5000); // Wait 5 seconds after joining
    }
  }, [meeting, user, isRecording, recordingStartTime]);

  const handleRecordingStopped = async () => {
    if (!recordingStartTime) return;
    
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - recordingStartTime.getTime()) / 1000 / 60); // minutes
    
    try {
      // Update meeting with recording metadata
      const meetingPath = meeting.classId ? `classes/${meeting.classId}/meetings/${meetingId}` : `meetings/${meetingId}`;
      const response = await fetch(`/api/plone/${meetingPath}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`
        },
        body: JSON.stringify({
          recordingId: `recording_${meetingId}_${Date.now()}`,
          description: meeting.description + `\n\n[RECORDING_METADATA]${JSON.stringify({
            startTime: recordingStartTime.toISOString(),
            endTime: endTime.toISOString(),
            duration,
            recordedBy: user.username
          })}[/RECORDING_METADATA]`
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update meeting');
      }
      
      toast({
        title: "Recording saved",
        description: `Recording duration: ${duration} minutes`,
      });
    } catch (err) {
      console.error('Error saving recording metadata:', err);
      toast({
        title: "Recording error",
        description: "Failed to save recording metadata",
        variant: "destructive",
      });
    } finally {
      setIsRecording(false);
      setRecordingStartTime(null);
    }
  };

  const getJitsiConfig = () => {
    const userDisplayName = user?.fullname || user?.username || 'Guest';
    const isTeacher = user?.roles?.some((role: string) => 
      ['Manager', 'Site Administrator', 'Teacher'].includes(role)
    );

    // Use a consistent room name so all participants join the same room
    const roomName = `cirriculux-${meetingId}`;
    
    console.log(`Joining video room: ${roomName}`);
    console.log(`Meeting ID: ${meetingId}, Class ID: ${classId}`);
    
    const config: any = {
      roomName: roomName,
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableModeratorIndicator: false,
        enableEmailInStats: false,
        enableWelcomePage: false,
        prejoinPageEnabled: false, // Disable prejoin for moderators
        startAudioOnly: false,
        startScreenSharing: false,
        disableThirdPartyRequests: true,
        disableLocalVideoFlip: false,
        backgroundAlpha: 0.5,
        defaultLanguage: 'en',
        enableClosePage: false,
        hideConferenceSubject: false,
        hideConferenceTimer: false,
        hideParticipantsStats: false,
        makeJsonParserHappy: 'even if last key had a trailing comma',
        requireDisplayName: true,
        enableNoisyMicDetection: true,
        enableTalkWhileMuted: true,
        resolution: 720,
        // Moderator settings
        disableDeepLinking: true,
        disableInviteFunctions: !isTeacher, // Only teachers can invite
        enableUserRolesBasedOnToken: false,
        enableInsecureRoomNameWarning: false,
        constraints: {
          video: {
            height: {
              ideal: 720,
              max: 720,
              min: 240
            }
          }
        },
        recordingService: {
          enabled: true,
          sharingEnabled: false
        },
        liveStreamingEnabled: false,
        fileRecordingsEnabled: true,
        localRecording: {
          enabled: true,
          format: 'webm'
        },
        toolbarButtons: [
          'camera',
          'desktop',
          'microphone',
          'participants-pane',
          'chat',
          'raisehand',
          'tileview',
          'select-background',
          'recording',
          'hangup'
        ]
      },
      interfaceConfigOverwrite: {
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
        MOBILE_APP_PROMO: false,
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#1e293b',
        TOOLBAR_BUTTONS: [
          'microphone',
          'camera',
          'desktop',
          'participants',
          'chat',
          'raisehand',
          'tileview',
          'select-background',
          isTeacher ? 'recording' : null,
          'hangup'
        ].filter(Boolean),
        SETTINGS_SECTIONS: ['devices', 'language', 'moderator'],
        VIDEO_LAYOUT_FIT: 'both',
        VERTICAL_FILMSTRIP: true,
        FILM_STRIP_MAX_HEIGHT: 120,
        DISABLE_FOCUS_INDICATOR: false,
        TOOLBAR_ALWAYS_VISIBLE: true,
        GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
        DISPLAY_WELCOME_FOOTER: false,
        DISPLAY_WELCOME_PAGE_ADDITIONAL_CARD: false,
        DISPLAY_WELCOME_PAGE_CONTENT: false,
        DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false
      },
      userInfo: {
        displayName: userDisplayName,
        email: user?.email,
        moderator: isTeacher // Grant moderator privileges to teachers/admins
      },
      onApiReady: handleJitsiApi
    };
    
    return config;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!meeting || !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Properly dispose of the Jitsi meeting
                if (apiRef.current) {
                  apiRef.current.dispose();
                }
                
                // Navigate back to dashboard
                router.push('/dashboard');
              }}
              className="text-gray-300 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Leave Meeting
            </Button>
            <div className="text-white">
              <h1 className="text-xl font-semibold">{meeting.title}</h1>
              <p className="text-sm text-gray-400">{meeting.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isRecording && (
              <div className="flex items-center space-x-2 text-red-500">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Recording</span>
              </div>
            )}
            <div className="flex items-center space-x-2 text-gray-300">
              <Users className="h-5 w-5" />
              <span className="text-sm">
                {apiRef.current?.getParticipantsInfo?.()?.length || 0} participants
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Video Conference */}
      <div className="flex-1 relative">
        <JitsiMeeting
          domain="jitsi.riot.im"
          {...getJitsiConfig()}
          getIFrameRef={(iframeRef) => {
            if (iframeRef) {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
            }
          }}
        />
      </div>
    </div>
  );
} 