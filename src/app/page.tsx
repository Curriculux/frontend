"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Home,
  BookOpen,
  Users,
  FileText,
  TrendingUp,
  Award,
  Beaker,
  Bell,
  ArrowUp,
  ArrowDown,
  Activity,
  Microscope,
  Atom,
  Globe,
  BookMarked,
  HelpCircle,
  Megaphone,
  Settings,
  Calculator,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { GearIcon, MagnifyingGlassIcon, PlusIcon, SunIcon, ChevronRightIcon, ComponentPlaceholderIcon } from "@radix-ui/react-icons"

const navigationItems = [
  { icon: Home, label: "Dashboard", id: "dashboard", badge: null },
  { icon: BookOpen, label: "My Classes", id: "classes", badge: 4 },
  { icon: Users, label: "Students", id: "students", badge: 127 },
  { icon: FileText, label: "Assignments", id: "assignments", badge: 8 },
  { icon: Award, label: "Assessments", id: "assessments", badge: 3 },
  { icon: Beaker, label: "Lab Reports", id: "lab-reports", badge: 12 },
  { icon: TrendingUp, label: "Analytics", id: "analytics", badge: null },
  { icon: Settings, label: "Settings", id: "settings", badge: null },
]

const scienceQuotes = [
  "The important thing is not to stop questioning. - Albert Einstein",
  "Science is not only a disciple of reason but also one of romance and passion. - Stephen Hawking",
  "The best way to learn is to teach. - Frank Oppenheimer",
  "In science, there are no shortcuts to any place worth going. - Beverly Sills",
]

