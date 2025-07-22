"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Users,
  FileText,
  Beaker,
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { SunIcon, ChevronRightIcon, CalendarIcon, ComponentPlaceholderIcon } from "@radix-ui/react-icons"

const statsCards = [
  {
    title: "Active Classes",
    value: "4",
    change: "+1 this semester",
    trend: "up",
    icon: BookOpen,
    color: "from-blue-500 to-cyan-500",
    percentage: 100,
  },
  {
    title: "Total Students",
    value: "127",
    change: "94% engagement",
    trend: "up",
    icon: Users,
    color: "from-green-500 to-emerald-500",
    percentage: 94,
  },
  {
    title: "Pending Assignments",
    value: "8",
    change: "2 high priority",
    trend: "neutral",
    icon: FileText,
    color: "from-orange-500 to-red-500",
    percentage: 75,
  },
  {
    title: "Lab Reports Due",
    value: "12",
    change: "3 due today",
    trend: "down",
    icon: Beaker,
    color: "from-purple-500 to-pink-500",
    percentage: 60,
  },
]

const recentActivity = [
  {
    user: "Emma Rodriguez",
    action: "submitted Chemistry Lab Report #4",
    subject: "Chemistry AP",
    time: "5 min ago",
    avatar: "/placeholder.svg?height=32&width=32",
    type: "submission",
    priority: "normal",
  },
  {
    user: "3 students",
    action: "asked questions about Photosynthesis",
    subject: "Biology 9th Grade",
    time: "1 hour ago",
    avatar: "/placeholder.svg?height=32&width=32",
    type: "question",
    priority: "high",
  },
  {
    user: "Biology 9th Grade",
    action: "completed Unit 3 Quiz",
    subject: "32 students participated",
    time: "2 hours ago",
    avatar: "/placeholder.svg?height=32&width=32",
    type: "completion",
    priority: "normal",
  },
  {
    user: "Marcus Johnson",
    action: "requested lab equipment for tomorrow",
    subject: "Physics Lab",
    time: "3 hours ago",
    avatar: "/placeholder.svg?height=32&width=32",
    type: "request",
    priority: "high",
  },
]

const quickActions = [
  {
    title: "Create New Lesson",
    description: "Design interactive content",
    icon: BookMarked,
    color: "from-blue-500 to-cyan-500",
    hoverColor: "hover:from-blue-600 hover:to-cyan-600",
  },
  {
    title: "Design Quiz",
    description: "Build assessments",
    icon: HelpCircle,
    color: "from-green-500 to-emerald-500",
    hoverColor: "hover:from-green-600 hover:to-emerald-600",
  },
  {
    title: "Lab Activity",
    description: "Plan experiments",
    icon: Beaker,
    color: "from-orange-500 to-red-500",
    hoverColor: "hover:from-orange-600 hover:to-red-600",
  },
  {
    title: "Send Announcement",
    description: "Notify students",
    icon: Megaphone,
    color: "from-purple-500 to-pink-500",
    hoverColor: "hover:from-purple-600 hover:to-pink-600",
  },
]

const classes = [
  {
    title: "Biology 9th Grade",
    students: 32,
    progress: 78,
    nextClass: "Tomorrow 9:00 AM",
    recentActivity: "Unit 3 Quiz completed",
    image: "/placeholder.svg?height=200&width=300",
    color: "from-green-400 to-emerald-600",
    icon: Microscope,
    engagement: 92,
  },
  {
    title: "Chemistry AP",
    students: 28,
    progress: 65,
    nextClass: "Today 2:00 PM",
    recentActivity: "Lab Report #4 due",
    image: "/placeholder.svg?height=200&width=300",
    color: "from-blue-400 to-cyan-600",
    icon: Atom,
    engagement: 88,
  },
  {
    title: "Physics Lab",
    students: 31,
    progress: 82,
    nextClass: "Friday 10:00 AM",
    recentActivity: "Wave experiment setup",
    image: "/placeholder.svg?height=200&width=300",
    color: "from-purple-400 to-pink-600",
    icon: Calculator,
    engagement: 95,
  },
  {
    title: "Environmental Science",
    students: 36,
    progress: 91,
    nextClass: "Monday 11:00 AM",
    recentActivity: "Field trip planning",
    image: "/placeholder.svg?height=200&width=300",
    color: "from-orange-400 to-red-600",
    icon: Globe,
    engagement: 89,
  },
]

