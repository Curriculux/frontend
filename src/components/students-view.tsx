"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PlusIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { ploneAPI, PloneStudent } from "@/lib/api"
import { CreateStudentDialog } from "./create-student-dialog"
import { CreateStudentAccountDialog } from "./create-student-account-dialog"
import { CreateTeacherDialog } from "./create-teacher-dialog"
import { StudentModal } from "./student-modal"
import { getSecurityManager, PLONE_ROLES, DataClassification } from "@/lib/security"

export function StudentsView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [students, setStudents] = useState<PloneStudent[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false)
  const [createTeacherDialogOpen, setCreateTeacherDialogOpen] = useState(false)
  const [securityContext, setSecurityContext] = useState<any>(null)
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<PloneStudent | null>(null)
  const [studentModalOpen, setStudentModalOpen] = useState(false)

  const loadStudents = async () => {
    try {
      setLoading(true)
      
      // Initialize security context
      const securityManager = getSecurityManager()
      const context = await securityManager.initializeSecurityContext()
      setSecurityContext(context)
      
      // Load both students and classes data
      const [classesData] = await Promise.all([
        ploneAPI.getClasses()
      ])
      
      setClasses(classesData)

      // Load students with security filtering
      const allStudents: PloneStudent[] = []
      for (const cls of classesData) {
        try {
          // Check if user can access students in this class
          if (context.canAccessStudent('', cls.id)) {
            const classStudents = await ploneAPI.getStudents(cls.id)
            
            // Filter student data based on user permissions
            const filteredStudents = classStudents.map((student: any) => 
              securityManager.filterStudentData(student, { classId: cls.id })
            )
            
            allStudents.push(...filteredStudents)
          }
        } catch (classError) {
          console.warn(`Cannot access students for class ${cls.id}:`, classError)
        }
      }
      
      setStudents(allStudents)



    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const handleStudentCreated = () => {
    loadStudents()
    setCreateDialogOpen(false)
  }

  const getUserRoleDisplay = (): string => {
    if (!securityContext) return 'Loading...'
    
    const securityManager = getSecurityManager()
    return securityManager.getUserRoleDisplay()
  }

  const canViewSensitiveData = (): boolean => {
    return securityContext?.canViewField('phone') || false
  }

  const canAddStudents = (): boolean => {
    return securityContext?.hasPermission('Add portal content') || false
  }

  const handleStudentClick = (student: PloneStudent) => {
    setSelectedStudent(student)
    setStudentModalOpen(true)
  }

  const handleStudentSave = async (updatedStudent: PloneStudent) => {
    try {
      // TODO: Implement student update API call using the class ID
      console.log('Saving student:', updatedStudent)
      await loadStudents() // Refresh the list
    } catch (error) {
      console.error('Error saving student:', error)
      throw error
    }
  }

  // Calculate statistics based on visible data
  const totalStudents = students.length
  const newThisWeek = students.filter(student => {
    if (!student.enrollment_date) return false
    const enrollmentDate = new Date(student.enrollment_date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return enrollmentDate > weekAgo
  }).length

  const averageProgress = totalStudents > 0 
    ? Math.round(students.reduce((sum, student) => sum + (student.progress || 0), 0) / totalStudents)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading students...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading students</p>
          <p className="text-sm text-gray-600">{error}</p>
          <Button 
            onClick={() => loadStudents()} 
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const studentStats = [
    {
      title: "Total Students",
      value: totalStudents.toString(),
      change: totalStudents > 0 ? "Students accessible to you" : "No students accessible",
      trend: totalStudents > 0 ? "up" : "neutral",
      icon: Users,
      color: "from-blue-500 to-cyan-500",
    },
    {
      title: "New This Week", 
      value: newThisWeek.toString(),
      change: "Recent enrollments",
      trend: newThisWeek > 0 ? "up" : "neutral",
      icon: UserPlus,
      color: "from-green-500 to-emerald-500",
    },
    {
      title: "Average Progress",
      value: totalStudents > 0 ? `${averageProgress}%` : "N/A",
      change: "Performance metric",
      trend: averageProgress >= 70 ? "up" : averageProgress >= 50 ? "neutral" : "down",
      icon: Award,
      color: "from-orange-500 to-red-500",
    },
    {
      title: "Your Access Level",
      value: getUserRoleDisplay(),
      change: canViewSensitiveData() ? "Full access" : "Limited access",
      trend: canViewSensitiveData() ? "up" : "neutral",
      icon: Shield,
      color: "from-purple-500 to-pink-500",
    },
  ]

  const filteredStudents = students.filter(student =>
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.student_id && student.student_id.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStudentInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getClassTitle = (classId: string) => {
    const cls = classes.find(c => c.id === classId)
    return cls?.title || 'Unknown Class'
  }

  const renderStudentField = (student: any, field: keyof typeof student, label: string, icon?: any) => {
    if (!securityContext?.canViewField(field)) {
      return (
        <div className="flex items-center text-xs text-slate-400">
          <EyeOff className="w-3 h-3 mr-1" />
          <span>{label}: Restricted</span>
        </div>
      )
    }

    const value = student[field]
    if (!value) return null

    const IconComponent = icon
    return (
      <div className="flex items-center text-xs text-slate-500">
        {IconComponent && <IconComponent className="w-3 h-3 mr-1" />}
        <span className="truncate">{label}: {value}</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Security Notice */}
      {securityContext && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Logged in as <strong>{getUserRoleDisplay()}</strong>. 
            {canViewSensitiveData() 
              ? " You have access to sensitive student information."
              : " You have limited access to student information for privacy protection."
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-600 mt-1">
            {totalStudents > 0 
              ? `Managing ${totalStudents} students across ${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`
              : "No students accessible with your current permissions"
            }
          </p>
        </div>
        <div className="flex space-x-2">
          {canViewSensitiveData() && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSensitiveData(!showSensitiveData)}
            >
              {showSensitiveData ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showSensitiveData ? 'Hide' : 'Show'} Sensitive Data
            </Button>
          )}
          <div className="flex gap-2">
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              disabled={!canAddStudents() || classes.length === 0}
              variant="outline"
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Class
            </Button>
            {securityContext?.isAdmin() && (
              <>
                <Button 
                  onClick={() => setCreateAccountDialogOpen(true)}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 flex-1"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Student
                </Button>
                <Button 
                  onClick={() => setCreateTeacherDialogOpen(true)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 flex-1"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Create Teacher
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Show message if no classes */}
      {classes.length === 0 && (
        <Card className="border-dashed border-2 border-slate-300">
          <CardContent className="p-6 text-center">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No Classes Found</h3>
            <p className="text-slate-500">
              You need access to classes before you can view students.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {studentStats.map((stat, index) => {
          const TrendIcon = stat.trend === "up" ? TrendingUp : stat.trend === "down" ? TrendingDown : Minus
          return (
            <motion.div
              key={`stat-${stat.title}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                      <div className={`flex items-center text-sm ${
                        stat.trend === "up" ? "text-green-600" : 
                        stat.trend === "down" ? "text-red-600" : "text-slate-600"
                      }`}>
                        <TrendIcon className="w-4 h-4 mr-1" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{stat.change}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Search Bar */}
      {totalStudents > 0 && (
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search students by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-slate-600">
            {filteredStudents.length} of {totalStudents} students
          </div>
        </div>
      )}

      {/* Students List */}
      {totalStudents > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student, index) => (
            <motion.div
              key={student.id || student.name || `student-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="group"
            >
              <Card 
                className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => handleStudentClick(student)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={student.avatar} alt={student.name} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                        {getStudentInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {student.name}
                      </h3>
                      <p className="text-sm text-slate-600 truncate">{student.email}</p>
                      
                      {/* Student ID - Educational level */}
                      {renderStudentField(student, 'student_id', 'ID')}
                      
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {getClassTitle(student.classId || '')}
                        </Badge>
                      </div>
                      
                      {/* Progress - Educational level */}
                      {securityContext?.canViewField('progress') && (
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Progress</span>
                            <span className="font-medium">{student.progress || 0}%</span>
                          </div>
                          <Progress value={student.progress || 0} className="h-2" />
                        </div>
                      )}
                      
                      {/* Contact Info - Restricted level */}
                      <div className="mt-3 space-y-1">
                        {showSensitiveData && renderStudentField(student, 'phone', 'Phone', Phone)}
                        {showSensitiveData && renderStudentField(student, 'address', 'Address', MapPin)}
                        {renderStudentField(student, 'grade_level', 'Grade', Award)}
                        {renderStudentField(student, 'enrollment_date', 'Enrolled', Calendar)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : classes.length > 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Students Accessible</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {canAddStudents() 
              ? "Start building your classes by adding students. You can add their information and track progress securely."
              : "You don't have permission to view students or there are no students in classes you have access to."
            }
          </p>
          {canAddStudents() && (
            <Button 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Student
            </Button>
          )}
        </div>
      ) : null}

      {/* No search results */}
      {totalStudents > 0 && filteredStudents.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MagnifyingGlassIcon className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Students Found</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            No students match your search criteria. Try adjusting your search terms.
          </p>
          <Button 
            variant="outline" 
            onClick={() => setSearchTerm("")}
          >
            Clear Search
          </Button>
        </div>
      )}

      {/* Create Student Dialog */}
      <CreateStudentDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onStudentCreated={handleStudentCreated}
        classes={classes}
      />

      {/* Create Student Account Dialog */}
      <CreateStudentAccountDialog
        open={createAccountDialogOpen}
        onOpenChange={setCreateAccountDialogOpen}
        onStudentCreated={handleStudentCreated}
      />

      {/* Create Teacher Account Dialog */}
      {securityContext?.isAdmin() && (
        <CreateTeacherDialog
          open={createTeacherDialogOpen}
          onOpenChange={setCreateTeacherDialogOpen}
          onTeacherCreated={() => {
            // Refresh data after teacher is created
            loadStudents()
          }}
        />
      )}

      {/* Student Detail Modal */}
      <StudentModal
        student={selectedStudent}
        isOpen={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        onSave={handleStudentSave}
        securityContext={securityContext}
        classId={selectedStudent?.classId}
      />
    </div>
  )
}
