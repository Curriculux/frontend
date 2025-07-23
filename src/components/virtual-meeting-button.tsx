"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Video, Calendar, Users, Circle, Clock, Link, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'

interface VirtualMeetingButtonProps {
  classId?: string
  defaultTitle?: string
  onMeetingCreated?: (meeting: any) => void
}

export function VirtualMeetingButton({ 
  classId, 
  defaultTitle = "Virtual Class Meeting",
  onMeetingCreated 
}: VirtualMeetingButtonProps) {
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [meetingData, setMeetingData] = useState({
    title: defaultTitle,
    description: '',
    duration: 60,
    autoRecord: true,
    allowStudents: true,
    waitingRoom: false
  })

  const createMeeting = async () => {
    try {
      setIsCreating(true)

      // Simulate meeting creation for demo
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const meeting = {
        meeting_id: `demo-${Date.now()}`,
        title: meetingData.title,
        join_url: `/meetings/demo/join`
      }
      
      toast.success('Meeting created successfully! (Demo mode)')
      
      onMeetingCreated?.(meeting)
      setOpen(false)
      
      // Reset form
      setMeetingData({
        title: defaultTitle,
        description: '',
        duration: 60,
        autoRecord: true,
        allowStudents: true,
        waitingRoom: false
      })
    } catch (error) {
      console.error('Error creating meeting:', error)
      toast.error('Failed to create meeting')
    } finally {
      setIsCreating(false)
    }
  }

  const startInstantMeeting = async () => {
    try {
      const meeting = {
        meeting_id: `demo-${Date.now()}`,
        title: meetingData.title,
        join_url: `/meetings/demo/join`
      }
      
      toast.success('Starting instant meeting... (Demo mode)')
      onMeetingCreated?.(meeting)
    } catch (error) {
      toast.error('Failed to start meeting')
    }
  }

  return (
    <>
      {/* Quick start button */}
      <Button 
        onClick={startInstantMeeting}
        className="mr-2"
        size="sm"
      >
        <Video className="w-4 h-4 mr-2" />
        Start Meeting Now
      </Button>

      {/* Advanced meeting creation */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Meeting
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Video className="w-5 h-5 mr-2" />
              Create Virtual Meeting
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="title">Meeting Title</Label>
              <Input
                id="title"
                value={meetingData.title}
                onChange={(e) => setMeetingData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter meeting title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={meetingData.description}
                onChange={(e) => setMeetingData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Meeting agenda or notes"
                rows={3}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={meetingData.duration}
                onChange={(e) => setMeetingData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                min={15}
                max={480}
              />
            </div>

            {/* Meeting Options */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Meeting Options
              </h4>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-record meeting</Label>
                  <p className="text-sm text-gray-600">Automatically save meeting for later viewing</p>
                </div>
                <Switch
                  checked={meetingData.autoRecord}
                  onCheckedChange={(checked) => setMeetingData(prev => ({ ...prev, autoRecord: checked }))}
                />
              </div>

              {classId && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow students to join</Label>
                    <p className="text-sm text-gray-600">Students can join without approval</p>
                  </div>
                  <Switch
                    checked={meetingData.allowStudents}
                    onCheckedChange={(checked) => setMeetingData(prev => ({ ...prev, allowStudents: checked }))}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable waiting room</Label>
                  <p className="text-sm text-gray-600">Participants wait for host approval</p>
                </div>
                <Switch
                  checked={meetingData.waitingRoom}
                  onCheckedChange={(checked) => setMeetingData(prev => ({ ...prev, waitingRoom: checked }))}
                />
              </div>
            </div>

            {/* Feature Preview */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-2">Meeting Features</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center text-blue-700">
                  <Video className="w-3 h-3 mr-1" />
                  HD Video & Audio
                </div>
                <div className="flex items-center text-blue-700">
                  <Circle className="w-3 h-3 mr-1" />
                  Auto Recording
                </div>
                <div className="flex items-center text-blue-700">
                  <Users className="w-3 h-3 mr-1" />
                  Screen Sharing
                </div>
                <div className="flex items-center text-blue-700">
                  <Clock className="w-3 h-3 mr-1" />
                  Interactive Chat
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createMeeting} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Meeting'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Demo component showing meeting room preview
export function MeetingRoomPreview() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-900 p-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Virtual Meeting Room</h3>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">Demo Mode</Badge>
              <Badge variant="outline" className="text-green-400 border-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse" />
                Live
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="aspect-video bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <Video className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-600">Meeting Room Interface</h4>
            <p className="text-sm text-gray-500 mt-2">
              HD video, screen sharing, recording, and interactive features
            </p>
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 flex items-center justify-center space-x-4">
          <Button size="sm" variant="outline">
            <Video className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline">
            <Users className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline">
            <PlayCircle className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="destructive">
            <Link className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Example integration with existing calendar
export function CalendarMeetingIntegration() {
  const handleMeetingCreated = (meeting: any) => {
    console.log('Meeting created:', meeting)
    // This would integrate with the existing calendar system
  }

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="font-semibold mb-2">Virtual Classroom Integration</h3>
      <p className="text-sm text-gray-600 mb-4">
        Add virtual meeting capabilities to any class or event
      </p>
      
      <VirtualMeetingButton 
        classId="chemistry-101"
        defaultTitle="Chemistry Lab Session"
        onMeetingCreated={handleMeetingCreated}
      />
    </div>
  )
} 