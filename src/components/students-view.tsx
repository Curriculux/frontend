"use client"

import { motion } from "framer-motion"
import { Users, UserPlus, Activity, TrendingUp, AlertTriangle, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { MagnifyingGlassIcon } from "@radix-ui/react-icons"

const studentStats = [
  {
    title: "Total Students",
    value: "127",
    change: "+8 this month",
    icon: Users,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Active This Week",
    value: "119",
    change: "94% participation",
    icon: Activity,
    color: "from-green-500 to-emerald-500",
  },
  {
    title: "Avg Performance",
    value: "87%",
    change: "+5% from last month",
    icon: TrendingUp,
    color: "from-orange-500 to-red-500",
  },
  {
    title: "Need Attention",
    value: "8",
    change: "Requires follow-up",
    icon: AlertTriangle,
    color: "from-purple-500 to-pink-500",
  },
]

const recentStudents = [
  {
    name: "Emma Rodriguez",
    email: "emma.rodriguez@school.edu",
    class: "Chemistry AP",
    grade: 92,
    status: "active",
    avatar: "/placeholder.svg?height=40&width=40",
    lastActivity: "2 hours ago",
    assignments: { completed: 14, total: 15 },
  },
  {
    name: "Marcus Johnson",
    email: "marcus.johnson@school.edu",
    class: "Biology 9th Grade",
    grade: 88,
    status: "active",
    avatar: "/placeholder.svg?height=40&width=40",
    lastActivity: "1 day ago",
    assignments: { completed: 11, total: 12 },
  },
  {
    name: "Sarah Chen",
    email: "sarah.chen@school.edu",
    class: "Physics Lab",
    grade: 95,
    status: "active",
    avatar: "/placeholder.svg?height=40&width=40",
    lastActivity: "3 hours ago",
    assignments: { completed: 8, total: 8 },
  },
  {
    name: "Alex Kim",
    email: "alex.kim@school.edu",
    class: "Environmental Science",
    grade: 78,
    status: "needs-attention",
    avatar: "/placeholder.svg?height=40&width=40",
    lastActivity: "1 week ago",
    assignments: { completed: 6, total: 10 },
  },
  {
    name: "Jordan Martinez",
    email: "jordan.martinez@school.edu",
    class: "Chemistry AP",
    grade: 91,
    status: "active",
    avatar: "/placeholder.svg?height=40&width=40",
    lastActivity: "5 hours ago",
    assignments: { completed: 13, total: 15 },
  },
  {
    name: "Taylor Wilson",
    email: "taylor.wilson@school.edu",
    class: "Biology 9th Grade",
    grade: 85,
    status: "active",
    avatar: "/placeholder.svg?height=40&width=40",
    lastActivity: "1 day ago",
    assignments: { completed: 10, total: 12 },
  },
]

export function StudentsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Students</h1>
          <p className="text-slate-600 mt-2">Monitor student progress and engagement across all classes</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Users className="w-4 h-4 mr-2" />
            Import Students
          </Button>
          <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {studentStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -2, scale: 1.02 }}
          >
            <Card className={`p-6 bg-gradient-to-br ${stat.color} text-white border-0 shadow-lg`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-white/70 text-xs mt-1">{stat.change}</p>
                </div>
                <stat.icon className="w-8 h-8 text-white/60" />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search and Filter */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Student Roster</CardTitle>
            <div className="flex gap-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input placeholder="Search students..." className="pl-10 w-64" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentStudents.map((student, index) => (
              <motion.div
                key={student.email}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer group"
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={student.avatar || "/placeholder.svg"} />
                  <AvatarFallback>
                    {student.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-slate-800">{student.name}</h3>
                    <Badge variant={student.status === "active" ? "default" : "destructive"} className="text-xs">
                      {student.status === "active" ? "Active" : "Needs Attention"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">{student.email}</p>
                  <p className="text-sm text-blue-600 font-medium">{student.class}</p>
                </div>

                <div className="text-right min-w-0">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Grade</p>
                      <p className="text-lg font-bold text-slate-800">{student.grade}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Assignments</p>
                      <p className="text-sm font-medium text-slate-800">
                        {student.assignments.completed}/{student.assignments.total}
                      </p>
                      <Progress
                        value={(student.assignments.completed / student.assignments.total) * 100}
                        className="w-16 h-1 mt-1"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Last Active</p>
                      <p className="text-sm text-slate-800">{student.lastActivity}</p>
                    </div>
                  </div>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm">
                    View Profile
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-slate-600">Showing {recentStudents.length} of 127 students</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
