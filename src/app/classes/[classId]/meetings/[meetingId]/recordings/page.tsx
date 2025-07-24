'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PloneAPI } from '@/lib/api';
import { RecordingsViewer } from '@/components/recordings-viewer';

const api = new PloneAPI();

export default function MeetingRecordingsPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const meetingId = params.meetingId as string;
  
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
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

      // Get meeting details
      const meetingData = await api.getMeeting(meetingId, classId);
      if (!meetingData) {
        throw new Error('Meeting not found');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
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

  if (!meeting) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <h1 className="text-2xl font-bold">Meeting Recordings</h1>
        <p className="text-muted-foreground">
          View and download recordings from this meeting
        </p>
      </div>

      <RecordingsViewer 
        meetingId={meetingId}
        classId={classId}
        meetingTitle={meeting.title}
      />
    </div>
  );
} 