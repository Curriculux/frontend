'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Video, Loader2 } from 'lucide-react';
import { PloneAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const api = new PloneAPI();

interface VirtualMeetingButtonProps {
  classId?: string;
  className?: string;
}

export function VirtualMeetingButton({ classId, className }: VirtualMeetingButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [meetingData, setMeetingData] = useState({
    title: '',
    description: '',
    duration: 60,
    autoRecord: false,
  });

  const handleCreateMeeting = async () => {
    if (!meetingData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a meeting title",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    
    try {
      const meeting = await api.createMeeting({
        title: meetingData.title,
        description: meetingData.description,
        startTime: new Date().toISOString(),
        duration: meetingData.duration,
        meetingType: classId ? 'class' : 'meeting',
        classId: classId,
        autoRecord: meetingData.autoRecord,
      });

      toast({
        title: "Meeting created",
        description: "Your virtual meeting is ready to start",
      });

      // Navigate to the meeting page
      router.push(`/meeting/${meeting.id}${classId ? `?classId=${classId}` : ''}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Error",
        description: "Failed to create meeting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
      setShowDialog(false);
    }
  };

  const handleQuickStart = async () => {
    setCreating(true);
    
    try {
      const meeting = await api.createMeeting({
        title: `Quick Meeting - ${new Date().toLocaleString()}`,
        description: 'Instant meeting',
        startTime: new Date().toISOString(),
        duration: 60,
        meetingType: classId ? 'class' : 'meeting',
        classId: classId,
        autoRecord: false,
      });

      toast({
        title: "Meeting started",
        description: "Joining your meeting...",
      });

      // Navigate to the meeting page
      router.push(`/meeting/${meeting.id}${classId ? `?classId=${classId}` : ''}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Error",
        description: "Failed to start meeting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        disabled={creating}
        className={className}
        variant="default"
      >
        {creating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Video className="mr-2 h-4 w-4" />
            Start Meeting
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Start Virtual Meeting</DialogTitle>
            <DialogDescription>
              Create a new video meeting. You can start instantly or customize the settings.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Meeting Title</Label>
              <Input
                id="title"
                placeholder="e.g., Math Class - Chapter 5"
                value={meetingData.title}
                onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What will be covered in this meeting?"
                rows={3}
                value={meetingData.description}
                onChange={(e) => setMeetingData({ ...meetingData, description: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                max="480"
                value={meetingData.duration}
                onChange={(e) => setMeetingData({ ...meetingData, duration: parseInt(e.target.value) || 60 })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="autoRecord" className="flex-1">
                Auto-record meeting
                <p className="text-sm text-muted-foreground">
                  Automatically start recording when the meeting begins
                </p>
              </Label>
              <Switch
                checked={meetingData.autoRecord}
                onCheckedChange={(checked) => setMeetingData({ ...meetingData, autoRecord: checked })}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleQuickStart}
              disabled={creating}
            >
              Quick Start
            </Button>
            <Button
              onClick={handleCreateMeeting}
              disabled={creating || !meetingData.title.trim()}
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Meeting'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 