const upcomingEvents = [
  {
    title: "Parent-Teacher Conferences",
    date: "Today",
    time: "3:00 PM - 6:00 PM",
    type: "meeting",
    icon: Users2,
    color: "text-blue-600",
  },
  {
    title: "Lab Equipment Maintenance",
    date: "Tomorrow",
    time: "8:00 AM",
    type: "maintenance",
    icon: Wrench,
    color: "text-orange-600",
  },
  {
    title: "Science Fair Judging",
    date: "Friday",
    time: "1:00 PM - 4:00 PM",
    type: "event",
    icon: Award,
    color: "text-purple-600",
  },
  {
    title: "Professional Development",
    date: "Next Monday",
    time: "9:00 AM - 12:00 PM",
    type: "training",
    icon: GraduationCap,
    color: "text-green-600",
  },
]

const notifications = [
  {
    title: "New Student Enrollment",
    message: "Alex Kim joined Chemistry AP",
    time: "10 min ago",
    type: "enrollment",
    icon: UserPlus,
    color: "text-green-600",
    priority: "normal",
  },
  {
    title: "Equipment Booking",
    message: "Microscope Lab A reserved for tomorrow",
    time: "1 hour ago",
    type: "booking",
    icon: Calendar,
    color: "text-blue-600",
    priority: "normal",
  },
  {
    title: "System Update",
    message: "Gradebook features updated",
    time: "2 hours ago",
    type: "system",
    icon: Zap,
    color: "text-purple-600",
    priority: "low",
  },
  {
    title: "Collaboration Request",
    message: "Dr. Martinez wants to co-teach unit",
    time: "3 hours ago",
    type: "collaboration",
    icon: Users2,
    color: "text-orange-600",
    priority: "high",
  },
]

const scienceQuotes = [
  "The important thing is not to stop questioning. - Albert Einstein",
  "Science is not only a disciple of reason but also one of romance and passion. - Stephen Hawking",
  "The best way to learn is to teach. - Frank Oppenheimer",
  "In science, there are no shortcuts to any place worth going. - Beverly Sills",
]

export function DashboardView() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weather] = useState({ temp: 72, condition: "sunny", icon: Sun })
  const [currentQuote] = useState(scienceQuotes[Math.floor(Math.random() * scienceQuotes.length)])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="lg:col-span-2">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12" />

            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">{getGreeting()}, Dr. Sarah Chen! 👋</h1>
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
                  <weather.icon className="w-5 h-5" />
                  <span>{weather.temp}°F - Perfect for outdoor labs!</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-slate-800">Science Tip</h3>
          </div>
          <p className="text-slate-600 text-sm italic leading-relaxed">"{currentQuote}"</p>
        </motion.div>
      </motion.div>

      {/* Stats Overview Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.4 }}
            whileHover={{ y: -5, scale: 1.02 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-90`} />
              <CardContent className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <stat.icon className="w-8 h-8 text-white" />
                  <div className="flex items-center gap-1 text-white/80">
                    {stat.trend === "up" && <ArrowUp className="w-4 h-4" />}
                    {stat.trend === "down" && <ArrowDown className="w-4 h-4" />}
                    {stat.trend === "neutral" && <Activity className="w-4 h-4" />}
                  </div>
                </div>
                <div className="text-white mb-3">
                  <motion.p
                    className="text-3xl font-bold"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.6, type: "spring" }}
                  >
                    {stat.value}
                  </motion.p>
                  <p className="text-sm font-medium opacity-90">{stat.title}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>{stat.change}</span>
                    <span>{stat.percentage}%</span>
                  </div>
                  <Progress value={stat.percentage} className="h-1 bg-white/20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

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
                        .map((n) => n[0])
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
                    className={`p-6 text-center cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300 group bg-gradient-to-br ${action.color} ${action.hoverColor}`}
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
                        <classItem.icon className="w-6 h-6 text-white" />
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
                      {event.date} • {event.time}
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
