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
  Globe,
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
import { SunIcon, ChevronRightIcon, CalendarIcon, ComponentPlaceholderIcon } from "@radix-ui/react-icons"
import { ploneAPI } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export function DashboardView() {
  // All useState calls must be at the top, before any early returns
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [siteInfo, setSiteInfo] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weather] = useState({ temp: 72, condition: "sunny", icon: SunIcon })
  const { user } = useAuth()

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
        
        // Try to get recent activity
        try {
          const activityData = await ploneAPI.getRecentActivity()
          setRecentActivity(activityData || [])
        } catch (activityError) {
          console.log('Recent activity not available:', activityError)
          setRecentActivity([])
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

  // Calculate stats from real data (removed API Status box)
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
    {
      title: "Site Status",
      value: siteInfo ? "Online" : "Offline",
      change: siteInfo?.["plone.site_title"] || "Plone Site",
      trend: siteInfo ? "up" : "down",
      icon: Globe,
      color: "from-green-500 to-emerald-500",
      percentage: siteInfo ? 100 : 0,
    },
    {
      title: "Recent Activity",
      value: recentActivity.length.toString(),
      change: "System events",
      trend: "neutral",
      icon: Activity,
      color: "from-purple-500 to-indigo-500",
      percentage: 75,
    },
  ]

  const quickActions = [
    {
      title: "Create New Class",
      description: "Set up a new course",
      icon: BookOpen,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Add Students",
      description: "Invite students to classes",
      icon: UserPlus,
      color: "from-green-500 to-emerald-600",
    },
    {
      title: "Create Assignment",
      description: "Design new lab activities",
      icon: FileText,
      color: "from-purple-500 to-violet-600",
    },
    {
      title: "Learning Resources",
      description: "Manage educational materials",
      icon: Package,
      color: "from-orange-500 to-red-600",
    },
  ]

  const upcomingEvents = [
    {
      title: "Welcome to Cirriculux",
      time: "Getting Started",
      type: "setup",
      color: "bg-blue-100 text-blue-800",
      icon: Zap,
    },
  ]

  const notifications = [
    {
      title: "System Ready",
      message: "Your Plone backend is connected and ready to use.",
      time: "Just now",
      type: "success",
      icon: Zap,
      color: "text-green-600",
      priority: "normal",
    },
  ]

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
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <SunIcon className="w-5 h-5" />
                  <span>72°F - Perfect for outdoor labs!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Removed API Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsCards.map((stat, index) => {
          const TrendIcon = stat.trend === "up" ? TrendingUp : stat.trend === "down" ? TrendingDown : Minus
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -2, scale: 1.02 }}
            >
              <Card className="relative overflow-hidden border-0 shadow-lg">
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
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity Feed */}
        <motion.div
          className="lg:col-span-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Card className="shadow-lg border-0 h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Activity className="w-5 h-5 text-blue-600" />
                Recent Activity
                <Badge variant="secondary" className="ml-auto">
                  Live
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto">
              {recentActivity.map((activity, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.6 }}
                  className="group flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={activity.avatar || "/placeholder.svg"} />
                    <AvatarFallback>
                      {activity.user
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold text-slate-800">{activity.user}</span>
                      <span className="text-slate-600"> {activity.action}</span>
                    </p>
                    <p className="text-xs text-blue-600 font-medium">{activity.subject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-slate-500">{activity.time}</p>
                      {activity.priority === "high" && (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          High
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <ChevronRightIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & Classes */}
        <motion.div
          className="lg:col-span-2 space-y-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {/* Quick Actions */}
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.7 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Card
                    className={`p-6 text-center cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300 group bg-gradient-to-br ${action.color}`}
                  >
                    <div className="text-white">
                      <action.icon className="w-8 h-8 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                      <p className="font-semibold text-sm mb-1">{action.title}</p>
                      <p className="text-xs opacity-90">{action.description}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* My Classes Preview */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">My Classes</h2>
              <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 bg-transparent">
                View All <ChevronRightIcon className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classes.map((classItem, index) => (
                <motion.div
                  key={classItem.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.8 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="group cursor-pointer"
                >
                  <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="relative h-32 overflow-hidden">
                      <div className={`absolute inset-0 bg-gradient-to-br ${classItem.color} opacity-90`} />
                      <img
                        src={classItem.image || "/placeholder.svg"}
                        alt={classItem.title}
                        className="w-full h-full object-cover mix-blend-overlay"
                      />
                      <div className="absolute top-4 right-4">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="text-lg font-bold">{classItem.title}</h3>
                        <p className="text-sm opacity-90">{classItem.students} students</p>
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Progress</span>
                        <span className="font-semibold text-slate-800">{classItem.progress}%</span>
                      </div>
                      <Progress value={classItem.progress} className="h-2" />

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{classItem.nextClass}</p>
                          <p className="text-xs text-blue-600">{classItem.recentActivity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {classItem.engagement}% engaged
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                          >
                            <ChevronRightIcon className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Calendar & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calendar Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingEvents.map((event, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 1.0 }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center ${event.color}`}>
                    <event.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{event.title}</p>
                    <p className="text-sm text-slate-600">
                      {event.time}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {event.type}
                  </Badge>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Bell className="w-5 h-5 text-blue-600" />
                Notifications
                <Badge variant="destructive" className="ml-auto">
                  4
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.map((notification, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 1.1 }}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div
                    className={`w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center ${notification.color}`}
                  >
                    <notification.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-slate-800 text-sm">{notification.title}</p>
                      {notification.priority === "high" && (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          !
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{notification.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{notification.time}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                  >
                    <ChevronRightIcon className="w-3 h-3" />
                  </Button>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
