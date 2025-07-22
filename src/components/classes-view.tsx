"use client"

import { motion } from "framer-motion"
import { BookOpen, Microscope, Atom, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ChevronRightIcon, ComponentPlaceholderIcon, PlusIcon } from "@radix-ui/react-icons"

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
    description: "Introduction to cellular biology, genetics, and ecosystems",
    assignments: 12,
    completedAssignments: 9,
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
    description: "Advanced placement chemistry covering organic and inorganic compounds",
    assignments: 15,
    completedAssignments: 10,
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
    description: "Hands-on physics experiments and theoretical applications",
    assignments: 8,
    completedAssignments: 7,
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
    description: "Study of environmental systems and sustainability practices",
    assignments: 10,
    completedAssignments: 9,
  },
  {
    title: "Advanced Biology",
    students: 22,
    progress: 73,
    nextClass: "Wednesday 1:00 PM",
    recentActivity: "DNA extraction lab",
    image: "/placeholder.svg?height=200&width=300",
    color: "from-teal-400 to-green-600",
    icon: Microscope,
    engagement: 94,
    description: "Advanced topics in molecular biology and biotechnology",
    assignments: 14,
    completedAssignments: 10,
  },
  {
    title: "General Chemistry",
    students: 45,
    progress: 56,
    nextClass: "Thursday 9:00 AM",
    recentActivity: "Periodic table quiz",
    image: "/placeholder.svg?height=200&width=300",
    color: "from-indigo-400 to-blue-600",
    icon: Atom,
    engagement: 76,
    description: "Fundamental chemistry concepts and laboratory techniques",
    assignments: 11,
    completedAssignments: 6,
  },
]

export function ClassesView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">My Classes</h1>
          <p className="text-slate-600 mt-2">Manage your courses and track student progress</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
          <PlusIcon className="w-4 h-4 mr-2" />
          Create New Class
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Classes</p>
              <p className="text-3xl font-bold">{classes.length}</p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-500 to-emerald-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Total Students</p>
              <p className="text-3xl font-bold">{classes.reduce((sum, cls) => sum + cls.students, 0)}</p>
            </div>
            <BookOpen className="w-8 h-8 text-green-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Avg Progress</p>
              <p className="text-3xl font-bold">
                {Math.round(classes.reduce((sum, cls) => sum + cls.progress, 0) / classes.length)}%
              </p>
            </div>
            <BookOpen className="w-8 h-8 text-orange-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Avg Engagement</p>
              <p className="text-3xl font-bold">
                {Math.round(classes.reduce((sum, cls) => sum + cls.engagement, 0) / classes.length)}%
              </p>
            </div>
            <BookOpen className="w-8 h-8 text-purple-200" />
          </div>
        </Card>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((classItem, index) => (
          <motion.div
            key={classItem.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className="group cursor-pointer"
          >
            <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="relative h-48 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${classItem.color} opacity-90`} />
                <img
                  src={classItem.image || "/placeholder.svg"}
                  alt={classItem.title}
                  className="w-full h-full object-cover mix-blend-overlay"
                />
                <div className="absolute top-4 right-4">
                  <classItem.icon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="text-xl font-bold">{classItem.title}</h3>
                  <p className="text-sm opacity-90">{classItem.students} students</p>
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                <p className="text-sm text-slate-600">{classItem.description}</p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Course Progress</span>
                    <span className="font-semibold text-slate-800">{classItem.progress}%</span>
                  </div>
                  <Progress value={classItem.progress} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Assignments:</span>
                    <p className="font-medium text-slate-800">
                      {classItem.completedAssignments}/{classItem.assignments}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Engagement:</span>
                    <p className="font-medium text-slate-800">{classItem.engagement}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Next Class:</span>
                    <span className="text-sm font-medium text-slate-800">{classItem.nextClass}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Recent:</span>
                    <Badge variant="secondary" className="text-xs">
                      {classItem.recentActivity}
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  <Button size="sm" className="bg-gradient-to-r from-blue-600 to-cyan-600">
                    Manage <ChevronRightIcon className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
