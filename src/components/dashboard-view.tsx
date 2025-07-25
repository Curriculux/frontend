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

export function DashboardView() {
  // All useState calls must be at the top, before any early returns
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [siteInfo, setSiteInfo] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())

  const [scheduleTimeFrame, setScheduleTimeFrame] = useState<'today' | 'week' | 'month'>('today')
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
      trend: classes.length > 0 ? "up" : "neutral",
      icon: BookOpen,
      color: "from-blue-500 to-cyan-500",
      percentage: 100,
    },
  ]

  const quickActions = [
    {
      title: "Create New Class",
      description: "Set up a new course",
      icon: BookOpen,
      color: "from-blue-500 to-indigo-600",
      adminOnly: true, // Only show for admins
    },
    {
      title: "Add Students",
      description: "Invite students to classes",
      icon: UserPlus,
      color: "from-green-500 to-emerald-600",
      adminOnly: true, // Only show for admins
    },
    {
      title: "Create Assignment",
      description: "Design new lab activities",
      icon: FileText,
      color: "from-purple-500 to-violet-600",
      adminOnly: false, // Show for all users
    },
    {
      title: "Learning Resources",
      description: "Manage educational materials",
      icon: Package,
      color: "from-orange-500 to-red-600",
      adminOnly: false, // Show for all users
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
      {/* Welcome Section - No Science Tip */}
      <div className="grid grid-cols-1 gap-6">
        <div>
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12" />

            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">{getGreeting()}, {getUserName()}! 👋</h1>
              <p className="text-blue-100 mb-4">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>

            </div>
          </div>
        </div>
      </div>

      {/* Stats and Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Classes Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {statsCards.map((stat, index) => {
            const TrendIcon = stat.trend === "up" ? TrendingUp : stat.trend === "down" ? TrendingDown : Minus
            return (
              <Card key={stat.title} className="relative overflow-hidden border-0 shadow-lg">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-90`} />
                <CardContent className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <stat.icon className="w-8 h-8 text-white" />
                    <div className="flex items-center gap-1 text-white/80">
                      <TrendIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-white mb-3">
                    <p className="text-3xl font-bold">{stat.value}</p>
                    <p className="text-sm font-medium opacity-90">{stat.title}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-white/80">
                      <span>{stat.change}</span>
                      <span>{stat.percentage}%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-1">
                      <div
                        className="h-1 rounded-full bg-white/60"
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </motion.div>

        {/* Schedule & Events */}
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filteredQuickActions.map((action, index) => (
              <motion.div
                key={action.title}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 + 0.6 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card
                  className={`p-4 text-center cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300 group bg-gradient-to-br ${action.color}`}
                >
                  <div className="text-white">
                    <action.icon className="w-6 h-6 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <p className="font-semibold text-xs mb-1">{action.title}</p>
                    <p className="text-xs opacity-80">{action.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
