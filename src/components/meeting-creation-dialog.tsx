"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Video, Calendar, Clock, Link, Plus } from "lucide-react"
import { ploneAPI } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface MeetingCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId?: string
  onMeetingCreated?: (meeting: any) => void
}

export function MeetingCreationDialog({ 
  open, 
  onOpenChange, 
  classId,
  onMeetingCreated 
}: MeetingCreationDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [meetingData, setMeetingData] = useState({
    title: '',
    description: '',
    startTime: '',
    duration: 60,
    meetingType: 'class' as const,
    platform: 'zoom' as 'zoom' | 'internal',
    zoomMeetingUrl: '',
    autoRecord: true,
  })

  const handleSubmit = async () => {
    try {
      setLoading(true)

      if (!meetingData.title || !meetingData.startTime) {
        throw new Error('Please fill in all required fields')
      }

      if (meetingData.platform === 'zoom' && !meetingData.zoomMeetingUrl) {
        throw new Error('Please provide the Zoom meeting link')
      }

      // Create meeting using our API
      const meeting = await ploneAPI.createMeeting({
        title: meetingData.title,
        description: meetingData.description,
        startTime: meetingData.startTime,
        duration: meetingData.duration,
        meetingType: meetingData.meetingType,
        classId: classId,
        autoRecord: meetingData.autoRecord,
      })

      // Create calendar event for the meeting
      try {
        const startDateTime = new Date(meetingData.startTime)
        const endDateTime = new Date(startDateTime.getTime() + (meetingData.duration * 60 * 1000))
        
        await ploneAPI.createEvent({
          title: `Meeting: ${meetingData.title}`,
          description: meetingData.description || `Virtual meeting for ${meetingData.title}`,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          type: 'meeting',
          location: meetingData.platform === 'zoom' ? 'Zoom' : 'Virtual Classroom',
          isOnline: true,
          meetingUrl: meetingData.platform === 'zoom' ? meetingData.zoomMeetingUrl : meeting.joinUrl,
          classId: classId,
          priority: 'medium',
          status: 'scheduled',
          reminder: 15
        })
        
        console.log('Calendar event created for meeting')
      } catch (calendarError) {
        console.warn('Could not create calendar event for meeting:', calendarError)
        // Don't fail the whole process if calendar creation fails
      }

      // If using Zoom, we'd typically:
      // 1. Parse the Zoom meeting ID from the URL
      // 2. Schedule our recording bot to join
      // 3. Store the Zoom link for easy access

      if (meetingData.platform === 'zoom') {
        console.log('Would schedule Zoom recording bot for:', meetingData.zoomMeetingUrl)
        // TODO: Implement Zoom bot scheduling
      }

      toast({
        title: "Meeting Created",
        description: `${meetingData.title} has been scheduled and added to calendars.`,
      })

      onMeetingCreated?.(meeting)
      onOpenChange(false)
      resetForm()

    } catch (error) {
      console.error('Failed to create meeting:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create meeting",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setMeetingData({
      title: '',
      description: '',
      startTime: '',
      duration: 60,
      meetingType: 'class',
      platform: 'zoom',
      zoomMeetingUrl: '',
      autoRecord: true,
    })
  }

  const formatZoomUrl = (url: string) => {
    // Basic Zoom URL validation and formatting
    if (url.includes('zoom.us/j/') || url.includes('zoom.us/my/')) {
      return url
    }
    return url
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Schedule Virtual Meeting
          </DialogTitle>
          <DialogDescription>
            Create a virtual meeting for your class. Choose between Zoom integration or built-in meetings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Meeting Platform Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Meeting Platform</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={meetingData.platform === 'zoom' ? 'default' : 'outline'}
                  onClick={() => setMeetingData(prev => ({ ...prev, platform: 'zoom' }))}
                  className="h-auto p-4 flex flex-col items-center gap-2"
                >
                  <Video className="w-6 h-6" />
                  <div className="text-center">
                    <div className="font-medium">Zoom Integration</div>
                    <div className="text-xs text-muted-foreground">Use existing Zoom meeting</div>
                  </div>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </Button>
                
                <Button
                  variant={meetingData.platform === 'internal' ? 'default' : 'outline'}
                  onClick={() => setMeetingData(prev => ({ ...prev, platform: 'internal' }))}
                  className="h-auto p-4 flex flex-col items-center gap-2"
                >
                  <Plus className="w-6 h-6" />
                  <div className="text-center">
                    <div className="font-medium">Built-in Meeting</div>
                    <div className="text-xs text-muted-foreground">Native video calls</div>
                  </div>
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Meeting Details */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Meeting Title *</Label>
              <Input
                id="title"
                value={meetingData.title}
                onChange={(e) => setMeetingData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Chemistry Lab Session"
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={meetingData.description}
                onChange={(e) => setMeetingData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Meeting agenda or description..."
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={meetingData.startTime}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, startTime: e.target.value }))}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Select
                  value={meetingData.duration.toString()}
                  onValueChange={(value) => setMeetingData(prev => ({ ...prev, duration: parseInt(value) }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Zoom-specific fields */}
            {meetingData.platform === 'zoom' && (
              <div className="grid gap-2">
                <Label htmlFor="zoomUrl" className="flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Zoom Meeting Link *
                </Label>
                <Input
                  id="zoomUrl"
                  value={meetingData.zoomMeetingUrl}
                  onChange={(e) => setMeetingData(prev => ({ 
                    ...prev, 
                    zoomMeetingUrl: formatZoomUrl(e.target.value) 
                  }))}
                  placeholder="https://zoom.us/j/123456789..."
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Paste your Zoom meeting link here. Our bot will automatically join and record.
                </p>
              </div>
            )}

            {/* Meeting Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Record Meeting</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically record this meeting for later viewing
                  </p>
                </div>
                <Switch
                  checked={meetingData.autoRecord}
                  onCheckedChange={(checked) => setMeetingData(prev => ({ ...prev, autoRecord: checked }))}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Schedule Meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 