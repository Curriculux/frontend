"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Users,
  UserPlus,
  Phone,
  MapPin,
  Calendar,
  Award,
  BookOpen,
  Loader2,
  Plus,
  Shield,
  Eye,
  EyeOff,
  User,
  Building,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PlusIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { ploneAPI, PloneStudent, PloneTeacher } from "@/lib/api"
import { CreateStudentAccountDialog } from "./create-student-account-dialog"
import { CreateTeacherDialog } from "./create-teacher-dialog"
import { StudentModal } from "./student-modal"
import { TeacherModal } from "./teacher-modal"
import { getSecurityManager, PLONE_ROLES, DataClassification } from "@/lib/security"

export function StudentsView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [students, setStudents] = useState<PloneStudent[]>([])
  const [teachers, setTeachers] = useState<PloneTeacher[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false)
  const [createTeacherDialogOpen, setCreateTeacherDialogOpen] = useState(false)
  const [securityContext, setSecurityContext] = useState<any>(null)
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<PloneStudent | null>(null)
  const [selectedTeacher, setSelectedTeacher] = useState<PloneTeacher | null>(null)
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [teacherModalOpen, setTeacherModalOpen] = useState(false)
  const [viewType, setViewType] = useState<'students' | 'teachers' | 'all'>('students')

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Initialize security context
      const securityManager = getSecurityManager()
      const context = await securityManager.initializeSecurityContext()
      setSecurityContext(context)
      
      // Load classes data and teachers (if admin)
      const teachersPromise = context.isAdmin() ? ploneAPI.getTeachers() : Promise.resolve([]);
      
      const [classesData, teachersData] = await Promise.all([
        ploneAPI.getClasses(),
        teachersPromise
      ])
      
      setClasses(classesData)
      setTeachers(teachersData)

      // Load ALL students in the system (not just class-enrolled students)
      let allStudents: PloneStudent[] = []
      let hasStudentAccess = false
      
      try {
        // Check if user has permission to view students (use any class for permission check)
        const canAccessStudents = classesData.length > 0 
          ? context.canAccessStudent('', classesData[0].id)
          : context.canAccessStudent('', '') // General student access check
        
        console.log(`Student access permission check:`, canAccessStudents)
        
        if (canAccessStudents) {
          hasStudentAccess = true
          
          // Get ALL students in the system using the direct API method
          const allSystemStudents = await ploneAPI.getUsersByType('students') as PloneStudent[]
          console.log(`Found ${allSystemStudents.length} total students in system:`, allSystemStudents)
          
          // Filter student data based on user permissions  
          allStudents = allSystemStudents.map((student: any) => 
            securityManager.filterStudentData(student, { })
          )
          
          console.log(`After filtering: ${allStudents.length} students accessible`)
        } else {
          console.warn(`Access denied to student data`)
        }
      } catch (error) {
        console.error('Error loading students:', error)
        hasStudentAccess = false
      }
      
      // Store whether user has access to students (for proper error messaging)
      sessionStorage.setItem('hasStudentAccess', hasStudentAccess.toString())
      
      // Deduplicate students who may be enrolled in multiple classes
      const uniqueStudents = allStudents.reduce((unique: PloneStudent[], student) => {
        // Use student_id as the primary unique identifier, then email, then name
        const existingIndex = unique.findIndex(s => {
          // Priority 1: Match by student_id (most reliable)
          if (s.student_id && student.student_id && s.student_id === student.student_id) {
            return true;
          }
          // Priority 2: Match by email
          if (s.email && student.email && s.email === student.email) {
            return true;
          }
          // Priority 3: Match by name and email combination (fallback)
          if (s.name === student.name && s.email === student.email) {
            return true;
          }
          return false;
        });
        
        if (existingIndex === -1) {
          // New student - add to unique list
          unique.push(student)
        } else {
          // Duplicate student found - merge class information
          console.log(`Student ${student.name} found in multiple classes`)
          const existing = unique[existingIndex]
          
          // Merge classes if we have class info
          if (student.classId && existing.classId !== student.classId) {
            // Create or update classes array
            if (!existing.classes) {
              existing.classes = [existing.classId, student.classId].filter((id): id is string => Boolean(id))
            } else if (!existing.classes.includes(student.classId)) {
              existing.classes.push(student.classId)
            }
          }
        }
        
        return unique
      }, [])
      
      setStudents(uniqueStudents)



    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleStudentCreated = () => {
    loadData()
    setCreateAccountDialogOpen(false)
  }

  const getUserRoleDisplay = (): string => {
    if (!securityContext) return 'Loading...'
    
    const securityManager = getSecurityManager()
    return securityManager.getUserRoleDisplay()
  }

  const canViewSensitiveData = (): boolean => {
    return securityContext?.canViewField('phone') || false
  }

  const handleStudentClick = (student: PloneStudent) => {
    setSelectedStudent(student)
    setStudentModalOpen(true)
  }

  const handleTeacherClick = (teacher: PloneTeacher) => {
    setSelectedTeacher(teacher)
    setTeacherModalOpen(true)
  }

  const handleStudentSave = async (updatedStudent: PloneStudent) => {
    try {
      // TODO: Implement student update API call using the class ID
      console.log('Saving student:', updatedStudent)
      await loadData() // Refresh the list
    } catch (error) {
      console.error('Error saving student:', error)
      throw error
    }
  }

  const handleStudentDelete = async (deletedStudent: PloneStudent) => {
    try {
      await loadData() // Refresh the list after deletion
    } catch (error) {
      console.error('Error refreshing after deletion:', error)
    }
  }

  const handleTeacherSave = async (updatedTeacher: PloneTeacher) => {
    try {
      // TODO: Implement teacher update API call
      console.log('Saving teacher:', updatedTeacher)
      await loadData() // Refresh the list
    } catch (error) {
      console.error('Error saving teacher:', error)
      throw error
    }
  }

  const handleTeacherDelete = async (deletedTeacher: PloneTeacher & { deleteUserAccount?: boolean }) => {
    try {
      console.log('Deleting teacher:', deletedTeacher)
      
      // Call the API to delete the teacher
      const result = await ploneAPI.deleteTeacher(deletedTeacher)
      
      if (result.errors.length > 0) {
        console.warn('Teacher deletion completed with errors:', result.errors)
        // Still refresh the list as some parts may have succeeded
      }
      
      // Refresh the list after deletion
      await loadData()
    } catch (error) {
      console.error('Error deleting teacher:', error)
      throw error
    }
  }

  // Calculate basic statistics for other functionality
  const totalStudents = students.length

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
            onClick={() => loadData()} 
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }



  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.student_id && student.student_id.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredTeachers = teachers.filter(teacher =>
    teacher.fullname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (teacher.department && teacher.department.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Combined filtered data based on view type
  const getFilteredData = () => {
    switch (viewType) {
      case 'students':
        return filteredStudents.map(s => ({ ...s, type: 'student' as const }))
      case 'teachers':
        return filteredTeachers.map(t => ({ ...t, type: 'teacher' as const }))
      case 'all':
        return [
          ...filteredStudents.map(s => ({ ...s, type: 'student' as const })),
          ...filteredTeachers.map(t => ({ ...t, type: 'teacher' as const }))
        ]
      default:
        return []
    }
  }

  const getStudentInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getTeacherInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900">
              {viewType === 'students' ? 'Students' : viewType === 'teachers' ? 'Teachers' : 'All Users'}
            </h1>
            {securityContext?.isAdmin() && (
              <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
                <Button
                  variant={viewType === 'students' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('students')}
                  className="text-xs"
                >
                  Students ({students.length})
                </Button>
                <Button
                  variant={viewType === 'teachers' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('teachers')}
                  className="text-xs"
                >
                  Teachers ({teachers.length})
                </Button>
                <Button
                  variant={viewType === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('all')}
                  className="text-xs"
                >
                  All ({students.length + teachers.length})
                </Button>
              </div>
            )}
          </div>
          <p className="text-slate-600 mt-1">
            {viewType === 'students' && totalStudents > 0 
              ? `Managing ${totalStudents} students across ${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`
              : viewType === 'teachers' && teachers.length > 0
              ? `Managing ${teachers.length} teacher accounts`
              : viewType === 'all' && (students.length + teachers.length) > 0
              ? `Managing ${students.length + teachers.length} total accounts (${students.length} students, ${teachers.length} teachers)`
              : viewType === 'students'
              ? `No students have been created in the system yet`
              : sessionStorage.getItem('hasStudentAccess') === 'false'
              ? "No accounts accessible with your current permissions"
              : "Start building your classes by adding students"
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
            {securityContext?.isAdmin() && (
              <>
                <Button 
                  onClick={() => setCreateAccountDialogOpen(true)}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
                <Button 
                  onClick={() => setCreateTeacherDialogOpen(true)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
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



      {/* Search Bar */}
      {((viewType === 'students' && totalStudents > 0) || 
        (viewType === 'teachers' && teachers.length > 0) || 
        (viewType === 'all' && (totalStudents > 0 || teachers.length > 0))) && (
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={
                viewType === 'students' 
                  ? "Search students by name, email, or ID..."
                  : viewType === 'teachers'
                  ? "Search teachers by name, email, username, or department..."
                  : "Search all users by name, email, or details..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-slate-600">
            {viewType === 'students' && `${filteredStudents.length} of ${totalStudents} students`}
            {viewType === 'teachers' && `${filteredTeachers.length} of ${teachers.length} teachers`}
            {viewType === 'all' && `${getFilteredData().length} of ${totalStudents + teachers.length} users`}
          </div>
        </div>
      )}

      {/* Users List */}
      {getFilteredData().length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getFilteredData().map((user, index) => (
            <motion.div
              key={user.type === 'student' ? (user['@id'] || user.id || `${user.name}-${index}`) : (user['@id'] || user.id || `${user.fullname}-${index}`)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="group"
            >
              <Card 
                className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => user.type === 'student' ? handleStudentClick(user as PloneStudent) : handleTeacherClick(user as PloneTeacher)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src="" alt={user.type === 'student' ? (user as PloneStudent).name : (user as PloneTeacher).fullname} />
                      <AvatarFallback className={user.type === 'student' 
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                        : "bg-gradient-to-br from-purple-500 to-pink-600 text-white"
                      }>
                        {user.type === 'student' 
                          ? getStudentInitials((user as PloneStudent).name)
                          : getTeacherInitials((user as PloneTeacher).fullname)
                        }
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {user.type === 'student' ? (user as PloneStudent).name : (user as PloneTeacher).fullname}
                      </h3>
                      <p className="text-sm text-slate-600 truncate">{user.email}</p>
                      
                      {/* Type badge */}
                      <div className="mt-2">
                        <Badge variant="secondary" className={user.type === 'student' 
                          ? "text-xs bg-blue-100 text-blue-700"
                          : "text-xs bg-purple-100 text-purple-700"
                        }>
                          {user.type === 'student' 
                            ? 'Student'
                            : (user as PloneTeacher).accountType === 'admin' ? 'Administrator' : 'Teacher'
                          }
                        </Badge>
                      </div>
                      
                      {/* Student-specific fields */}
                      {user.type === 'student' && (
                        <>
                          {renderStudentField(user as PloneStudent, 'student_id', 'ID')}
                          
                          {/* Progress - Educational level */}
                          {securityContext?.canViewField('progress') && (
                            <div className="mt-3 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Progress</span>
                                <span className="font-medium">{(user as PloneStudent).progress || 0}%</span>
                              </div>
                              <Progress value={(user as PloneStudent).progress || 0} className="h-2" />
                            </div>
                          )}
                          
                          {/* Contact Info - Restricted level */}
                          <div className="mt-3 space-y-1">
                            {showSensitiveData && renderStudentField(user as PloneStudent, 'phone', 'Phone', Phone)}
                            {showSensitiveData && renderStudentField(user as PloneStudent, 'address', 'Address', MapPin)}
                            {renderStudentField(user as PloneStudent, 'grade_level', 'Grade', Award)}
                            {renderStudentField(user as PloneStudent, 'enrollment_date', 'Enrolled', Calendar)}
                          </div>
                        </>
                      )}
                      
                      {/* Teacher-specific fields */}
                      {user.type === 'teacher' && (
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center text-xs text-slate-500">
                            <User className="w-3 h-3 mr-1" />
                            <span className="truncate">@{(user as PloneTeacher).username}</span>
                          </div>
                          {(user as PloneTeacher).department && (
                            <div className="flex items-center text-xs text-slate-500">
                              <Building className="w-3 h-3 mr-1" />
                              <span className="truncate">Dept: {(user as PloneTeacher).department}</span>
                            </div>
                          )}
                          {showSensitiveData && (user as PloneTeacher).phone && (
                            <div className="flex items-center text-xs text-slate-500">
                              <Phone className="w-3 h-3 mr-1" />
                              <span className="truncate">Phone: {(user as PloneTeacher).phone}</span>
                            </div>
                          )}
                          {(user as PloneTeacher).office && (
                            <div className="flex items-center text-xs text-slate-500">
                              <MapPin className="w-3 h-3 mr-1" />
                              <span className="truncate">Office: {(user as PloneTeacher).office}</span>
                            </div>
                          )}
                        </div>
                      )}
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
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {sessionStorage.getItem('hasStudentAccess') === 'false' 
              ? "No Students Accessible" 
              : "No Students Added Yet"
            }
          </h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {sessionStorage.getItem('hasStudentAccess') === 'false'
              ? "You don't have permission to view student information. Contact an administrator to verify your account permissions."
              : securityContext?.isAdmin() 
              ? "Create student accounts to start building your classes. You can add their information and track progress securely."
              : "No students have been created in the system yet."
            }
          </p>
          {securityContext?.isAdmin() && (
            <Button 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              onClick={() => setCreateAccountDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Student
            </Button>
          )}
        </div>
      ) : null}

      {/* No search results */}
      {((viewType === 'students' && totalStudents > 0 && filteredStudents.length === 0) ||
        (viewType === 'teachers' && teachers.length > 0 && filteredTeachers.length === 0) ||
        (viewType === 'all' && (totalStudents > 0 || teachers.length > 0) && getFilteredData().length === 0)) && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MagnifyingGlassIcon className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            No {viewType === 'students' ? 'Students' : viewType === 'teachers' ? 'Teachers' : 'Users'} Found
          </h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            No {viewType === 'students' ? 'students' : viewType === 'teachers' ? 'teachers' : 'users'} match your search criteria. Try adjusting your search terms.
          </p>
          <Button 
            variant="outline" 
            onClick={() => setSearchTerm("")}
          >
            Clear Search
          </Button>
        </div>
      )}

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
          loadData()
        }}
        />
      )}

      {/* Student Detail Modal */}
      <StudentModal
        student={selectedStudent}
        isOpen={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        onSave={handleStudentSave}
        onDelete={handleStudentDelete}
        securityContext={securityContext}
        classId={selectedStudent?.classId}
      />

      {/* Teacher Detail Modal */}
      <TeacherModal
        teacher={selectedTeacher}
        isOpen={teacherModalOpen}
        onClose={() => setTeacherModalOpen(false)}
        onSave={handleTeacherSave}
        onDelete={handleTeacherDelete}
        securityContext={securityContext}
      />
    </div>
  )
}
