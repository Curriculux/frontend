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
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { DashboardView } from "@/components/dashboard-view"
import { ClassesView } from "@/components/classes-view"
import { StudentsView } from "@/components/students-view"
import { Card, CardContent } from "@/components/ui/card"
import { ploneAPI } from "@/lib/api"

const navigationItems = [
  { icon: Home, label: "Dashboard", id: "dashboard", badge: null },
  { icon: BookOpen, label: "My Classes", id: "classes", badge: null },
  { icon: Users, label: "Students", id: "students", badge: null },
  { icon: FileText, label: "Assignments", id: "assignments", badge: null },
  { icon: Award, label: "Assessments", id: "assessments", badge: null },
  { icon: Beaker, label: "Lab Reports", id: "lab-reports", badge: null },
  { icon: TrendingUp, label: "Analytics", id: "analytics", badge: null },
  { icon: Settings, label: "Settings", id: "settings", badge: null },
]

export default function Dashboard() {
  const [activeView, setActiveView] = useState("dashboard")
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await ploneAPI.getCurrentUser()
        setCurrentUser(userData)
      } catch (error) {
        console.log('Could not load user data:', error)
      }
    }
    
    loadUser()
  }, [])

  const getUserInitials = () => {
    if (currentUser?.fullname) {
      return currentUser.fullname
        .split(' ')
        .map((name: string) => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (currentUser?.username) {
      return currentUser.username.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <DashboardView />
      case "classes":
        return <ClassesView />
      case "students":
        return <StudentsView />
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
      {/* Animated Sidebar */}
      <motion.div
        className="w-64 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 flex flex-col"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
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

        {/* Navigation */}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
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
                <AvatarFallback>{getUserInitials()}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">{renderContent()}</main>
      </div>
    </div>
  )
}
