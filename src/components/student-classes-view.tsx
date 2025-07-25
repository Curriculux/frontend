"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BookOpen, Calendar, Clock, GraduationCap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { ploneAPI, PloneClass } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { getSecurityManager } from '@/lib/security'
import { StudentClassDetailsModal } from './student-class-details-modal'

interface StudentClass extends PloneClass {
  assignments?: any[]
  averageGrade?: number
  completedAssignments?: number
  totalAssignments?: number
  nextAssignment?: any
  progress?: number
}

export function StudentClassesView() {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<StudentClass[]>([])
  const [selectedClass, setSelectedClass] = useState<StudentClass | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const { user } = useAuth()

  useEffect(() => {
    initializeAndLoadData()
  }, [])

  const initializeAndLoadData = async () => {
    try {
      const securityManager = getSecurityManager()
      const context = await securityManager.initializeSecurityContext()
      setCurrentUser(context.user)
      await loadStudentClasses()
    } catch (error) {
      console.error('Failed to initialize security context:', error)
      await loadStudentClasses() // Fallback to load classes anyway
    }
  }

  const loadStudentClasses = async () => {
    try {
      setLoading(true)
      
      // Get classes for the student
      const studentClasses = await ploneAPI.getStudentClasses(user?.username ?? '')
      
      // Enhance each class with assignment data
      const enhancedClasses = await Promise.all(
        studentClasses.map(async (cls: PloneClass) => {
          try {
            const assignments = await ploneAPI.getStudentAssignments(user?.username ?? '', cls.id ?? '')
            const completedAssignments = assignments.filter(a => a.status === 'submitted' || a.status === 'graded').length
            const totalAssignments = assignments.length
            const nextAssignment = assignments.find(a => a.status === 'pending')
            
            // Calculate average grade
            const gradedAssignments = assignments.filter(a => a.grade !== undefined)
            const averageGrade = gradedAssignments.length > 0
              ? gradedAssignments.reduce((sum, a) => sum + a.grade, 0) / gradedAssignments.length
              : 0
            
            return {
              ...cls,
              assignments,
              completedAssignments,
              totalAssignments,
              nextAssignment,
              averageGrade,
              progress: totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0
            }
          } catch (error) {
            console.error(`Error loading data for class ${cls.id}:`, error)
            return cls
          }
        })
      )
      
      setClasses(enhancedClasses)
    } catch (error) {
      console.error('Error loading student classes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClassClick = (classItem: StudentClass) => {
    setSelectedClass(classItem)
    setModalOpen(true)
  }

  const getClassColor = (subject: string) => {
    const colorMap: { [key: string]: string } = {
      "Mathematics": "from-blue-400 to-indigo-600",
      "Science": "from-green-400 to-teal-600",
      "English Language Arts": "from-purple-400 to-pink-600",
      "Social Studies": "from-orange-400 to-red-600",
      "Computer Science": "from-cyan-400 to-blue-600",
      "Art": "from-pink-400 to-rose-600",
      "Music": "from-violet-400 to-purple-600",
      "Physical Education": "from-yellow-400 to-orange-600",
      "Foreign Language": "from-indigo-400 to-purple-600",
    }
    return colorMap[subject] || "from-gray-400 to-gray-600"
  }

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "text-green-600"
    if (grade >= 80) return "text-blue-600"
    if (grade >= 70) return "text-yellow-600"
    if (grade >= 60) return "text-orange-600"
    return "text-red-600"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Classes</h1>
          <p className="text-slate-600 mt-1">
            {classes.length > 0 
              ? `You're enrolled in ${classes.length} ${classes.length === 1 ? 'class' : 'classes'} this semester`
              : "You're not enrolled in any classes yet"
            }
          </p>
        </div>
      </div>

      {/* Classes Grid */}
      {classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem, index) => (
            <motion.div
              key={classItem['@id']}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="group"
            >
              <Card 
                className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
                onClick={() => handleClassClick(classItem)}
              >
                {/* Class Header */}
                <div className={`h-32 bg-gradient-to-br ${getClassColor(classItem.subject || '')} relative`}>
                  <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                  <div className="absolute top-4 left-4 text-white">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="bg-white bg-opacity-20 text-white border-white border-opacity-30">
                      {classItem.grade_level || 'Grade N/A'}
                    </Badge>
                  </div>
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="font-semibold text-lg">{classItem.title}</h3>
                    <p className="text-sm opacity-90">{classItem.subject}</p>
                  </div>
                </div>

                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Teacher Info */}
                    {classItem.teacher && (
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-slate-200">
                            {classItem.teacher.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{classItem.teacher}</p>
                          <p className="text-xs text-slate-500">Instructor</p>
                        </div>
                      </div>
                    )}

                                         {/* Progress */}
                    {(classItem.totalAssignments ?? 0) > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Progress</span>
                          <span className="font-medium">
                            {classItem.completedAssignments ?? 0}/{classItem.totalAssignments ?? 0} assignments
                          </span>
                        </div>
                        <Progress value={classItem.progress ?? 0} className="h-2" />
                      </div>
                    )}

                    {/* Grade */}
                    {(classItem.averageGrade ?? 0) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Current Grade</span>
                        <span className={`text-sm font-bold ${getGradeColor(classItem.averageGrade ?? 0)}`}>
                          {(classItem.averageGrade ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    )}

                    {/* Next Assignment */}
                    {classItem.nextAssignment && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">Next Due</p>
                            <p className="text-xs text-slate-600 truncate">{classItem.nextAssignment.title}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">
                              {classItem.nextAssignment.dueDate 
                                ? new Date(classItem.nextAssignment.dueDate).toLocaleDateString()
                                : 'No due date'
                              }
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {classItem.nextAssignment.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Click instruction */}
                    <div className="pt-2 text-center">
                      <p className="text-xs text-gray-500 opacity-70 group-hover:opacity-100 transition-opacity">
                        Click to view class details
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Classes Yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            You're not enrolled in any classes. Contact your school administrator to get enrolled in classes.
          </p>
        </div>
      )}

      {/* Student Class Details Modal */}
      <StudentClassDetailsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        classData={selectedClass}
        studentUsername={currentUser?.username || user?.username}
      />
    </div>
  )
} 