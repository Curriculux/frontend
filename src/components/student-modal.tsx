'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Edit3, Save, Shield, Eye, EyeOff, User, Mail, Phone, MapPin, Users, Calendar, FileText, AlertTriangle, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PloneStudent, ploneAPI } from '@/lib/api'
import { getSecurityManager, SecurityContext, DataClassification, STUDENT_FIELD_CLASSIFICATION } from '@/lib/security'
import { toast } from 'sonner'

interface StudentModalProps {
  student: PloneStudent | null
  isOpen: boolean
  onClose: () => void
  onSave?: (student: PloneStudent) => void
  onDelete?: (student: PloneStudent) => void
  securityContext: SecurityContext | null
  classId?: string
}

export function StudentModal({ student, isOpen, onClose, onSave, onDelete, securityContext, classId }: StudentModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedStudent, setEditedStudent] = useState<PloneStudent | null>(null)
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteUserAccount, setDeleteUserAccount] = useState(false)

  const securityManager = getSecurityManager()

  // Initialize edited student data when student changes
  useEffect(() => {
    if (student) {
      setEditedStudent({ ...student })
    }
  }, [student])

  if (!student || !securityContext) {
    return null
  }

  // Security checks
  const canViewStudent = securityContext.canAccessStudent(student.id || '', classId)
  const canEditStudent = securityContext.hasPermission('Modify portal content')
  const canDeleteStudent = securityContext.hasRole('Manager') || securityContext.hasRole('Site Administrator')
  const canViewSensitive = securityContext.hasRole('Manager') || securityContext.hasRole('Site Administrator')

  if (!canViewStudent) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Access Denied
            </DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to view this student's information.
            </AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const handleSave = async () => {
    if (!editedStudent || !onSave) return

    setLoading(true)
    try {
      await onSave(editedStudent)
      setIsEditing(false)
      toast.success('Student information updated successfully')
    } catch (error) {
      console.error('Error saving student:', error)
      toast.error('Failed to update student information')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditedStudent({ ...student })
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setLoading(true)
    try {
      // Try to determine username using the same logic as creation
      let username = ''
      if (student.name && typeof student.name === 'string') {
        // Use the same username generation logic as create-student-dialog
        username = student.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 12)
        
        // Ensure minimum length of 3 characters
        if (username.length < 3) {
          username = username.padEnd(3, '1')
        }
      } else if (student.email && typeof student.email === 'string') {
        // Fallback to email prefix if name not available
        username = student.email.split('@')[0]
      } else if (student.student_id && typeof student.student_id === 'string') {
        username = student.student_id
      }

      // Use the comprehensive deletion method
      const result = await ploneAPI.deleteStudentCompletely({
        username: username || undefined, // Only pass username if we have one
        classId: classId || '',
        studentId: student.id || student.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || '',
        deleteUserAccount: deleteUserAccount && !!username // Only delete user account if we have a username
      })

      if (result.errors.length > 0) {
        toast.error(`Deletion completed with errors: ${result.errors.join(', ')}`)
      } else {
        toast.success(`Student deleted successfully. Records removed from ${result.recordsDeleted.length} location(s).${result.userAccountDeleted ? ' User account also deleted.' : ''}`)
      }

      onDelete(student)
      onClose()
    } catch (error) {
      console.error('Error deleting student:', error)
      toast.error('Failed to delete student')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: keyof PloneStudent, value: any) => {
    if (editedStudent) {
      setEditedStudent({
        ...editedStudent,
        [field]: value
      })
    }
  }

  const renderField = (
    field: keyof PloneStudent,
    label: string,
    value: any,
    icon?: React.ReactNode,
    type: 'text' | 'email' | 'tel' | 'textarea' = 'text'
  ) => {
    // Skip fields that don't exist in the classification mapping
    if (!(field in STUDENT_FIELD_CLASSIFICATION)) {
      return null
    }
    
    const classification = STUDENT_FIELD_CLASSIFICATION[field as keyof typeof STUDENT_FIELD_CLASSIFICATION]
    const canViewField = securityContext.canViewField(field as keyof typeof STUDENT_FIELD_CLASSIFICATION, student.id)
    const canEditField = securityContext.canEditField(field as keyof typeof STUDENT_FIELD_CLASSIFICATION, student.id)

    // Don't show sensitive fields unless explicitly allowed
    if (classification !== DataClassification.PUBLIC && !showSensitiveData && !canViewField) {
      return null
    }

    const isRestricted = classification === DataClassification.RESTRICTED || classification === DataClassification.CONFIDENTIAL
    const isStudentOwn = classification === DataClassification.STUDENT_OWN

    return (
      <div key={field} className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <Label htmlFor={field} className="text-sm font-medium">
            {label}
            {isRestricted && (
              <Shield className="inline h-3 w-3 ml-1 text-amber-500" />
            )}
            {isStudentOwn && (
              <User className="inline h-3 w-3 ml-1 text-blue-500" />
            )}
          </Label>
        </div>
        
        {isEditing && canEditField ? (
          type === 'textarea' ? (
            <Textarea
              id={field}
              value={editedStudent?.[field] || ''}
              onChange={(e) => updateField(field, e.target.value)}
              className="w-full"
              rows={3}
            />
          ) : (
            <Input
              id={field}
              type={type}
              value={editedStudent?.[field] || ''}
              onChange={(e) => updateField(field, e.target.value)}
              className="w-full"
            />
          )
        ) : canViewField ? (
          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border">
            {value || 'Not provided'}
          </div>
        ) : (
          <div className="text-sm text-gray-400 bg-gray-100 p-2 rounded border">
            <Shield className="inline h-3 w-3 mr-1" />
            Restricted - Insufficient permissions
          </div>
        )}
      </div>
    )
  }

  const getClassificationBadge = (classification: DataClassification) => {
    const badges = {
      [DataClassification.PUBLIC]: { label: 'Public', color: 'bg-green-100 text-green-800' },
      [DataClassification.EDUCATIONAL]: { label: 'Educational', color: 'bg-blue-100 text-blue-800' },
      [DataClassification.RESTRICTED]: { label: 'Restricted', color: 'bg-amber-100 text-amber-800' },
      [DataClassification.CONFIDENTIAL]: { label: 'Confidential', color: 'bg-red-100 text-red-800' },
      [DataClassification.STUDENT_OWN]: { label: 'Student Access', color: 'bg-purple-100 text-purple-800' },
    }
    
    const badge = badges[classification]
    return <Badge className={badge.color}>{badge.label}</Badge>
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {student.name}
            </div>
            <div className="flex items-center gap-2">
              {canViewSensitive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSensitiveData(!showSensitiveData)}
                  className="flex items-center gap-2"
                >
                  {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showSensitiveData ? 'Hide' : 'Show'} Sensitive Data
                </Button>
              )}
              {canEditStudent && !isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
              )}
              {canDeleteStudent && !isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Delete Confirmation */}
          {deleteConfirm && (
            <div className="border-red-200 bg-red-50 border rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-2">Delete Student</h4>
              <p className="text-sm text-red-700 mb-4">
                Are you sure you want to delete <strong>{student.name}</strong>? This will remove their record from this class.
              </p>
              
              {canDeleteStudent && (
                <div className="mb-4">
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={deleteUserAccount}
                      onChange={(e) => setDeleteUserAccount(e.target.checked)}
                      className="rounded border-gray-300"
                      disabled={!student.email && !student.student_id}
                    />
                    <span className={`${!student.email && !student.student_id ? 'text-gray-400' : 'text-red-700'}`}>
                      Also delete user account (student will not be able to log in)
                      {!student.email && !student.student_id && ' - No username available'}
                    </span>
                  </label>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Yes, Delete Student'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!deleteConfirm && (
            <>
              {/* Access Level Indicator */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Access Level: <strong>{securityManager.getUserRoleDisplay()}</strong>
                  {!canViewSensitive && ' - Some information may be restricted'}
                </AlertDescription>
              </Alert>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField('name', 'Full Name', student.name, <User className="h-4 w-4" />)}
              {renderField('email', 'Email', student.email, <Mail className="h-4 w-4" />, 'email')}
              {renderField('student_id', 'Student ID', student.student_id, <FileText className="h-4 w-4" />)}
              {renderField('grade_level', 'Grade Level', student.grade_level, <Calendar className="h-4 w-4" />)}
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField('phone', 'Phone Number', student.phone, <Phone className="h-4 w-4" />, 'tel')}
              {renderField('address', 'Address', student.address, <MapPin className="h-4 w-4" />)}
              {renderField('parent_email', 'Parent Email', student.parent_email, <Mail className="h-4 w-4" />, 'email')}
            </div>
          </div>

          <Separator />

          {/* Emergency Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField('emergency_contact', 'Emergency Contact Name', student.emergency_contact, <Users className="h-4 w-4" />)}
              {renderField('emergency_phone', 'Emergency Phone', student.emergency_phone, <Phone className="h-4 w-4" />, 'tel')}
            </div>
          </div>

          <Separator />

          {/* Medical & Special Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Medical & Special Information
            </h3>
            <div className="space-y-4">
              {renderField('medical_info', 'Medical Information', student.medical_info, <FileText className="h-4 w-4" />, 'textarea')}
              {renderField('special_needs', 'Special Needs', student.special_needs, <FileText className="h-4 w-4" />, 'textarea')}
              {renderField('dietary_restrictions', 'Dietary Restrictions', student.dietary_restrictions, <FileText className="h-4 w-4" />)}
            </div>
          </div>

          <Separator />

          {/* Additional Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notes</h3>
            {renderField('notes', 'Additional Notes', student.notes, <FileText className="h-4 w-4" />, 'textarea')}
          </div>

          {/* Data Classification Legend */}
          {showSensitiveData && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Data Classification:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.values(DataClassification).map((classification) => (
                  <div key={classification}>
                    {getClassificationBadge(classification)}
                  </div>
                ))}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </div>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 