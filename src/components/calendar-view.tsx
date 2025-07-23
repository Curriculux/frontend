"use client"

import { useState, useEffect } from "react"
import * as React from "react"
import { motion } from "framer-motion"
import {
  Calendar as CalendarIcon,
  Plus,
  Users,
  MapPin,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Video,
  Phone,
  FileText,
  Bell,
  User,
  Building,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { ploneAPI } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { getSecurityManager } from "@/lib/security"

interface CalendarEvent {
  id: string
  title: string
  description?: string
  startDate: Date
  endDate: Date
  type: 'meeting' | 'conference' | 'class' | 'deadline' | 'other'
  location?: string
  isOnline?: boolean
  meetingUrl?: string
  attendees?: string[]
  createdBy: string
  isRecurring?: boolean
  recurrenceRule?: string
  reminder?: number // minutes before event
  priority: 'low' | 'medium' | 'high'
  status: 'scheduled' | 'confirmed' | 'cancelled'
  classId?: string
  assignmentId?: string
}

export function CalendarView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [filterType, setFilterType] = useState<string>('all')
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false)
  const [classes, setClasses] = useState<any[]>([])
  const [securityContext, setSecurityContext] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // New event form state
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    type: 'meeting',
    startDate: new Date(),
    endDate: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
    location: '',
    isOnline: false,
    meetingUrl: '',
    attendees: [],
    priority: 'medium',
    status: 'scheduled',
    reminder: 15,
  })

  useEffect(() => {
    loadCalendarData()
  }, [])

  const loadCalendarData = async () => {
    try {
      setLoading(true)
      
      // Initialize security context
      const securityManager = getSecurityManager()
      const context = await securityManager.initializeSecurityContext()
      setSecurityContext(context)
      
      // Get current user
      const user = await ploneAPI.getCurrentUser()
      setCurrentUser(user)
      
      // Load classes for event creation
      const classesData = await ploneAPI.getClasses()
      setClasses(classesData)
      
      // Load events from backend (mock data for now)
      const mockEvents = generateMockEvents()
      setEvents(mockEvents)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }

  // Check if user can create events (teachers and admins only)
  const canCreateEvents = () => {
    if (!securityContext) return false
    return securityContext.isTeacher() || securityContext.isAdmin()
  }

  const generateMockEvents = (): CalendarEvent[] => {
    const today = new Date()
    return [
      {
        id: '1',
        title: 'Department Meeting',
        description: 'Monthly department sync to discuss curriculum updates',
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 10, 0),
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 11, 30),
        type: 'meeting',
        location: 'Conference Room A',
        isOnline: false,
        attendees: ['teacher1', 'teacher2', 'admin'],
        createdBy: 'admin',
        priority: 'high',
        status: 'confirmed',
        reminder: 30,
      },
      {
        id: '2',
        title: 'Parent-Teacher Conference',
        description: 'Quarterly conferences with parents',
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 14, 0),
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 17, 0),
        type: 'conference',
        location: 'School Auditorium',
        isOnline: false,
        attendees: ['teachers', 'parents'],
        createdBy: 'admin',
        priority: 'high',
        status: 'scheduled',
        reminder: 60,
      },
      {
        id: '3',
        title: 'Virtual Science Workshop',
        description: 'Online workshop on new teaching methodologies',
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 15, 0),
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 16, 30),
        type: 'conference',
        isOnline: true,
        meetingUrl: 'https://zoom.us/j/123456789',
        attendees: ['science-teachers'],
        createdBy: 'admin',
        priority: 'medium',
        status: 'confirmed',
        reminder: 15,
      },
      {
        id: '4',
        title: 'Assignment Due: Lab Report',
        description: 'Chemistry lab report submission deadline',
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7, 23, 59),
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7, 23, 59),
        type: 'deadline',
        classId: 'chemistry-101',
        assignmentId: 'lab-report-1',
        createdBy: 'teacher',
        priority: 'high',
        status: 'scheduled',
        reminder: 1440, // 24 hours
      },
    ]
  }

  const handleCreateEvent = async () => {
    try {
      if (!newEvent.title || !newEvent.startDate || !newEvent.endDate) {
        throw new Error('Please fill in all required fields')
      }

      const eventToCreate: CalendarEvent = {
        id: Date.now().toString(),
        title: newEvent.title!,
        description: newEvent.description,
        startDate: newEvent.startDate!,
        endDate: newEvent.endDate!,
        type: newEvent.type!,
        location: newEvent.location,
        isOnline: newEvent.isOnline,
        meetingUrl: newEvent.meetingUrl,
        attendees: newEvent.attendees || [],
        createdBy: currentUser?.username || 'unknown',
        priority: newEvent.priority!,
        status: newEvent.status!,
        reminder: newEvent.reminder,
        classId: newEvent.classId,
        assignmentId: newEvent.assignmentId,
      }

      // Create actual meeting if this is an online event
      if (newEvent.isOnline && (newEvent.type === 'meeting' || newEvent.type === 'class')) {
        try {
          const meeting = await ploneAPI.createMeeting({
            title: newEvent.title!,
            description: newEvent.description,
            startTime: newEvent.startDate!.toISOString(),
            duration: Math.floor((newEvent.endDate!.getTime() - newEvent.startDate!.getTime()) / 60000),
            meetingType: newEvent.type === 'class' ? 'class' : 'meeting',
            classId: newEvent.classId,
            autoRecord: true, // Default to auto-record
          });

          // Update event with real meeting URL
          eventToCreate.meetingUrl = meeting.joinUrl;
          eventToCreate.id = meeting.id;
          
          console.log('Created meeting:', meeting);
        } catch (meetingError) {
          console.error('Error creating meeting:', meetingError);
          // Continue with calendar event even if meeting creation fails
          eventToCreate.meetingUrl = `/meetings/placeholder-${Date.now()}/join`;
        }
      }
      
      // Add to calendar
      setEvents(prev => [...prev, eventToCreate])
      setCreateEventDialogOpen(false)
      resetNewEventForm()
      
    } catch (error) {
      console.error('Error creating event:', error)
      setError(error instanceof Error ? error.message : 'Failed to create event')
    }
  }

  const resetNewEventForm = () => {
    setNewEvent({
      title: '',
      description: '',
      type: 'meeting',
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 60 * 1000),
      location: '',
      isOnline: false,
      meetingUrl: '',
      attendees: [],
      priority: 'medium',
      status: 'scheduled',
      reminder: 15,
    })
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  const getEventTypeIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return Users
      case 'conference':
        return Building
      case 'class':
        return CalendarIcon
      case 'deadline':
        return Clock
      default:
        return FileText
    }
  }

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'conference':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'class':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'deadline':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getPriorityColor = (priority: CalendarEvent['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-600'
      case 'medium':
        return 'text-yellow-600'
      case 'low':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const filteredEvents = events.filter(event => {
    if (filterType === 'all') return true
    return event.type === filterType
  })

  const upcomingEvents = events
    .filter(event => event.startDate > new Date())
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading calendar...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading calendar</p>
          <p className="text-sm text-gray-600">{error}</p>
          <Button 
            onClick={() => loadCalendarData()} 
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-600 mt-1">
            Schedule meetings, conferences, and track important dates
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="meeting">Meetings</SelectItem>
              <SelectItem value="conference">Conferences</SelectItem>
              <SelectItem value="class">Classes</SelectItem>
              <SelectItem value="deadline">Deadlines</SelectItem>
            </SelectContent>
          </Select>
          
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
            </TabsList>
          </Tabs>

          {canCreateEvents() && (
            <Dialog open={createEventDialogOpen} onOpenChange={setCreateEventDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  New Event
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Event title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Type *</Label>
                    <Select
                      value={newEvent.type}
                      onValueChange={(value) => setNewEvent(prev => ({ ...prev, type: value as CalendarEvent['type'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="conference">Conference</SelectItem>
                        <SelectItem value="class">Class</SelectItem>
                        <SelectItem value="deadline">Deadline</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Event description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date & Time *</Label>
                    <DateTimePicker
                      value={newEvent.startDate?.toISOString()}
                      onChange={(dateStr) => setNewEvent(prev => ({ ...prev, startDate: dateStr ? new Date(dateStr) : undefined }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date & Time *</Label>
                    <DateTimePicker
                      value={newEvent.endDate?.toISOString()}
                      onChange={(dateStr) => setNewEvent(prev => ({ ...prev, endDate: dateStr ? new Date(dateStr) : undefined }))}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newEvent.isOnline}
                    onCheckedChange={(checked) => setNewEvent(prev => ({ ...prev, isOnline: checked }))}
                  />
                  <Label htmlFor="isOnline">Online Event</Label>
                </div>

                {newEvent.isOnline ? (
                  <div>
                    <Label htmlFor="meetingUrl">Meeting URL</Label>
                    <Input
                      id="meetingUrl"
                      value={newEvent.meetingUrl}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, meetingUrl: e.target.value }))}
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Conference room, address, etc."
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newEvent.priority}
                      onValueChange={(value) => setNewEvent(prev => ({ ...prev, priority: value as CalendarEvent['priority'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reminder">Reminder (minutes before)</Label>
                    <Select
                      value={newEvent.reminder?.toString()}
                      onValueChange={(value) => setNewEvent(prev => ({ ...prev, reminder: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="1440">1 day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newEvent.type === 'class' && (
                  <div>
                    <Label htmlFor="classId">Related Class</Label>
                    <Select
                      value={newEvent.classId}
                      onValueChange={(value) => setNewEvent(prev => ({ ...prev, classId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCreateEventDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateEvent}>
                    Create Event
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Widget */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {selectedDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </span>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newDate = new Date(selectedDate)
                      newDate.setMonth(newDate.getMonth() - 1)
                      setSelectedDate(newDate)
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newDate = new Date(selectedDate)
                      newDate.setMonth(newDate.getMonth() + 1)
                      setSelectedDate(newDate)
                    }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                modifiers={{
                  hasEvents: (date) => getEventsForDate(date).length > 0
                }}
                modifiersStyles={{
                  hasEvents: { 
                    fontWeight: 'bold',
                    backgroundColor: 'rgb(239 246 255)',
                    color: 'rgb(29 78 216)'
                  }
                }}
                className="rounded-md border-0"
              />
            </CardContent>
          </Card>

          {/* Events for Selected Date */}
          <Card className="border-0 shadow-lg mt-6">
            <CardHeader>
              <CardTitle>
                Events on {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getEventsForDate(selectedDate).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No events scheduled for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).map((event) => {
                    const IconComponent = getEventTypeIcon(event.type)
                    return (
                      <motion.div
                        key={event.id}
                        className={`p-4 rounded-lg border ${getEventTypeColor(event.type)} cursor-pointer hover:shadow-md transition-shadow`}
                        onClick={() => {
                          setSelectedEvent(event)
                          setEventDetailsOpen(true)
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <IconComponent className="w-5 h-5 mt-0.5" />
                            <div>
                              <h4 className="font-semibold">{event.title}</h4>
                              <p className="text-sm opacity-75">
                                {event.startDate.toLocaleTimeString('en-US', { 
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })} - {event.endDate.toLocaleTimeString('en-US', { 
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </p>
                              {event.location && (
                                <p className="text-xs opacity-60 flex items-center mt-1">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {event.location}
                                </p>
                              )}
                              {event.isOnline && (
                                <p className="text-xs opacity-60 flex items-center mt-1">
                                  <Video className="w-3 h-3 mr-1" />
                                  Online Meeting
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={getPriorityColor(event.priority)}>
                              {event.priority}
                            </Badge>
                            {canCreateEvents() && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events Sidebar */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => {
                    const IconComponent = getEventTypeIcon(event.type)
                    return (
                      <div
                        key={event.id}
                        className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedEvent(event)
                          setEventDetailsOpen(true)
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <IconComponent className="w-4 h-4 text-slate-600" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{event.title}</p>
                            <p className="text-xs text-slate-500">
                              {event.startDate.toLocaleDateString('en-US', { 
                                month: 'short',
                                day: 'numeric'
                              })} at {event.startDate.toLocaleTimeString('en-US', { 
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(event.priority)}`}>
                            {event.priority}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Meetings</span>
                  </div>
                  <span className="font-semibold">
                    {events.filter(e => e.type === 'meeting').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-purple-600" />
                    <span className="text-sm">Conferences</span>
                  </div>
                  <span className="font-semibold">
                    {events.filter(e => e.type === 'conference').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-red-600" />
                    <span className="text-sm">Deadlines</span>
                  </div>
                  <span className="font-semibold">
                    {events.filter(e => e.type === 'deadline').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Details Modal */}
      <Dialog open={eventDetailsOpen} onOpenChange={setEventDetailsOpen}>
        <DialogContent className="max-w-lg">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  {React.createElement(getEventTypeIcon(selectedEvent.type), { className: "w-5 h-5" })}
                  <span>{selectedEvent.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedEvent.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-slate-600 mt-1">{selectedEvent.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Start</Label>
                    <p className="text-sm text-slate-600 mt-1">
                      {selectedEvent.startDate.toLocaleDateString()} at {selectedEvent.startDate.toLocaleTimeString('en-US', { 
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">End</Label>
                    <p className="text-sm text-slate-600 mt-1">
                      {selectedEvent.endDate.toLocaleDateString()} at {selectedEvent.endDate.toLocaleTimeString('en-US', { 
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                {(selectedEvent.location || selectedEvent.isOnline) && (
                  <div>
                    <Label className="text-sm font-medium">Location</Label>
                    <p className="text-sm text-slate-600 mt-1 flex items-center">
                      {selectedEvent.isOnline ? (
                        <>
                          <Video className="w-4 h-4 mr-2" />
                          Online Meeting
                          {selectedEvent.meetingUrl && (
                            <a
                              href={selectedEvent.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-blue-600 hover:underline"
                            >
                              Join Meeting
                            </a>
                          )}
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4 mr-2" />
                          {selectedEvent.location}
                        </>
                      )}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Priority</Label>
                    <Badge variant="outline" className={`mt-1 ${getPriorityColor(selectedEvent.priority)}`}>
                      {selectedEvent.priority}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant="outline" className="mt-1">
                      {selectedEvent.status}
                    </Badge>
                  </div>
                </div>

                {selectedEvent.reminder && (
                  <div>
                    <Label className="text-sm font-medium">Reminder</Label>
                    <p className="text-sm text-slate-600 mt-1 flex items-center">
                      <Bell className="w-4 h-4 mr-2" />
                      {selectedEvent.reminder} minutes before
                    </p>
                  </div>
                )}

                {canCreateEvents() && (
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 