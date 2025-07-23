"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Upload,
  Eye,
  TrendingUp,
  Award,
  User,
  GraduationCap,
  Target
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ploneAPI, PloneClass, PloneAssignment } from "@/lib/api"
import { getSecurityManager } from "@/lib/security"
import { AssignmentSubmissionDialog } from "./assignment-submission-dialog"
import { toast } from "sonner"

interface StudentClass extends PloneClass {
  assignments?: PloneAssignment[]
  averageGrade?: number
  completedAssignments?: number
  totalAssignments?: number
}

interface StudentAssignment extends PloneAssignment {
  status: 'pending' | 'submitted' | 'graded' | 'overdue'
  grade?: number
  submittedAt?: string
  feedback?: string
}

export function StudentDashboard() {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<StudentClass[]>([])
  const [assignments, setAssignments] = useState<StudentAssignment[]>([])
  const [studentInfo, setStudentInfo] = useState<any>(null)
  const [securityContext, setSecurityContext] = useState<any>(null)
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignment | null>(null)

  useEffect(() => {
    loadStudentData()
  }, [])

  const loadStudentData = async () => {
    try {
      setLoading(true)
      
      // Initialize security context
      const securityManager = getSecurityManager()
      const context = await securityManager.initializeSecurityContext()
      setSecurityContext(context)

      if (!context.isStudent()) {
        toast.error('Access denied: Student role required')
        return
      }

      // Load student's own data
      const user = context.user
      setStudentInfo(user)

      // Load student's enrolled classes
      console.log('Loading classes for student:', user.username)
      const enrolledClasses = await ploneAPI.getStudentClasses(user.username)
      console.log('Found enrolled classes:', enrolledClasses)
      
      const studentClasses: StudentClass[] = []
      const allAssignments: StudentAssignment[] = []

      for (const cls of enrolledClasses) {
        try {
          // Load assignments for this class
          const classAssignments = await ploneAPI.getAssignments(cls.id!)
          
          // Convert to student assignments with status
                     const studentAssignments: StudentAssignment[] = classAssignments.map((assignment: PloneAssignment) => ({
            ...assignment,
            status: getAssignmentStatus(assignment),
            grade: Math.floor(Math.random() * 100), // Mock grade for demo
            submittedAt: Math.random() > 0.5 ? new Date().toISOString() : undefined
          }))

          const completedAssignments = studentAssignments.filter(a => a.status === 'submitted' || a.status === 'graded').length
          const averageGrade = studentAssignments
            .filter(a => a.grade !== undefined)
            .reduce((sum, a) => sum + (a.grade || 0), 0) / studentAssignments.filter(a => a.grade !== undefined).length

          studentClasses.push({
            ...cls,
            assignments: studentAssignments,
            averageGrade: isNaN(averageGrade) ? undefined : Math.round(averageGrade),
            completedAssignments,
            totalAssignments: studentAssignments.length
          })

          allAssignments.push(...studentAssignments)
        } catch (error) {
          console.warn(`Cannot load assignments for class ${cls.id}:`, error)
        }
      }

      setClasses(studentClasses)
      setAssignments(allAssignments.sort((a, b) => {
        // Sort by due date, with overdue first
        if (a.status === 'overdue' && b.status !== 'overdue') return -1
        if (b.status === 'overdue' && a.status !== 'overdue') return 1
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        }
        return 0
      }))

    } catch (error) {
      console.error('Error loading student data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const getAssignmentStatus = (assignment: PloneAssignment): StudentAssignment['status'] => {
    // Mock logic for assignment status
    if (assignment.dueDate && new Date(assignment.dueDate) < new Date()) {
      return Math.random() > 0.7 ? 'overdue' : 'submitted'
    }
    if (Math.random() > 0.6) {
      return 'submitted'
    }
    return 'pending'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'graded':
        return <Award className="h-4 w-4 text-blue-500" />
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-100 text-green-800'
      case 'graded':
        return 'bg-blue-100 text-blue-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const handleSubmitAssignment = (assignment: StudentAssignment) => {
    setSelectedAssignment(assignment)
    setSubmissionDialogOpen(true)
  }

  const handleSubmissionComplete = () => {
    // Reload student data to reflect the new submission
    loadStudentData()
  }

  // Calculate dashboard stats
  const totalAssignments = assignments.length
  const completedAssignments = assignments.filter(a => a.status === 'submitted' || a.status === 'graded').length
  const overdueAssignments = assignments.filter(a => a.status === 'overdue').length
  const overallGrade = assignments
    .filter(a => a.grade !== undefined)
    .reduce((sum, a) => sum + (a.grade || 0), 0) / assignments.filter(a => a.grade !== undefined).length

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
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome back, {studentInfo?.fullname || 'Student'}! Ready to learn today?</p>
        </div>
        <Avatar className="h-12 w-12">
          <AvatarImage src={studentInfo?.avatar} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
            <User className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 * 0.1 }}
        >
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">My Classes</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-slate-900">{classes.length}</span>
                </div>
                <p className="text-xs text-slate-500">Enrolled this semester</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 * 0.1 }}
        >
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Assignments</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-slate-900">{completedAssignments}/{totalAssignments}</span>
                </div>
                <p className="text-xs text-slate-500">Completed assignments</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 * 0.1 }}
        >
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Overall Grade</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-slate-900">
                    {isNaN(overallGrade) ? '--' : `${Math.round(overallGrade)}%`}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Current average</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3 * 0.1 }}
        >
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Overdue</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-slate-900 text-red-600">{overdueAssignments}</span>
                </div>
                <p className="text-xs text-slate-500">Assignments overdue</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Alerts */}
      {overdueAssignments > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have {overdueAssignments} overdue assignment{overdueAssignments > 1 ? 's' : ''}. 
            Please check with your teachers about late submission policies.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Assignments */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Upcoming Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No assignments found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignments.slice(0, 5).map((assignment) => (
                  <div key={assignment['@id']} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{assignment.title}</h4>
                      <p className="text-xs text-slate-500">
                        {classes.find(c => c.id === assignment.classId)?.title || 'Unknown Class'}
                      </p>
                      {assignment.dueDate && (
                        <p className="text-xs text-slate-400">
                          Due: {new Date(assignment.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(assignment.status)}
                      <Badge className={getStatusColor(assignment.status)} variant="outline">
                        {assignment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Classes Overview */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              My Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No classes found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {classes.slice(0, 4).map((cls) => (
                  <div key={cls['@id']} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{cls.title}</h4>
                      {cls.averageGrade !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          {cls.averageGrade}%
                        </Badge>
                      )}
                    </div>
                    {cls.averageGrade !== undefined && (
                      <Progress value={cls.averageGrade} className="h-2" />
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      {cls.completedAssignments || 0}/{cls.totalAssignments || 0} assignments completed
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignment Submission Dialog */}
      {selectedAssignment && (
        <AssignmentSubmissionDialog
          open={submissionDialogOpen}
          onOpenChange={setSubmissionDialogOpen}
          assignment={{
            id: selectedAssignment.id || (selectedAssignment['@id'] ? selectedAssignment['@id'].split('/').pop() : '') || 'unknown',
            title: selectedAssignment.title,
            description: selectedAssignment.description,
            classId: selectedAssignment.classId || '',
            dueDate: selectedAssignment.dueDate,
            points: selectedAssignment.points,
            status: selectedAssignment.status
          }}
          onSubmissionComplete={handleSubmissionComplete}
        />
      )}
    </div>
  )
} 