'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PloneAPI } from '@/lib/api';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with WebRTC
const WebRTCMeetingClient = dynamic(() => import('@/components/webrtc-meeting-client').then(mod => ({ default: mod.WebRTCMeetingClient })), { 
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-lg text-white">Loading meeting...</p>
      </div>
    </div>
  )
});

const api = new PloneAPI();

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetingId = params.meetingId as string;
  const classId = searchParams.get('classId') || undefined;
  
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleMeetingEnd = () => {
    router.push('/dashboard');
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
    <WebRTCMeetingClient
      meetingId={meetingId}
      classId={classId}
      userId={user.username}
      username={user.fullname || user.username}
      onEnd={handleMeetingEnd}
    />
  );
} 