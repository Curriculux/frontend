"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  UserPlus,
  User,
  Mail,
  Lock,
  GraduationCap,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Copy,
  Loader2,
  Users
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

import { ploneAPI } from "@/lib/api"
import { getSecurityManager, PLONE_ROLES } from "@/lib/security"
import { toast } from "sonner"

interface CreateTeacherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTeacherCreated?: (teacher: any) => void
}

export function CreateTeacherDialog({
  open,
  onOpenChange,
  onTeacherCreated
}: CreateTeacherDialogProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [createdTeacher, setCreatedTeacher] = useState<any>(null)
  const [securityContext, setSecurityContext] = useState<any>(null)
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    username: '',
    password: '',
    role: 'Editor', // Default to Teacher role
    department: '',
    office: '',
    phone: '',
    bio: ''
  })

  const teacherRoles = [
    { 
      value: 'Editor', 
      label: 'Teacher', 
      description: 'Can create and manage classes, meetings, students, and assignments',
      icon: GraduationCap,
      color: 'text-blue-600'
    },
    { 
      value: 'Site Administrator', 
      label: 'Site Administrator', 
      description: 'Administrative access to manage users and system settings',
      icon: Users,
      color: 'text-purple-600'
    }
  ]

  useEffect(() => {
    if (open) {
      initializeDialog()
    }
  }, [open])

  const initializeDialog = async () => {
    try {
      // Check security permissions
      const securityManager = getSecurityManager()
      const context = await securityManager.initializeSecurityContext()
      setSecurityContext(context)

      // Debug: Log current user info
      console.log('Current user:', context.user)
      console.log('User roles:', context.user?.roles)
      console.log('Is admin:', context.isAdmin())
      console.log('Security context:', context)

      // Verify admin permissions
      if (!context.isAdmin()) {
        toast.error('Access denied: Administrator privileges required to create teacher accounts')
        onOpenChange(false)
        return
      }

      // Reset form
      setFormData({
        fullname: '',
        email: '',
        username: '',
        password: '',
        role: 'Editor',
        department: '',
        office: '',
        phone: '',
        bio: ''
      })
      setCreatedTeacher(null)
    } catch (error) {
      console.error('Error initializing create teacher dialog:', error)
      toast.error('Failed to initialize. Please try again.')
      onOpenChange(false)
    }
  }

  // Auto-generate username from full name
  useEffect(() => {
    if (formData.fullname && !formData.username) {
      const generatedUsername = formData.fullname
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15)
      setFormData(prev => ({ ...prev, username: generatedUsername }))
    }
  }, [formData.fullname])

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, password }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleSubmit = async () => {
    try {
      setIsCreating(true)

      // Validate required fields
      if (!formData.fullname || !formData.email || !formData.username || !formData.password) {
        toast.error('Please fill in all required fields')
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address')
        return
      }

      // Validate password strength
      if (formData.password.length < 8) {
        toast.error('Password must be at least 8 characters long')
        return
      }

      // Double-check admin permissions
      if (!securityContext || !securityContext.isAdmin()) {
        toast.error('Access denied: Administrator privileges required')
        return
      }

      // Determine roles based on selection
      let roles = ['Member']
      if (formData.role === 'Editor') {
        // Teachers need Manager role to create classes, meetings, and folders
        roles.push('Manager')
      } else if (formData.role === 'Site Administrator') {
        roles.push('Site Administrator')
      }

      // Create teacher account
      const newTeacher = await ploneAPI.createUser({
        username: formData.username,
        fullname: formData.fullname,
        email: formData.email,
        password: formData.password,
        roles: roles,
        properties: {
          account_type: 'teacher',
          department: formData.department || undefined,
          office: formData.office || undefined,
          phone: formData.phone || undefined,
          bio: formData.bio || undefined
        }
      })

      setCreatedTeacher({
        ...newTeacher,
        temporaryPassword: formData.password,
        role: formData.role
      })

      onTeacherCreated?.(newTeacher)
      
      toast.success(`Teacher account created successfully for ${formData.fullname}`)
      
      // Close the modal immediately after successful creation
      handleClose()
      
    } catch (error) {
      console.error('Error creating teacher account:', error)
      
      if (error instanceof Error) {
        // Check for authentication/authorization errors
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.error('401 Error Details:', {
            currentUser: securityContext?.user,
            userRoles: securityContext?.user?.roles,
            isAdmin: securityContext?.isAdmin(),
            token: ploneAPI.getToken() ? 'Present' : 'Missing'
          })
          
          toast.error('Authentication failed: You may not have permission to create user accounts. Please ensure you are logged in as an administrator and that plone.restapi is properly configured in the Plone backend.')
        } else if (error.message.includes('username')) {
          toast.error('Username already exists. Please choose a different username.')
        } else if (error.message.includes('email')) {
          toast.error('Email address already exists in the system.')
        } else {
          toast.error(`Failed to create teacher account: ${error.message}`)
        }
      } else {
        toast.error('Failed to create teacher account. Please try again.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setCreatedTeacher(null)
    onOpenChange(false)
  }

  const createAnother = () => {
    setCreatedTeacher(null)
    setFormData({
      fullname: '',
      email: '',
      username: '',
      password: '',
      role: formData.role, // Keep same role
      department: formData.department, // Keep same department
      office: '',
      phone: '',
      bio: ''
    })
  }

  // Success screen after teacher is created
  if (createdTeacher) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            
            <div>
              <h3 className="text-xl font-semibold text-green-900 mb-2">
                Teacher Account Created Successfully!
              </h3>
              <p className="text-gray-600">
                {createdTeacher.fullname} can now log in with these credentials:
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Username:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded">{createdTeacher.username}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(createdTeacher.username)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-medium">Password:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded">
                    {showPassword ? createdTeacher.temporaryPassword : '••••••••••••'}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(createdTeacher.temporaryPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium">Role:</span>
                <Badge variant="outline">{createdTeacher.role}</Badge>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please share these credentials securely with the new teacher. They should change their password on first login.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-3 pt-4">
              <Button onClick={createAnother} variant="outline" className="flex-1">
                Create Another Teacher
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
            Create Teacher Account
          </DialogTitle>
          <DialogDescription>
            Create a new teacher account with appropriate permissions and access levels
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Role Selection */}
          <div className="space-y-3">
            <Label htmlFor="role" className="text-sm font-medium">Account Type *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
            >
              <SelectTrigger className="h-14 border-2 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-3 w-full">
                  {(() => {
                    const selectedRole = teacherRoles.find(role => role.value === formData.role)
                    if (selectedRole) {
                      const IconComponent = selectedRole.icon
                      return (
                        <>
                          <div className={selectedRole.color}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-medium">{selectedRole.label}</div>
                            <div className="text-sm text-gray-500 truncate">
                              {selectedRole.description}
                            </div>
                          </div>
                        </>
                      )
                    }
                    return <span className="text-gray-500">Select account type</span>
                  })()}
                </div>
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {teacherRoles.map((role) => {
                  const IconComponent = role.icon
                  return (
                    <SelectItem 
                      key={role.value} 
                      value={role.value}
                      className="relative p-0 cursor-pointer min-h-[70px] focus:bg-blue-50 hover:bg-blue-50 data-[state=checked]:bg-blue-100"
                    >
                      <div className="flex items-start gap-3 w-full p-4 pl-10">
                        <div className={`mt-0.5 ${role.color}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-gray-900 text-base leading-tight">
                            {role.label}
                          </div>
                          <div className="text-sm text-gray-600 mt-1 leading-relaxed">
                            {role.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Basic Information
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullname">Full Name *</Label>
                <Input
                  id="fullname"
                  value={formData.fullname}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullname: e.target.value }))}
                  placeholder="Dr. Jane Smith"
                  className="h-10"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="jane.smith@school.edu"
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="janesmith"
                className="h-10"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Login Credentials
            </h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generatePassword}
                >
                  Generate Secure Password
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter secure password"
                  className="h-10 pr-10"
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
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Additional Information (Optional)
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Mathematics"
                  className="h-10"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="office">Office Location</Label>
                <Input
                  id="office"
                  value={formData.office}
                  onChange={(e) => setFormData(prev => ({ ...prev, office: e.target.value }))}
                  placeholder="Room 203"
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Specialties</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Brief description of teaching specialties and background..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={isCreating || !formData.fullname || !formData.email || !formData.username || !formData.password}
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
                  Create Teacher Account
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