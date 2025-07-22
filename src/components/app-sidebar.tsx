"use client"

import { motion } from "framer-motion"
import { Home, BookOpen, Users, FileText, TrendingUp, Award, Beaker } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { GearIcon } from "@radix-ui/react-icons"

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

interface AppSidebarProps {
  activeView: string
  setActiveView: (view: string) => void
}

export function AppSidebar({ activeView, setActiveView }: AppSidebarProps) {
  return (
    <Sidebar className="border-r-0 bg-gradient-to-b from-slate-50 to-slate-100">
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

      <SidebarContent className="p-4">
        <SidebarMenu>
          {navigationItems.map((item, index) => (
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
    </Sidebar>
  )
}
