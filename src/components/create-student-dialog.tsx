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
import { Loader2, Shield, Info } from "lucide-react"
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
    }
  }, [open])

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
      // Use the secure student creation API
      await ploneAPI.createStudentSecure(formData.classId, {
        // Only include fields the user has permission to set
        name: formData.name,
        email: formData.email,
        grade_level: formData.grade_level,
        student_id: formData.student_id,
        
        // Include restricted fields only if user has permission
        ...(canEditField('phone') && { phone: formData.phone }),
        ...(canEditField('address') && { address: formData.address }),
        ...(canEditField('emergency_contact') && { emergency_contact: formData.emergency_contact }),
        ...(canEditField('emergency_phone') && { emergency_phone: formData.emergency_phone }),
        ...(canEditField('parent_email') && { parent_email: formData.parent_email }),
        
        // Include confidential fields only if user has permission
        ...(canEditField('medical_info') && { medical_info: formData.medical_info }),
        ...(canEditField('special_needs') && { special_needs: formData.special_needs }),
        ...(canEditField('dietary_restrictions') && { dietary_restrictions: formData.dietary_restrictions }),
        ...(canEditField('notes') && { notes: formData.notes }),
      })
      
      toast({
        title: "Success!",
        description: `${formData.name} has been added to the class successfully.`
      })
      
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
      
      onOpenChange(false)
      onStudentCreated()
    } catch (error) {
      console.error("Failed to create student:", error)
      toast({
        title: "Error",
        description: "Failed to add student. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Update classId when defaultClassId changes
  if (defaultClassId && formData.classId !== defaultClassId) {
    setFormData({ ...formData, classId: defaultClassId })
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Add a student to your class. Fields are organized by security level - you can only edit information you have permission to access.
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
              onClick={() => onOpenChange(false)}
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
              Add Student
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 