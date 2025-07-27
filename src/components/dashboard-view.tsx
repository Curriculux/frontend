"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Users,
  FileText,
  ArrowUp,
  ArrowDown,
  Activity,
  Zap,
  Bell,
  Wrench,
  Award,
  GraduationCap,
  Users2,
  BookMarked,
  HelpCircle,
  Megaphone,
  Microscope,
  Atom,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { ChevronRightIcon, CalendarIcon, ComponentPlaceholderIcon } from "@radix-ui/react-icons"
import { ploneAPI } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { getSecurityManager } from "@/lib/security"
import { formatTimeInUserTimezone, formatDateInUserTimezone } from "@/lib/date-utils"


export function DashboardView() {
  // All useState calls must be at the top, before any early returns
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [siteInfo, setSiteInfo] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [totalAssignments, setTotalAssignments] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [events, setEvents] = useState<any[]>([])

  const [scheduleTimeFrame, setScheduleTimeFrame] = useState<'today' | 'week' | 'month'>('today')
  

  
  const { user } = useAuth()

  // Get security context to check permissions
  const securityManager = getSecurityManager()
  const securityContext = securityManager.getSecurityContext()

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        
        // Load site info, classes data, and events
        const [siteData, classesData] = await Promise.all([
          ploneAPI.getSiteInfo(),
          ploneAPI.getClasses(),
        ])
        
        setSiteInfo(siteData)
        setClasses(classesData || [])
        
        // Load events for schedule widget
        try {
          const eventsData = await ploneAPI.getEvents()
          
          // Filter events based on user role and class enrollment (same logic as calendar)
          let filteredEvents = eventsData
          
          if (user && securityContext?.isStudent()) {
            // Students see events for classes they're enrolled in
            const userClasses = classesData.filter((cls: any) => 
              cls.students?.some((student: any) => student.username === user.username)
            )
            const userClassIds = userClasses.map((cls: any) => cls.id)
            
            filteredEvents = eventsData.filter((event: any) => 
              !event.classId || userClassIds.includes(event.classId)
            )
          } else if (user && securityContext?.isTeacher()) {
            // Teachers see events for classes they teach
            const teacherClasses = classesData.filter((cls: any) => 
              cls.teacher === user.fullname || cls.teacher === user.username
            )
            const teacherClassIds = teacherClasses.map((cls: any) => cls.id)
            
            filteredEvents = eventsData.filter((event: any) => 
              !event.classId || teacherClassIds.includes(event.classId) || event.createdBy === user.username
            )
          } else if (user && securityContext?.isAdmin()) {
            // Admins see all events
            filteredEvents = eventsData
          }
          
          setEvents(filteredEvents)
          console.log(`Dashboard loaded ${filteredEvents.length} events for user role`)
        } catch (eventsError) {
          console.warn('Could not load events for dashboard:', eventsError)
          setEvents([])
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    
    loadDashboardData()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadStudentCount = async () => {
    try {
      // Use the more reliable approach - count all student user accounts
      // instead of trying to count students per class which may fail due to permissions
      let studentCount = 0
      
      try {
        // Method 1: Try to get all students using the user-based approach
        const allStudents = await ploneAPI.getUsersByType('students')
        console.log('✅ Successfully loaded students via user accounts:', allStudents.length, allStudents)
        studentCount = allStudents.length
        
        // If we got students this way, we're done
        if (studentCount > 0) {
          console.log(`📊 Total student count (via user accounts): ${studentCount}`)
          setTotalStudents(studentCount)
          return
        }
      } catch (userError) {
        console.warn('Could not load students via user accounts, trying class-based approach:', userError)
      }
      
      // Method 2: Fallback to class-based counting (original method)
      console.log('🔄 Trying class-based student counting...')
      const studentCounts = []
      
      for (const classItem of classes) {
        try {
          const students = await ploneAPI.getStudents(classItem.id)
          console.log(`📚 Class "${classItem.title}" (${classItem.id}) has ${students.length} students:`, students.map((s: any) => s.name || s.title))
          studentCounts.push({ classId: classItem.id, count: students.length, students })
          studentCount += students.length
        } catch (error) {
          console.error(`❌ Error loading students for class "${classItem.title}" (${classItem.id}):`, error)
          studentCounts.push({ classId: classItem.id, count: 0, error: error instanceof Error ? error.message : String(error) })
        }
      }
      
      console.log('📊 Student count breakdown by class:', studentCounts)
      console.log(`📊 Total student count (via class counting): ${studentCount}`)
      
      // Method 3: If still no students found, try to get all users and filter
      if (studentCount === 0) {
        try {
          console.log('🔄 No students found via class method, trying to get all users...')
          const allUsers = await ploneAPI.getAllUsers()
          console.log('👥 All users in system:', allUsers.length)
          
                     // Filter for users that look like students (have Contributor role but not teaching roles)
           const potentialStudents = allUsers.filter((user: any) => {
             const hasContributor = user.roles?.includes('Contributor')
             const hasMember = user.roles?.includes('Member')
             const hasTeachingRole = user.roles?.some((role: string) => ['Editor', 'Site Administrator', 'Manager'].includes(role))
             const isStudent = hasContributor && hasMember && !hasTeachingRole
            
            if (isStudent) {
              console.log('👨‍🎓 Found potential student:', user.fullname, user.username, user.roles)
            }
            
            return isStudent
          })
          
          studentCount = potentialStudents.length
          console.log(`📊 Total student count (via user filtering): ${studentCount}`)
        } catch (allUsersError) {
          console.warn('Could not load all users for student filtering:', allUsersError)
        }
      }
      
      setTotalStudents(studentCount)
    } catch (error) {
      console.error('Error counting total students:', error)
      setTotalStudents(0)
    }
  }

  const loadAssignmentCount = async () => {
    try {
      let assignmentCount = 0
      for (const classItem of classes) {
        try {
          const assignments = await ploneAPI.getAssignments(classItem.id)
          assignmentCount += assignments.length
        } catch (error) {
          console.error(`Error loading assignments for class ${classItem.id}:`, error)
        }
      }
      setTotalAssignments(assignmentCount)
    } catch (error) {
      console.error('Error counting total assignments:', error)
    }
  }

  // Load additional stats when classes are loaded
  useEffect(() => {
    if (classes.length > 0 && securityContext && user) {
      // Only load student counts for admins to avoid 401 errors for teachers
      if (securityContext.isAdmin()) {
        loadStudentCount()
      } else {
        // For teachers, count students only in their own classes
        loadTeacherStudentCount()
      }
      loadAssignmentCount()
    } else {
      setTotalStudents(0)
      setTotalAssignments(0)
    }
  }, [classes, securityContext, user])

  const loadTeacherStudentCount = async () => {
    try {
      // For teachers, only count students in classes they teach
      let studentCount = 0
      const teacherName = user?.fullname || user?.username || ''
      
      console.log(`🧑‍🏫 Loading student count for teacher: ${teacherName}`)
      
      const teacherClasses = classes.filter(classItem => 
        classItem.teacher === teacherName || 
        classItem.teacher === user?.username
      )
      
      console.log(`📚 Teacher has ${teacherClasses.length} classes:`, teacherClasses.map(c => c.title))
      
      for (const classItem of teacherClasses) {
        try {
          const students = await ploneAPI.getStudents(classItem.id)
          console.log(`📚 Class "${classItem.title}" has ${students.length} students`)
          studentCount += students.length
        } catch (error) {
          console.warn(`Could not load students for class ${classItem.title}:`, error)
        }
      }
      
      console.log(`👥 Total students for teacher: ${studentCount}`)
      setTotalStudents(studentCount)
    } catch (error) {
      console.error('Error counting teacher students:', error)
      setTotalStudents(0)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading dashboard</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // Helper functions
  const getGreeting = () => {
    // Get the hour in user's timezone for proper greeting
    const timeInUserTZ = formatTimeInUserTimezone(currentTime, 'H')
    const hour = parseInt(timeInUserTZ)
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  const getUserName = () => {
    if (user?.fullname) {
      return user.fullname
    }
    if (user?.username) {
      return user.username
    }
    return "Teacher"
  }

  // Generate schedule items based on timeframe
  const getScheduleItems = (): Array<{
    time: string;
    title: string;
    type: string;
    color: string;
    icon: any;
  }> => {
    const now = new Date()
    let startDate: Date
    let endDate: Date

    // Define date range based on timeframe
    switch (scheduleTimeFrame) {
      case 'today':
        startDate = new Date(now)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'week':
        startDate = new Date(now)
        const dayOfWeek = startDate.getDay()
        startDate.setDate(startDate.getDate() - dayOfWeek) // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6) // End of week (Saturday)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      default:
        return []
    }

    // Filter events within the time range
    const filteredEvents = events.filter(event => {
      const eventDate = new Date(event.startDate)
      return eventDate >= startDate && eventDate <= endDate
    })

    // Convert events to schedule items format
    return filteredEvents
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5) // Limit to 5 items for UI
      .map(event => {
        const eventDate = new Date(event.startDate)
        const isToday = eventDate.toDateString() === now.toDateString()
        const timeFormat = isToday 
          ? formatTimeInUserTimezone(eventDate, 'h:mm a')
          : formatDateInUserTimezone(eventDate, 'MMM d') + ' ' + formatTimeInUserTimezone(eventDate, 'h:mm a')

        // Determine icon and color based on event type
        let icon = Calendar
        let color = 'text-blue-600'
        
        switch (event.type) {
          case 'meeting':
            icon = Video
            color = 'text-green-600'
            break
          case 'assignment':
            icon = FileText
            color = 'text-purple-600'
            break
          case 'test':
            icon = BookOpen
            color = 'text-red-600'
            break
          case 'class':
            icon = Users
            color = 'text-blue-600'
            break
          default:
            icon = Calendar
            color = 'text-gray-600'
        }

        return {
          time: timeFormat,
          title: event.title,
          type: event.type || 'event',
          color,
          icon
        }
      })
  }

  // Calculate stats from real data - role-aware
  const getStatsCards = () => {
    const isAdmin = securityContext?.isAdmin()
    const isTeacher = securityContext?.isTeacher()
    
    return [
      {
        title: isAdmin ? "Active Classes" : "My Classes",
        value: isAdmin ? classes.length.toString() : classes.filter(c => 
          c.teacher === user?.fullname || c.teacher === user?.username
        ).length.toString(),
        change: `${classes.length > 0 ? 'Connected to Plone' : 'No classes yet'}`,
        icon: BookOpen,
        color: "from-blue-500 to-cyan-500",
      },
      {
        title: isAdmin ? "Total Students" : "My Students",
        value: totalStudents.toString(),
        change: isAdmin ? "Across all classes" : "In my classes",
        icon: Users,
        color: "from-green-500 to-emerald-500",
      },
      {
        title: "Assignments",
        value: totalAssignments.toString(),
        change: "Created this semester",
        icon: FileText,
        color: "from-purple-500 to-pink-500",
      },
      {
        title: "Platform Status",
        value: siteInfo ? "Online" : "Loading",
        change: siteInfo ? "All systems operational" : "Connecting to Plone...",
        icon: Activity,
        color: "from-orange-500 to-red-500",
      },
    ]
  }



  // TODO: Load real upcoming events from backend
  const upcomingEvents: Array<{
    title: string;
    time: string;
    type: string;
    color: string;
    icon: any;
  }> = []

  // TODO: Load real notifications from backend
  const notifications: Array<{
    title: string;
    message: string;
    time: string;
    type: string;
    icon: any;
    color: string;
    priority: string;
  }> = []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            {getGreeting()}, {getUserName()}! Welcome back to your teaching dashboard.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">
            {formatDateInUserTimezone(currentTime, 'EEEE, MMM d')}
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {formatTimeInUserTimezone(currentTime, 'h:mm a')}
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {getStatsCards().map((stat: any, index: number) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                  </div>
                  <p className="text-xs text-slate-500">{stat.change}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Schedule & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                  Schedule & Events
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant={scheduleTimeFrame === 'today' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScheduleTimeFrame('today')}
                    className="text-xs px-3 py-1 h-7"
                  >
                    Today
                  </Button>
                  <Button
                    variant={scheduleTimeFrame === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScheduleTimeFrame('week')}
                    className="text-xs px-3 py-1 h-7"
                  >
                    Week
                  </Button>
                  <Button
                    variant={scheduleTimeFrame === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScheduleTimeFrame('month')}
                    className="text-xs px-3 py-1 h-7"
                  >
                    Month
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {getScheduleItems().length > 0 ? (
                getScheduleItems().map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.8 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-sm text-slate-500">{item.time}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className={`text-xs ${item.color}`}>
                        {item.type}
                      </Badge>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <p className="text-sm">No scheduled events for this time period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>



    </div>
  )
}
