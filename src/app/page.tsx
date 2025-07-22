"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Home,
  BookOpen,
  Users,
  FileText,
  Award,
  Bell,
  Settings,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { DashboardView } from "@/components/dashboard-view"
import { ClassesView } from "@/components/classes-view"
import { StudentsView } from "@/components/students-view"
import { AssignmentsView } from "@/components/assignments-view"
import { TestsView } from "@/components/tests-view"
import { SettingsView } from "@/components/settings-view"
import { StudentDashboard } from "@/components/student-dashboard"
import { Card, CardContent } from "@/components/ui/card"
import { ploneAPI } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { getSecurityManager } from "@/lib/security"

const navigationItems = [
  { icon: Home, label: "Dashboard", id: "dashboard", badge: null },
  { icon: BookOpen, label: "My Classes", id: "classes", badge: null },
  { icon: Users, label: "Students", id: "students", badge: null },
  { icon: FileText, label: "Assignments", id: "assignments", badge: null },
  { icon: Award, label: "Tests", id: "tests", badge: null },
  { icon: Settings, label: "Settings", id: "settings", badge: null },
]

const studentNavigationItems = [
  { icon: Home, label: "Dashboard", id: "dashboard", badge: null },
  { icon: BookOpen, label: "My Classes", id: "classes", badge: null },
  { icon: FileText, label: "Assignments", id: "assignments", badge: null },
  { icon: Award, label: "Grades", id: "grades", badge: null },
  { icon: Settings, label: "Settings", id: "settings", badge: null },
]

export default function Dashboard() {
  const [activeView, setActiveView] = useState("dashboard")
  const [userType, setUserType] = useState<'student' | 'teacher' | 'admin' | 'unknown'>('unknown')
  const [loading, setLoading] = useState(true)
  const { user, logout } = useAuth()

  useEffect(() => {
    determineUserType()
  }, [user])

  const determineUserType = async () => {
    try {
      if (!user) {
        setLoading(false)
        return
      }

      const securityManager = getSecurityManager()
      await securityManager.initializeSecurityContext()
      const type = securityManager.getUserType()
      setUserType(type)
    } catch (error) {
      console.error('Error determining user type:', error)
      setUserType('unknown')
    } finally {
      setLoading(false)
    }
  }

  const getUserInitials = () => {
    if (user?.fullname) {
      return user.fullname
        .split(' ')
        .map((name: string) => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  const renderContent = () => {
    // If user is a student, show student dashboard
    if (userType === 'student') {
      return <StudentDashboard />
    }

    // For teachers and admins, show the existing interface
    switch (activeView) {
      case "dashboard":
        return <DashboardView />
      case "classes":
        return <ClassesView />
      case "students":
        return <StudentsView />
      case "assignments":
        return <AssignmentsView />
      case "tests":
        return <TestsView />
      case "settings":
        return <SettingsView />
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

  const getNavigationItems = () => {
    return userType === 'student' ? studentNavigationItems : navigationItems
  }

  const getUserRoleDisplay = () => {
    switch (userType) {
      case 'student':
        return 'Student'
      case 'teacher':
        return 'Teacher'
      case 'admin':
        return 'Administrator'
      default:
        return 'User'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  // For students, show a simplified single-view interface
  if (userType === 'student') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        {/* Student Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
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
                <p className="text-sm text-slate-500">Student Portal</p>
              </div>
            </motion.div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  <p className="font-medium">{user?.fullname || user?.username}</p>
                  <p className="text-slate-500">{getUserRoleDisplay()}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="text-slate-600 hover:text-slate-800"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Student Content */}
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    )
  }

  // For teachers and admins, show the existing sidebar interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex">
      {/* Animated Sidebar */}
      <motion.div
        className="w-64 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-10"
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
            {getNavigationItems().map((item, index) => (
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
                    transition={{ duration: 0.2 }}
                  >
                    <item.icon
                      className={`w-5 h-5 transition-transform duration-300 ${
                        activeView === item.id ? "text-white" : "text-slate-600 group-hover:text-slate-800"
                      }`}
                    />
                    <span
                      className={`font-medium transition-colors duration-300 ${
                        activeView === item.id ? "text-white" : "text-slate-700 group-hover:text-slate-900"
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className={`ml-auto text-xs ${
                          activeView === item.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </motion.div>
                </motion.button>
              </motion.div>
            ))}
          </nav>
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-slate-200">
          <motion.div
            className="flex items-center gap-3 p-3 rounded-lg bg-slate-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.fullname || user?.username}
              </p>
              <p className="text-xs text-slate-500">{getUserRoleDisplay()}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-500 hover:text-slate-700 p-1"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        {/* Header */}
        <motion.header
          className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                {navigationItems.find((item) => item.id === activeView)?.label || activeView}
              </h2>
              <p className="text-sm text-slate-500">Manage your curriculum with ease</p>
            </motion.div>
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search..."
                  className="pl-10 bg-white/70 border-slate-200 focus:bg-white w-64"
                />
              </div>
              <Button variant="outline" className="text-slate-600 hover:text-slate-800">
                <Bell className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        </motion.header>

        {/* Content */}
        <motion.main
          className="flex-1 overflow-auto p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {renderContent()}
        </motion.main>
      </div>
    </div>
  )
}
