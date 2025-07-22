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

      // Load student's classes
      const allClasses = await ploneAPI.getClasses()
      
      // TODO: Filter classes to only those the student is enrolled in
      // For now, show all classes as if student is enrolled
      const studentClasses: StudentClass[] = []
      const allAssignments: StudentAssignment[] = []

      for (const cls of allClasses) {
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {studentInfo?.fullname || 'Student'}!</p>
        </div>
        <Avatar className="h-12 w-12">
          <AvatarImage src={studentInfo?.avatar} />
          <AvatarFallback>
            <User className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
            <p className="text-xs text-muted-foreground">Enrolled this semester</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedAssignments}/{totalAssignments}</div>
            <p className="text-xs text-muted-foreground">Completed assignments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Grade</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isNaN(overallGrade) ? '--' : `${Math.round(overallGrade)}%`}
            </div>
            <p className="text-xs text-muted-foreground">Current average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueAssignments}</div>
            <p className="text-xs text-muted-foreground">Assignments overdue</p>
          </CardContent>
        </Card>
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

      {/* Main Content Tabs */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="classes">My Classes</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          <div className="grid gap-4">
            {assignments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No assignments found</h3>
                  <p className="text-muted-foreground text-center">
                    Your teachers haven't assigned any work yet, or you're not enrolled in any classes.
                  </p>
                </CardContent>
              </Card>
            ) : (
              assignments.slice(0, 10).map((assignment) => (
                <motion.div
                  key={assignment['@id']}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{assignment.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {classes.find(c => c.id === assignment.classId)?.title || 'Unknown Class'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(assignment.status)}
                          <Badge className={getStatusColor(assignment.status)}>
                            {assignment.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {assignment.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          {assignment.dueDate && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          {assignment.points && (
                            <div className="flex items-center space-x-1">
                              <Target className="h-4 w-4" />
                              <span>{assignment.points} points</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {assignment.status === 'pending' && (
                            <Button size="sm" onClick={() => handleSubmitAssignment(assignment)}>
                              <Upload className="h-4 w-4 mr-2" />
                              Submit
                            </Button>
                          )}
                          {assignment.status === 'graded' && assignment.grade && (
                            <Badge variant="outline" className="text-blue-600">
                              Grade: {assignment.grade}%
                            </Badge>
                          )}
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="classes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {classes.map((cls) => (
              <motion.div
                key={cls['@id']}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{cls.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{cls.description}</p>
                      </div>
                      <GraduationCap className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {cls.averageGrade !== undefined && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span>Current Grade</span>
                            <span className="font-semibold">{cls.averageGrade}%</span>
                          </div>
                          <Progress value={cls.averageGrade} className="h-2" />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span>Assignments Completed</span>
                        <span>{cls.completedAssignments || 0}/{cls.totalAssignments || 0}</span>
                      </div>
                      <Button className="w-full" variant="outline">
                        View Class Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grade Report</CardTitle>
              <p className="text-muted-foreground">Your current grades across all classes</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {classes.map((cls) => (
                  <div key={cls['@id']} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-semibold">{cls.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {cls.completedAssignments || 0} assignments completed
                      </p>
                    </div>
                    <div className="text-right">
                      {cls.averageGrade !== undefined ? (
                        <div className="text-2xl font-bold">{cls.averageGrade}%</div>
                      ) : (
                        <div className="text-muted-foreground">No grades yet</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Submission Dialog */}
      {selectedAssignment && (
        <AssignmentSubmissionDialog
          open={submissionDialogOpen}
          onOpenChange={setSubmissionDialogOpen}
          assignment={{
            id: selectedAssignment.id!,
            title: selectedAssignment.title,
            description: selectedAssignment.description,
            classId: selectedAssignment.classId!,
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