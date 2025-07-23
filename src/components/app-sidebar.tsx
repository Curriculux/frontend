"use client"

import { motion } from "framer-motion"
import { Home, BookOpen, Users, FileText, Award, Calendar, Settings, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth"
import { getSecurityManager } from "@/lib/security"

const navigationItems = [
  { 
    icon: Home, 
    label: "Dashboard", 
    id: "dashboard", 
    badge: null,
    roles: ['Member', 'Teacher', 'Dean', 'Manager'] // Available to all authenticated users
  },
  { 
    icon: BookOpen, 
    label: "My Classes", 
    id: "classes", 
    badge: 4,
    roles: ['Member', 'Teacher', 'Dean', 'Manager'] // Students see enrolled classes, teachers see teaching classes
  },
  { 
    icon: Users, 
    label: "Students", 
    id: "students", 
    badge: 127,
    roles: ['Teacher', 'Dean', 'Manager'] // Only staff can view student information
  },
  { 
    icon: FileText, 
    label: "Assignments", 
    id: "assignments", 
    badge: 8,
    roles: ['Member', 'Teacher', 'Dean', 'Manager'] // Students see their assignments, teachers see class assignments
  },
  { 
    icon: Award, 
    label: "Tests", 
    id: "tests", 
    badge: 3,
    roles: ['Member', 'Teacher', 'Dean', 'Manager'] // Students see their tests, teachers see class tests
  },
  { 
    icon: Calendar, 
    label: "Calendar", 
    id: "calendar", 
    badge: null,
    roles: ['Member', 'Teacher', 'Dean', 'Manager'] // Available to all authenticated users
  },
  { 
    icon: Settings, 
    label: "Settings", 
    id: "settings", 
    badge: null,
    roles: ['Member', 'Teacher', 'Dean', 'Manager'] // Available to all authenticated users
  },
]

interface AppSidebarProps {
  activeView: string
  setActiveView: (view: string) => void
}

export function AppSidebar({ activeView, setActiveView }: AppSidebarProps) {
  const { user, logout } = useAuth()

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

  const getUserRoleDisplay = () => {
    try {
      const securityManager = getSecurityManager()
      return securityManager.getUserRoleDisplay()
    } catch {
      return 'User'
    }
  }

  // Filter navigation items based on user roles using security manager
  const getFilteredNavigationItems = () => {
    if (!user) {
      return []
    }

    try {
      const securityManager = getSecurityManager()
      const userType = securityManager.getUserType()
      
      // Filter based on user type detected by security manager
      return navigationItems.filter(item => {
        // Students only see items that include 'Member' in roles
        if (userType === 'student') {
          return item.roles.includes('Member')
        }
        // Teachers and admins see items based on their actual roles
        return item.roles.some(requiredRole => user.roles?.includes(requiredRole))
      })
    } catch (error) {
      console.error('Error filtering navigation items:', error)
      return []
    }
  }

  const filteredNavigationItems = getFilteredNavigationItems()

  return (
    <Sidebar className="border-r-0 bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      <SidebarHeader className="p-6 border-b border-slate-200">
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
      </SidebarHeader>

      <SidebarContent className="p-4 flex-1">
        <SidebarMenu>
          {filteredNavigationItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveView(item.id)}
                  className={`group relative overflow-hidden transition-all duration-300 cursor-pointer ${
                    activeView === item.id
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                      : "hover:bg-slate-200 hover:scale-105"
                  }`}
                >
                  <motion.div
                    className="flex items-center gap-3 w-full"
                    whileHover={{ x: 2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <item.icon className={`w-5 h-5 ${activeView === item.id ? "text-white" : "text-slate-600"}`} />
                    <span className={`font-medium ${activeView === item.id ? "text-white" : "text-slate-700"}`}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto">
                        <Badge
                          variant="secondary"
                          className={`${
                            activeView === item.id ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                          } font-semibold`}
                        >
                          {item.badge}
                        </Badge>
                      </motion.div>
                    )}
                  </motion.div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </motion.div>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-200 mt-auto">
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
              {user?.fullname || user?.username || 'User'}
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
      </SidebarFooter>
    </Sidebar>
  )
}
