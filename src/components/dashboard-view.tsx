"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Users,
  FileText,
  Package,
  ArrowUp,
  ArrowDown,
  Activity,
  Zap,
  Bell,
  UserPlus,
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
import { CreateTeacherDialog } from "@/components/create-teacher-dialog"
import { CreateClassDialog } from "@/components/create-class-dialog"
import { CreateStudentAccountDialog } from "@/components/create-student-account-dialog"
import { CreateAssignmentDialog } from "@/components/create-assignment-dialog"

export function DashboardView() {
  // All useState calls must be at the top, before any early returns
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [siteInfo, setSiteInfo] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [totalAssignments, setTotalAssignments] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())

  const [scheduleTimeFrame, setScheduleTimeFrame] = useState<'today' | 'week' | 'month'>('today')
  
  // Dialog states for quick actions
  const [createClassOpen, setCreateClassOpen] = useState(false)
  const [createStudentOpen, setCreateStudentOpen] = useState(false)
  const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false)
  
  const { user } = useAuth()

  // Get security context to check permissions
  const securityManager = getSecurityManager()
  const securityContext = securityManager.getSecurityContext()

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        
        // Load site info and classes data
        const [siteData, classesData] = await Promise.all([
          ploneAPI.getSiteInfo(),
          ploneAPI.getClasses(),
        ])
        
        setSiteInfo(siteData)
        setClasses(classesData || [])
        
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
      let studentCount = 0
      for (const classItem of classes) {
        try {
          const students = await ploneAPI.getStudents(classItem.id)
          studentCount += students.length
        } catch (error) {
          console.error(`Error loading students for class ${classItem.id}:`, error)
        }
      }
      setTotalStudents(studentCount)
    } catch (error) {
      console.error('Error counting total students:', error)
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
    if (classes.length > 0) {
      loadStudentCount()
      loadAssignmentCount()
    } else {
      setTotalStudents(0)
      setTotalAssignments(0)
    }
  }, [classes])

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
    const hour = currentTime.getHours()
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
    // TODO: Load real schedule items from backend based on user role and time frame
    // For now, return empty array until proper scheduling system is implemented
    return []
  }

  // Calculate stats from real data
  const statsCards = [
    {
      title: "Active Classes",
      value: classes.length.toString(),
      change: `${classes.length > 0 ? 'Connected to Plone' : 'No classes yet'}`,
      icon: BookOpen,
      color: "from-blue-500 to-cyan-500",
    },
    {
      title: "Total Students",
      value: totalStudents.toString(),
      change: "Across all classes",
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

  const quickActions = [
    {
      title: "Create New Class",
      description: "Set up a new course",
      icon: BookOpen,
      color: "from-blue-500 to-indigo-600",
      adminOnly: true, // Only show for admins
      onClick: () => setCreateClassOpen(true),
    },
    {
      title: "Add Students",
      description: "Invite students to classes",
      icon: UserPlus,
      color: "from-green-500 to-emerald-600",
      adminOnly: true, // Only show for admins
      onClick: () => setCreateStudentOpen(true),
    },
    {
      title: "Create Assignment",
      description: "Design new lab activities",
      icon: FileText,
      color: "from-purple-500 to-violet-600",
      adminOnly: false, // Show for all users
      onClick: () => setCreateAssignmentOpen(true),
    },
    {
      title: "Learning Resources",
      description: "Manage educational materials",
      icon: Package,
      color: "from-orange-500 to-red-600",
      adminOnly: false, // Show for all users
      onClick: () => {
        // TODO: Navigate to resources management page
        console.log("Navigate to learning resources");
      },
    },
  ]

  // Filter quick actions based on user role
  const filteredQuickActions = quickActions.filter(action => 
    !action.adminOnly || securityContext?.isAdmin()
  )

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
            {currentTime.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
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

      {/* Quick Actions Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredQuickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="group"
            >
              <Card 
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={action.onClick}
              >
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-sm text-slate-600">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Dialog Components */}
      <CreateClassDialog
        open={createClassOpen}
        onOpenChange={setCreateClassOpen}
        onClassCreated={async () => {
          // Refresh classes data
          try {
            const classesData = await ploneAPI.getClasses()
            setClasses(classesData || [])
          } catch (error) {
            console.error('Error refreshing classes:', error)
          }
        }}
      />

      <CreateStudentAccountDialog
        open={createStudentOpen}
        onOpenChange={setCreateStudentOpen}
        onStudentCreated={async () => {
          // Refresh student count
          await loadStudentCount()
        }}
      />

      <CreateAssignmentDialog
        open={createAssignmentOpen}
        onOpenChange={setCreateAssignmentOpen}
        classes={classes}
        onAssignmentCreated={async () => {
          // Refresh assignment count
          await loadAssignmentCount()
        }}
      />
    </div>
  )
}
