"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Hash,
  GraduationCap,
  Users,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Copy,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { ploneAPI, PloneClass } from "@/lib/api"
import { getSecurityManager } from "@/lib/security"
import { GRADE_LEVELS } from "@/lib/constants"
import { toast } from "sonner"

interface CreateStudentAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentCreated?: (student: any) => void
}

export function CreateStudentAccountDialog({
  open,
  onOpenChange,
  onStudentCreated
}: CreateStudentAccountDialogProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [classes, setClasses] = useState<PloneClass[]>([])
  const [createdStudent, setCreatedStudent] = useState<any>(null)
  const [passwordError, setPasswordError] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [passwordValidating, setPasswordValidating] = useState(false)
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    username: '',
    password: '',
    student_id: '',
    grade_level: '',
    selectedClasses: [] as string[]
  })

  useEffect(() => {
    if (open) {
      loadClasses()
      // Reset form when dialog opens
      setFormData({
        fullname: '',
        email: '',
        username: '',
        password: '',
        student_id: '',
        grade_level: '',
        selectedClasses: []
      })
      setCreatedStudent(null)
    }
  }, [open])

  // Auto-generate username from full name
  useEffect(() => {
    if (formData.fullname && !formData.username) {
      const generatedUsername = formData.fullname
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 12)
      setFormData(prev => ({ ...prev, username: generatedUsername }))
    }
  }, [formData.fullname])

  const loadClasses = async () => {
    try {
      const classesData = await ploneAPI.getClasses()
      setClasses(classesData)
    } catch (error) {
      console.error('Error loading classes:', error)
      toast.error('Failed to load classes')
    }
  }

  const handleClassToggle = (classId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selectedClasses: checked
        ? [...prev.selectedClasses, classId]
        : prev.selectedClasses.filter(id => id !== classId)
    }))
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, password }))
    // Clear any password error when generating
    setPasswordError('')
    setPasswordTouched(true)
  }

  // Handle password validation on blur using Plone's actual validation
  const handlePasswordBlur = async () => {
    setPasswordTouched(true)
    if (!formData.password) {
      setPasswordError('')
      setPasswordValidating(false)
      return
    }

    // Start validation - don't clear error immediately
    setPasswordValidating(true)

    // Use Plone's actual validation
    try {
      const result = await ploneAPI.validatePassword(formData.password, formData.username)
      setPasswordValidating(false)
      if (!result.isValid && result.error) {
        setPasswordError(result.error)
      } else {
        setPasswordError('')
      }
    } catch (error) {
      console.error('Error validating password:', error)
      setPasswordValidating(false)
      // Fallback to basic validation if API call fails
      if (formData.password.length < 8) {
        setPasswordError('Your password must contain at least 8 characters.')
      } else {
        setPasswordError('')
      }
    }
  }

  // Handle password change with real-time validation if already touched
  const handlePasswordChange = (value: string) => {
    setFormData(prev => ({ ...prev, password: value }))
    if (passwordTouched && value) {
      setPasswordValidating(true)
      
      // Debounced validation - only validate after user stops typing
      const timeoutId = setTimeout(async () => {
        try {
          const result = await ploneAPI.validatePassword(value, formData.username)
          setPasswordValidating(false)
          if (!result.isValid && result.error) {
            setPasswordError(result.error)
          } else {
            setPasswordError('')
          }
        } catch (error) {
          console.error('Error validating password:', error)
          setPasswordValidating(false)
          // Fallback validation
          if (value.length < 8) {
            setPasswordError('Your password must contain at least 8 characters.')
          } else {
            setPasswordError('')
          }
        }
      }, 500) // 500ms debounce

      return () => clearTimeout(timeoutId)
    } else if (!passwordTouched) {
      // If not touched yet, just clear any validation state
      setPasswordValidating(false)
      setPasswordError('')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleSubmit = async () => {
    try {
      setIsCreating(true)

      // Validate required fields
      if (!formData.fullname || !formData.email || !formData.username) {
        toast.error('Please fill in all required fields')
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address')
        return
      }

      // Validate password if provided
      if (formData.password) {
        try {
          const result = await ploneAPI.validatePassword(formData.password, formData.username)
          if (!result.isValid && result.error) {
            toast.error(`Password Error: ${result.error}`)
            return
          }
        } catch (error) {
          console.error('Error validating password during submit:', error)
          // Fallback validation
          if (formData.password.length < 8) {
            toast.error('Password Error: Your password must contain at least 8 characters.')
            return
          }
        }
      }

      const securityManager = getSecurityManager()
      const securityContext = securityManager.getSecurityContext()
      
      if (!securityContext || !securityContext.isAdmin()) {
        toast.error('Access denied: Administrator privileges required')
        return
      }

      // Create student account
      let newStudent;
      try {
        newStudent = await ploneAPI.createStudentAccount({
          username: formData.username,
          fullname: formData.fullname,
          email: formData.email,
          password: formData.password || undefined, // Let API generate if empty
          student_id: formData.student_id || undefined,
          grade_level: formData.grade_level || undefined,
          classes: formData.selectedClasses
        })
      } catch (createError) {
        // The API might throw an error even if student records were created
        console.warn('Student account creation error (may be partial success):', createError);
        
        // Check if this is just a user account creation failure by trying to get students again
        try {
          // Try to refresh students to see if any were actually created
          const classes = await ploneAPI.getClasses();
          let foundStudent = null;
          
          for (const cls of classes) {
            if (formData.selectedClasses.includes(cls.id || '')) {
              const students = await ploneAPI.getStudents(cls.id);
              foundStudent = students.find((s: any) => s.name === formData.fullname || s.email === formData.email);
              if (foundStudent) break;
            }
          }
          
          if (foundStudent) {
            // Student record was created even though user account failed
            newStudent = {
              username: formData.username,
              fullname: formData.fullname,
              email: formData.email,
              temporaryPassword: formData.password || 'auto-generated',
              enrolledClasses: formData.selectedClasses,
              createdRecords: [{ classId: foundStudent.classId, studentRecord: foundStudent }],
              userAccount: null,
              canLogin: false,
              note: `Student record created but login account creation failed: ${createError instanceof Error ? createError.message : 'Unknown error'}`
            };
          } else {
            // Complete failure
            throw createError;
          }
        } catch (checkError) {
          // Complete failure
          throw createError;
        }
      }

      setCreatedStudent(newStudent)
      onStudentCreated?.(newStudent)
      
      // Show appropriate message based on what was actually created
      if (newStudent.canLogin) {
        toast.success(`Student account created successfully for ${formData.fullname}`, {
          description: 'Student can now log in with the provided credentials'
        })
      } else {
        toast.warning(`Student record created for ${formData.fullname}`, {
          description: 'Login account creation failed - student cannot log in yet'
        })
      }
      
    } catch (error) {
      console.error('Error creating student account:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('username')) {
          toast.error('Username already exists. Please choose a different username.')
        } else if (error.message.includes('email')) {
          toast.error('Email address already exists in the system.')
        } else {
          toast.error(`Failed to create student account: ${error.message}`)
        }
      } else {
        toast.error('Failed to create student account. Please try again.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setCreatedStudent(null)
    onOpenChange(false)
  }

  const createAnother = () => {
    setCreatedStudent(null)
    setFormData({
      fullname: '',
      email: '',
      username: '',
      password: '',
      student_id: '',
      grade_level: formData.grade_level, // Keep same grade level
      selectedClasses: formData.selectedClasses // Keep same classes
    })
  }

  // Show success screen after creation
  if (createdStudent) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Student Account Created
            </DialogTitle>
            <DialogDescription>
              The student account has been successfully created and enrolled in selected classes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className={`${createdStudent.canLogin ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
              <h4 className={`font-semibold ${createdStudent.canLogin ? 'text-green-800' : 'text-yellow-800'} mb-3`}>
                {createdStudent.canLogin ? 'Account Details' : 'Student Record Created'}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700">Name:</span>
                  <span className="font-medium">{createdStudent.fullname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Username:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{createdStudent.username}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(createdStudent.username)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Email:</span>
                  <span className="font-medium">{createdStudent.email}</span>
                </div>
                {createdStudent.temporaryPassword && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Temp Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium bg-gray-100 px-2 py-1 rounded">
                        {createdStudent.temporaryPassword}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(createdStudent.temporaryPassword)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {createdStudent.enrolledClasses?.length > 0 && (
                  <div>
                    <span className="text-green-700">Enrolled Classes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {createdStudent.enrolledClasses.map((classId: string) => {
                        const className = classes.find(c => c.id === classId)?.title || classId
                        return (
                          <Badge key={classId} variant="secondary" className="text-xs">
                            {className}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!createdStudent.canLogin && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Login Account Not Created:</strong> {createdStudent.note}
                </AlertDescription>
              </Alert>
            )}

            {createdStudent.canLogin && createdStudent.temporaryPassword && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please share the temporary password with the student. They should change it on first login.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-3 pt-4">
              <Button onClick={createAnother} variant="outline" className="flex-1">
                Create Another Student
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create Student Account
          </DialogTitle>
          <DialogDescription>
            Create a new student account with login credentials and class enrollment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">
              Personal Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullname">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="fullname"
                    placeholder="John Doe"
                    value={formData.fullname}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullname: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john.doe@school.edu"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="student_id">Student ID</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="student_id"
                    placeholder="STU2024001"
                    value={formData.student_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade_level">Grade Level</Label>
                <Select
                  value={formData.grade_level}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, grade_level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade level" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_LEVELS.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Account Credentials */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">
              Account Credentials
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    placeholder="johndoe"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500">Auto-generated from full name</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Leave empty for auto-generated (min 8 chars)"
                      value={formData.password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      onBlur={handlePasswordBlur}
                      className={`pl-10 pr-10 ${passwordError ? 'border-red-500' : ''}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generatePassword}
                    className="shrink-0"
                  >
                    Generate
                  </Button>
                </div>
                {!passwordValidating && passwordError && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {passwordError}
                  </p>
                )}
                {!passwordValidating && !passwordError && passwordTouched && formData.password && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Password meets requirements
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {formData.password ? "Custom password set" : "Temporary password will be generated"}
                </p>
              </div>
            </div>
          </div>

          {/* Class Enrollment */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">
              Class Enrollment
            </h4>
            
            {classes.length === 0 ? (
              <p className="text-sm text-gray-500">No classes available for enrollment</p>
            ) : (
              <div className="space-y-2">
                <Label>Select Classes (optional)</Label>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-lg p-3">
                   {classes.map((cls) => (
                     <Button
                       key={cls.id}
                       variant={formData.selectedClasses.includes(cls.id!) ? "default" : "outline"}
                       size="sm"
                       className="justify-start text-sm h-8"
                       onClick={() => handleClassToggle(cls.id!, !formData.selectedClasses.includes(cls.id!))}
                     >
                       {cls.title}
                     </Button>
                   ))}
                </div>
                <p className="text-xs text-gray-500">
                  Student will be enrolled in selected classes with appropriate permissions
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={isCreating || !formData.fullname || !formData.email || !formData.username}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Student Account
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 