export default function Dashboard() {
  const [activeView, setActiveView] = useState("dashboard")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [currentQuote, setCurrentQuote] = useState(scienceQuotes[0])

  useEffect(() => {
    // Set random quote only on client side after mount
    setCurrentQuote(scienceQuotes[Math.floor(Math.random() * scienceQuotes.length)])
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white relative overflow-hidden">
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
                        <SunIcon className="w-5 h-5" />
                        <span>72°F - Perfect for outdoor labs!</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    ⚡
                  </div>
                  <h3 className="font-semibold text-slate-800">Science Tip</h3>
                </div>
                <p className="text-slate-600 text-sm italic leading-relaxed">"{currentQuote}"</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Active Classes",
                  value: "4",
                  change: "+1 this semester",
                  trend: "up",
                  icon: BookOpen,
                  color: "from-blue-500 to-cyan-500",
                  progressColor: "bg-blue-700/60",
                  percentage: 100,
                },
                {
                  title: "Total Students",
                  value: "127",
                  change: "94% engagement",
                  trend: "up",
                  icon: Users,
                  color: "from-green-500 to-emerald-500",
                  progressColor: "bg-green-700/60",
                  percentage: 94,
                },
                {
                  title: "Pending Assignments",
                  value: "8",
                  change: "2 high priority",
                  trend: "neutral",
                  icon: FileText,
                  color: "from-orange-500 to-red-500",
                  progressColor: "bg-red-700/60",
                  percentage: 75,
                },
                {
                  title: "Lab Reports Due",
                  value: "12",
                  change: "3 due today",
                  trend: "down",
                  icon: Beaker,
                  color: "from-purple-500 to-pink-500",
                  progressColor: "bg-purple-700/60",
                  percentage: 60,
                },
              ].map((stat, index) => (
                <Card key={stat.title} className="relative overflow-hidden border-0 shadow-lg">
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
                          className={`h-1 rounded-full ${stat.progressColor}`}
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    title: "Create New Lesson",
                    description: "Design interactive content",
                    icon: BookMarked,
                    color: "from-blue-500 to-cyan-500",
                  },
                  {
                    title: "Design Quiz",
                    description: "Build assessments",
                    icon: HelpCircle,
                    color: "from-green-500 to-emerald-500",
                  },
                  {
                    title: "Lab Activity",
                    description: "Plan experiments",
                    icon: Beaker,
                    color: "from-orange-500 to-red-500",
                  },
                  {
                    title: "Send Announcement",
                    description: "Notify students",
                    icon: Megaphone,
                    color: "from-purple-500 to-pink-500",
                  },
                ].map((action, index) => (
                  <Card
                    key={action.title}
                    className={`p-6 text-center cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300 group bg-gradient-to-br ${action.color}`}
                  >
                    <div className="text-white">
                      <action.icon className="w-8 h-8 mx-auto mb-3" />
                      <p className="font-semibold text-sm mb-1">{action.title}</p>
                      <p className="text-xs opacity-90">{action.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Recent Activity
                  <Badge variant="secondary" className="ml-auto">
                    Live
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { user: "Emma Rodriguez", action: "submitted Chemistry Lab Report #4", time: "5 min ago" },
                  { user: "3 students", action: "asked questions about Photosynthesis", time: "1 hour ago" },
                  { user: "Biology 9th Grade", action: "completed Unit 3 Quiz", time: "2 hours ago" },
                ].map((activity, index) => (
                  <div
                    key={index}
                    className="group flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <Avatar className="w-8 h-8">
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
                      <p className="text-xs text-slate-500">{activity.time}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <ChevronRightIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )

      case "classes":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-slate-800">My Classes</h1>
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                <PlusIcon className="w-4 h-4 mr-2" />
                Create New Class
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: "Biology 9th Grade",
                  students: 32,
                  progress: 78,
                  nextClass: "Tomorrow 9:00 AM",
                  color: "from-green-400 to-emerald-600",
                  icon: Microscope,
                  engagement: 92,
                },
                {
                  title: "Chemistry AP",
                  students: 28,
                  progress: 65,
                  nextClass: "Today 2:00 PM",
                  color: "from-blue-400 to-cyan-600",
                  icon: Atom,
                  engagement: 88,
                },
                {
                  title: "Physics Lab",
                  students: 31,
                  progress: 82,
                  nextClass: "Friday 10:00 AM",
                  color: "from-purple-400 to-pink-600",
                  icon: Calculator,
                  engagement: 95,
                },
                {
                  title: "Environmental Science",
                  students: 36,
                  progress: 91,
                  nextClass: "Monday 11:00 AM",
                  color: "from-orange-400 to-red-600",
                  icon: Globe,
                  engagement: 89,
                },
              ].map((classItem, index) => (
                <Card
                  key={classItem.title}
                  className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer"
                >
                  <div className="relative h-32 overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${classItem.color} opacity-90`} />
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
              ))}
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">
              {navigationItems.find((item) => item.id === activeView)?.label || activeView}
            </h1>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12">
                <div className="text-center text-slate-500">
                  <div className="w-16 h-16 mx-auto mb-4 text-slate-300 text-4xl">🚧</div>
                  <p className="text-lg font-medium mb-2">Coming Soon</p>
                  <p className="text-sm">This section is under development</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex">
      {/* Animated Sidebar - ONLY ANIMATIONS HERE */}
      <motion.div
        className="w-64 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 flex flex-col"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Animated Logo - ONLY ANIMATION HERE */}
        <div className="p-6 border-b border-slate-200">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white text-xl"
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              🎓
            </motion.div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Curriculux
              </h1>
              <p className="text-sm text-slate-500">Education Platform</p>
            </div>
          </motion.div>
        </div>

        {/* Animated Navigation - ONLY ANIMATIONS HERE */}
        <div className="flex-1 p-4">
          <nav className="space-y-2">
            {navigationItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <motion.button
                  onClick={() => setActiveView(item.id)}
                  className={`group relative overflow-hidden w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-300 cursor-pointer ${
                    activeView === item.id
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                      : "hover:bg-slate-200"
                  }`}
                  whileHover={{
                    x: 4,
                    scale: 1.05,
                    y: -2,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0 }}
                >
                  <motion.div
                    className="flex items-center gap-3 w-full"
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0 }}
                  >
                    <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ duration: 0 }}>
                      <item.icon className={`w-5 h-5 ${activeView === item.id ? "text-white" : "text-slate-600"}`} />
                    </motion.div>
                    <span className={`font-medium ${activeView === item.id ? "text-white" : "text-slate-700"}`}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        whileHover={{ scale: 1.1 }}
                        className="ml-auto"
                      >
                        <Badge
                          variant="secondary"
                          className={`${
                            activeView === item.id ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                          } font-semibold transition-all duration-200`}
                        >
                          {item.badge}
                        </Badge>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Hover effect background */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg opacity-0"
                    whileHover={{ opacity: activeView === item.id ? 0 : 1 }}
                    transition={{ duration: 0.2 }}
                  />
                </motion.button>
              </motion.div>
            ))}
          </nav>
        </div>
      </motion.div>

      {/* Main Content - NO ANIMATIONS */}
      <div className="flex-1 flex flex-col">
        {/* Header - NO ANIMATIONS */}
        <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 text-white shadow-xl border-b border-blue-800/20">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">
                {navigationItems.find((item) => item.id === activeView)?.label || "Dashboard"}
              </h2>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/70" />
                <Input
                  placeholder="Search classes, students, assignments..."
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/70 focus:bg-white/20 focus:border-white/40"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                  4
                </span>
              </Button>
              <Avatar className="w-8 h-8">
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content - NO ANIMATIONS */}
        <main className="flex-1 p-6 overflow-auto">{renderContent()}</main>
      </div>
    </div>
  )
}
