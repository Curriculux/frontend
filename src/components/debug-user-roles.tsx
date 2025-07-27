"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ploneAPI } from "@/lib/api"
import { getSecurityManager } from "@/lib/security"
import { Users, Shield, Eye, AlertTriangle, CheckCircle, BookOpen, UserCheck, Wrench } from "lucide-react"

export function DebugUserRoles() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [securityContext, setSecurityContext] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [studentCounts, setStudentCounts] = useState<{ [classId: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fixingPermissions, setFixingPermissions] = useState(false)
  const [permissionFixResult, setPermissionFixResult] = useState<any>(null)
  const [fixingAllTeachers, setFixingAllTeachers] = useState(false)
  const [allTeachersFixResult, setAllTeachersFixResult] = useState<any>(null)

  useEffect(() => {
    loadUserInfo()
  }, [])

  const fixTeacherPermissions = async () => {
    try {
      setFixingPermissions(true)
      setPermissionFixResult(null)
      
      const result = await ploneAPI.fixMyTeacherPermissions()
      setPermissionFixResult(result)
    } catch (error) {
      setPermissionFixResult({
        fixed: [],
        failed: [],
        message: `Error: ${error}`
      })
    } finally {
      setFixingPermissions(false)
    }
  }

  const fixAllTeachers = async () => {
    try {
      setFixingAllTeachers(true)
      setAllTeachersFixResult(null)
      
      const result = await ploneAPI.ensureAllTeachersHaveManagerRole()
      setAllTeachersFixResult(result)
    } catch (error) {
      setAllTeachersFixResult({
        fixed: [],
        failed: [],
        message: `Error: ${error}`
      })
    } finally {
      setFixingAllTeachers(false)
    }
  }

  const loadUserInfo = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user
      const user = await ploneAPI.getCurrentUser()
      setCurrentUser(user)

      if (user) {
        // Initialize security context
        const securityManager = getSecurityManager()
        const context = await securityManager.initializeSecurityContext()
        setSecurityContext(context)

        // Load classes
        console.log('Loading classes...')
        const classesData = await ploneAPI.getClasses()
        console.log('Found classes:', classesData)
        setClasses(classesData)

        // Check students in each class
        const counts: { [classId: string]: number } = {}
        for (const cls of classesData) {
          try {
            console.log(`Checking access to class ${cls.id}...`)
            const canAccess = context.canAccessStudent('', cls.id)
            console.log(`Can access students in ${cls.id}:`, canAccess)
            
            if (canAccess) {
              console.log(`Loading students for class ${cls.id}...`)
              const students = await ploneAPI.getStudents(cls.id)
              console.log(`Found ${students.length} students in ${cls.id}:`, students)
              counts[cls.id] = students.length
            } else {
              console.log(`Access denied to students in ${cls.id}`)
              counts[cls.id] = -1 // -1 indicates access denied
            }
          } catch (classError) {
            console.error(`Error loading students for class ${cls.id}:`, classError)
            counts[cls.id] = -2 // -2 indicates error
          }
        }
        setStudentCounts(counts)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user information')
      console.error('Debug error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <span className="ml-2">Loading user information...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Error loading user information: {error}
        </AlertDescription>
      </Alert>
    )
  }

  if (!currentUser) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          No user is currently logged in.
        </AlertDescription>
      </Alert>
    )
  }

  const canSeeStudents = securityContext?.canAccessStudent('', 'any-class')
  const userType = securityContext?.isAdmin() ? 'Admin' : 
                  securityContext?.isTeacher() ? 'Teacher' : 
                  securityContext?.isStudent() ? 'Student' : 'Unknown'

  return (
    <div className="space-y-4">
      {/* Current User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Current User Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Username</p>
              <p className="font-mono">{currentUser.username}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Full Name</p>
              <p>{currentUser.fullname}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Email</p>
              <p>{currentUser.email || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">User Type</p>
              <Badge variant={userType === 'Admin' ? 'default' : userType === 'Teacher' ? 'secondary' : 'outline'}>
                {userType}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teacher Permission Fix */}
      {securityContext?.isTeacher() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Teacher Permission Diagnostic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              If you're having trouble creating assignments or accessing class content, click the button below to check your permissions.
            </div>
            
            <Button 
              onClick={fixTeacherPermissions} 
              disabled={fixingPermissions}
              className="w-full"
            >
              {fixingPermissions ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Checking Permissions...
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 mr-2" />
                  Check My Teacher Permissions
                </>
              )}
            </Button>

            {permissionFixResult && (
              <Alert className={permissionFixResult.failed.length === 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
                {permissionFixResult.failed.length === 0 ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                )}
                <AlertDescription className={permissionFixResult.failed.length === 0 ? "text-green-800" : "text-yellow-800"}>
                  <div className="font-medium">{permissionFixResult.message}</div>
                  {permissionFixResult.fixed.length > 0 && (
                    <div className="mt-2">
                      <strong>Classes with proper access:</strong> {permissionFixResult.fixed.join(', ')}
                    </div>
                  )}
                  {permissionFixResult.failed.length > 0 && (
                    <div className="mt-2">
                      <strong>Classes missing permissions:</strong> {permissionFixResult.failed.join(', ')}
                      <div className="mt-1 text-sm">
                        Contact your administrator to set up permissions for these classes.
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fix All Teachers */}
      {securityContext?.isAdmin() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Fix All Teachers (Admin Only)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              Grant Manager role to all teachers so they can create assignments. This fixes the 401 Unauthorized errors.
            </div>

            <Button
              onClick={fixAllTeachers}
              disabled={fixingAllTeachers}
              className="w-full"
              variant="default"
            >
              {fixingAllTeachers ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Fixing All Teachers...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Grant Manager Role to All Teachers
                </>
              )}
            </Button>

            {allTeachersFixResult && (
              <Alert className={allTeachersFixResult.failed.length === 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
                {allTeachersFixResult.failed.length === 0 ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                )}
                <AlertDescription className={allTeachersFixResult.failed.length === 0 ? "text-green-800" : "text-yellow-800"}>
                  <div className="font-medium">{allTeachersFixResult.message}</div>
                  {allTeachersFixResult.fixed.length > 0 && (
                    <div className="mt-2">
                      <strong>Teachers fixed:</strong> {allTeachersFixResult.fixed.join(', ')}
                    </div>
                  )}
                  {allTeachersFixResult.failed.length > 0 && (
                    <div className="mt-2">
                      <strong>Teachers that failed:</strong> {allTeachersFixResult.failed.join(', ')}
                      <div className="mt-1 text-sm">
                        These teachers may need manual role assignment in Plone.
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            User Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {currentUser.roles && currentUser.roles.length > 0 ? (
              currentUser.roles.map((role: string) => (
                <Badge key={role} variant="outline" className="font-mono">
                  {role}
                </Badge>
              ))
            ) : (
              <span className="text-gray-500">No roles assigned</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Classes & Student Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                No classes found. This might be why you can't see students.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Found {classes.length} class(es):</p>
              {classes.map((cls) => {
                const studentCount = studentCounts[cls.id]
                return (
                  <div key={cls.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{cls.title}</h4>
                      <p className="text-sm text-gray-600">ID: {cls.id}</p>
                    </div>
                    <div className="text-right">
                      {studentCount === -1 && (
                        <Badge variant="destructive">Access Denied</Badge>
                      )}
                      {studentCount === -2 && (
                        <Badge variant="destructive">Error Loading</Badge>
                      )}
                      {studentCount >= 0 && (
                        <Badge variant={studentCount > 0 ? 'default' : 'secondary'}>
                          {studentCount} student{studentCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Student Access Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {canSeeStudents ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              <span className={canSeeStudents ? 'text-green-800' : 'text-red-800'}>
                {canSeeStudents ? 'Can access student data' : 'Cannot access student data'}
              </span>
            </div>

            {!canSeeStudents && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Issue found:</strong> Your account cannot access student data. 
                  {userType === 'Unknown' && ' Your user type could not be determined.'}
                  {userType === 'Student' && ' Student accounts cannot view other students.'}
                  {(userType === 'Teacher' || userType === 'Admin') && 
                    ' This suggests a role configuration issue.'
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            If you're a teacher/admin and can't see students:
          </p>
          <ol className="list-decimal list-inside text-sm space-y-1">
            <li>Check that you have classes created (see Classes section above)</li>
            <li>Check that classes contain students</li>
            <li>Check that your account has the "Editor" role (for teachers)</li>
            <li>Check that your account has "Site Administrator" or "Manager" role (for admins)</li>
            <li>Try refreshing the page to reload your permissions</li>
            <li>Check browser console for error messages</li>
          </ol>
          
          <div className="mt-4">
            <Button onClick={loadUserInfo} variant="outline" size="sm">
              Refresh User Info
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 