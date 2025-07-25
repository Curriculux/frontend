"use client"

import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { ploneAPI } from "@/lib/api"
import { Loader2, Shield, Info, CheckCircle, Eye, EyeOff, Copy } from "lucide-react"
import { getSecurityManager, DataClassification } from "@/lib/security"
import { GRADE_LEVELS } from "@/lib/constants"
import React from "react"

interface CreateStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentCreated: () => void;
  classes: any[];
  defaultClassId?: string;
}

export function CreateStudentDialog({ 
  open, 
  onOpenChange, 
  onStudentCreated,
  classes,
  defaultClassId
}: CreateStudentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [securityContext, setSecurityContext] = useState<any>(null)
  const [createdAccount, setCreatedAccount] = useState<any>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [useCustomPassword, setUseCustomPassword] = useState(false)
  const [customPassword, setCustomPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [formData, setFormData] = useState({
    // Public fields (always visible)
    name: "",
    email: "",
    grade_level: "",
    
    // Educational fields (visible to teachers)
    student_id: "",
    classId: defaultClassId || "",
    
    // Restricted fields (visible to deans only)
    phone: "",
    address: "",
    emergency_contact: "",
    emergency_phone: "",
    parent_email: "",
    
    // Confidential fields (visible to deans + medical staff)
    medical_info: "",
    special_needs: "",
    dietary_restrictions: "",
    notes: ""
  })
  const { toast } = useToast()

  // Initialize security context when dialog opens
  React.useEffect(() => {
    if (open) {
      const initSecurity = async () => {
        try {
          const securityManager = getSecurityManager()
          const context = await securityManager.initializeSecurityContext()
          setSecurityContext(context)
        } catch (error) {
          console.error('Failed to initialize security context:', error)
        }
      }
      initSecurity()
      
      // Reset created account when dialog opens
      setCreatedAccount(null)
    }
  }, [open])

  // Auto-generate username from name
  const generateUsername = (name: string): string => {
    const username = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 12)
    
    // Ensure minimum length of 3 characters
    if (username.length < 3) {
      return username.padEnd(3, '1') // Pad with '1' if too short
    }
    
    return username
  }

  // Validate password according to Plone requirements
  const validatePassword = (password: string): string => {
    if (!password) {
      return 'Password is required'
    }
    if (password.length < 5) {
      return 'Password must be at least 5 characters long'
    }
    if (password.length > 100) {
      return 'Password must be less than 100 characters'
    }
    // Check for common weak passwords
    const commonPasswords = ['password', '12345', 'admin', 'test', 'user']
    if (commonPasswords.includes(password.toLowerCase())) {
      return 'Password is too common, please choose a stronger password'
    }
    // Optional: Check for minimum complexity (uncomment if needed)
    // if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    //   return 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    // }
    return ''
  }

  // Handle password validation on blur
  const handlePasswordBlur = () => {
    setPasswordTouched(true)
    const error = validatePassword(customPassword)
    setPasswordError(error)
  }

  // Handle password change with real-time validation if already touched
  const handlePasswordChange = (value: string) => {
    setCustomPassword(value)
    if (passwordTouched) {
      const error = validatePassword(value)
      setPasswordError(error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "Copied to clipboard"
    })
  }

  const canEditField = (field: keyof typeof formData): boolean => {
    if (!securityContext) return false
    
    // Map form fields to security classifications
    const fieldClassifications: Record<string, keyof any> = {
      name: 'name',
      email: 'email', 
      grade_level: 'grade_level',
      student_id: 'student_id',
      phone: 'phone',
      address: 'address',
      emergency_contact: 'emergency_contact',
      emergency_phone: 'emergency_phone',
      parent_email: 'phone', // Similar permission level
      medical_info: 'medical_info',
      special_needs: 'special_needs',
      dietary_restrictions: 'dietary_restrictions',
      notes: 'notes'
    }
    
    const mappedField = fieldClassifications[field]
    return mappedField ? securityContext.canEditField(mappedField) : false
  }

  const getFieldClassification = (field: keyof typeof formData): DataClassification => {
    const classifications: Record<string, DataClassification> = {
      name: DataClassification.PUBLIC,
      email: DataClassification.PUBLIC,
      grade_level: DataClassification.PUBLIC,
      student_id: DataClassification.EDUCATIONAL,
      classId: DataClassification.EDUCATIONAL,
      phone: DataClassification.RESTRICTED,
      address: DataClassification.RESTRICTED,
      emergency_contact: DataClassification.RESTRICTED,
      emergency_phone: DataClassification.RESTRICTED,
      parent_email: DataClassification.RESTRICTED,
      medical_info: DataClassification.CONFIDENTIAL,
      special_needs: DataClassification.CONFIDENTIAL,
      dietary_restrictions: DataClassification.CONFIDENTIAL,
      notes: DataClassification.CONFIDENTIAL
    }
    
    return classifications[field] || DataClassification.PUBLIC
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.classId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (Name, Email, Class)",
        variant: "destructive"
      })
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Invalid Email", 
        description: "Please enter a valid email address",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    try {
      // Generate username from name
      const username = generateUsername(formData.name)
      
      // Validate custom password if provided
      if (useCustomPassword) {
        const passwordValidationError = validatePassword(customPassword)
        if (passwordValidationError) {
          toast({
            title: "Password Error",
            description: passwordValidationError,
            variant: "destructive"
          })
          return
        }
      }
      
      // Create student account with login credentials
      const newAccount = await ploneAPI.createStudentAccount({
        username: username,
        fullname: formData.name,
        email: formData.email,
        student_id: formData.student_id || undefined,
        grade_level: formData.grade_level || undefined,
        password: useCustomPassword ? customPassword : undefined, // Use custom password if provided
        classes: [formData.classId],
        
        // Include additional fields if user has permission
        ...(canEditField('phone') && { phone: formData.phone }),
        ...(canEditField('address') && { address: formData.address }),
        ...(canEditField('emergency_contact') && { emergency_contact: formData.emergency_contact }),
        ...(canEditField('emergency_phone') && { emergency_phone: formData.emergency_phone }),
        ...(canEditField('parent_email') && { parent_email: formData.parent_email }),
        ...(canEditField('medical_info') && { medical_info: formData.medical_info }),
        ...(canEditField('special_needs') && { special_needs: formData.special_needs }),
        ...(canEditField('dietary_restrictions') && { dietary_restrictions: formData.dietary_restrictions }),
        ...(canEditField('notes') && { notes: formData.notes }),
      })
      
      setCreatedAccount(newAccount)
      
      // Show success message - account creation always succeeds if we get here
      toast({
        title: "Student Account Created!",
        description: `${formData.name} can now log in with the provided credentials.`
      })
      
      onStudentCreated()
    } catch (error) {
      console.error("Failed to create student:", error)
      
             if (error instanceof Error) {
         if (error.message.includes('username')) {
           toast({
             title: "Username Issue",
             description: "Username validation failed. Please try with a different name or contact an administrator.",
             variant: "destructive"
           })
         } else if (error.message.includes('email')) {
           toast({
             title: "Email Issue",
             description: "Email validation failed or already exists.",
             variant: "destructive"
           })
         } else if (error.message.includes('Invalid user data') || error.message.includes('400')) {
           toast({
             title: "User Data Invalid",
             description: "The user data doesn't meet Plone's requirements. Student record may still be created.",
             variant: "destructive"
           })
         } else {
           toast({
             title: "Account Creation Failed",
             description: "Login account could not be created. Student record may still be created. Please contact an administrator.",
             variant: "destructive"
           })
         }
       } else {
         toast({
           title: "Error",
           description: "Failed to create student account. Please try again.",
           variant: "destructive"
         })
       }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Reset form
    setFormData({
      name: "",
      email: "",
      grade_level: "",
      student_id: "",
      classId: defaultClassId || "",
      phone: "",
      address: "",
      emergency_contact: "",
      emergency_phone: "",
      parent_email: "",
      medical_info: "",
      special_needs: "",
      dietary_restrictions: "",
      notes: ""
    })
    setCreatedAccount(null)
    onOpenChange(false)
  }

  const createAnother = () => {
    // Reset form but keep the same class
    setFormData({
      name: "",
      email: "",
      grade_level: "",
      student_id: "",
      classId: formData.classId, // Keep same class
      phone: "",
      address: "",
      emergency_contact: "",
      emergency_phone: "",
      parent_email: "",
      medical_info: "",
      special_needs: "",
      dietary_restrictions: "",
      notes: ""
    })
    setCreatedAccount(null)
  }

  // Update classId when defaultClassId changes
  if (defaultClassId && formData.classId !== defaultClassId) {
    setFormData({ ...formData, classId: defaultClassId })
  }

  // If account was just created, show the success screen
  if (createdAccount) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Student Account Created
            </DialogTitle>
            <DialogDescription>
              The student account has been created successfully with login credentials.
            </DialogDescription>
          </DialogHeader>
          
                      <div className="space-y-4 py-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>{createdAccount.fullname}</strong> can now log in to the system.
                </AlertDescription>
              </Alert>

                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-900">Login Credentials</h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Username:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded border text-sm">
                          {createdAccount.username}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(createdAccount.username)}
                          className="h-7 w-7 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Password:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded border text-sm">
                          {showPassword ? createdAccount.temporaryPassword : '••••••••'}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPassword(!showPassword)}
                          className="h-7 w-7 p-0"
                        >
                          {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(createdAccount.temporaryPassword)}
                          className="h-7 w-7 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-600 mt-2">
                    💡 Make sure to share these credentials securely with the student.
                  </div>
                </div>
              </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={createAnother}>
              Create Another Student
            </Button>
            <Button onClick={handleClose}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const renderFieldGroup = (title: string, fields: Array<{key: keyof typeof formData, label: string, type?: string, options?: string[], required?: boolean}>, classification: DataClassification) => {
    const visibleFields = fields.filter(field => canEditField(field.key))
    
    if (visibleFields.length === 0) {
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700 flex items-center">
            <Shield className="w-4 h-4 mr-2" />
            {title}
          </h3>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to edit {classification} information.
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-700 flex items-center">
          <Shield className="w-4 h-4 mr-2" />
          {title}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleFields.map(field => (
            <div key={field.key} className="grid gap-2">
              <Label htmlFor={field.key}>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {field.options ? (
                <Select
                  value={formData[field.key]}
                  onValueChange={(value: string) => setFormData({ ...formData, [field.key]: value })}
                  disabled={loading}
                >
                  <SelectTrigger id={field.key}>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === 'textarea' ? (
                <Textarea
                  id={field.key}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  value={formData[field.key]}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  disabled={loading}
                  rows={2}
                />
              ) : (
                <Input
                  id={field.key}
                  type={field.type || "text"}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  value={formData[field.key]}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  disabled={loading}
                  required={field.required}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Create a student account with login credentials and add them to your class. 
              The system will automatically generate a username and password.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {/* Class Selection */}
            <div className="grid gap-2">
              <Label htmlFor="class">Class *</Label>
              <Select
                value={formData.classId}
                onValueChange={(value: string) => setFormData({ ...formData, classId: value })}
                disabled={loading}
              >
                <SelectTrigger id="class">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account Credentials */}
            {formData.name && (
              <div className="space-y-4">
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Generated Username:</strong> {generateUsername(formData.name)}
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="useCustomPassword"
                      checked={useCustomPassword}
                      onChange={(e) => {
                        setUseCustomPassword(e.target.checked)
                        if (!e.target.checked) {
                          setCustomPassword('')
                          setPasswordError('')
                          setPasswordTouched(false)
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="useCustomPassword" className="text-sm">
                      Set custom password (otherwise auto-generated)
                    </Label>
                  </div>

                  {useCustomPassword && (
                    <div className="space-y-2">
                      <Label htmlFor="customPassword">Password *</Label>
                      <div className="relative">
                        <Input
                          id="customPassword"
                          type={showPassword ? "text" : "password"}
                          value={customPassword}
                          onChange={(e) => handlePasswordChange(e.target.value)}
                          onBlur={handlePasswordBlur}
                          placeholder="Enter password (min 5 characters)"
                          className={passwordError ? "border-red-500" : ""}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      {passwordError && (
                        <p className="text-sm text-red-600">{passwordError}</p>
                      )}
                      {!passwordError && passwordTouched && customPassword && (
                        <p className="text-sm text-green-600">✓ Password meets requirements</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Public Information */}
            {renderFieldGroup("Basic Information", [
              { key: 'name', label: 'Full Name', required: true },
              { key: 'email', label: 'Email Address', type: 'email', required: true },
              { key: 'grade_level', label: 'Grade Level', options: [...GRADE_LEVELS] }
            ], DataClassification.PUBLIC)}

            {/* Educational Information */}
            {renderFieldGroup("Educational Information", [
              { key: 'student_id', label: 'Student ID' }
            ], DataClassification.EDUCATIONAL)}

            {/* Restricted Information */}
            {renderFieldGroup("Contact Information", [
              { key: 'phone', label: 'Phone Number', type: 'tel' },
              { key: 'parent_email', label: 'Parent Email', type: 'email' },
              { key: 'address', label: 'Home Address', type: 'textarea' },
              { key: 'emergency_contact', label: 'Emergency Contact' },
              { key: 'emergency_phone', label: 'Emergency Phone', type: 'tel' }
            ], DataClassification.RESTRICTED)}

            {/* Confidential Information */}
            {renderFieldGroup("Medical & Special Information", [
              { key: 'medical_info', label: 'Medical Information', type: 'textarea' },
              { key: 'special_needs', label: 'Special Needs', type: 'textarea' },
              { key: 'dietary_restrictions', label: 'Dietary Restrictions', type: 'textarea' },
              { key: 'notes', label: 'Additional Notes', type: 'textarea' }
            ], DataClassification.CONFIDENTIAL)}
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Student Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 