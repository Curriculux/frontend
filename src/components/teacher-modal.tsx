"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  BookOpen,
  Edit3,
  Save,
  X,
  Trash2,
  Shield,
  Users,
  Building,
  Award,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

import { ploneAPI, PloneTeacher } from "@/lib/api"
import { getSecurityManager, PLONE_ROLES } from "@/lib/security"
import { toast } from "sonner"

interface TeacherModalProps {
  teacher: PloneTeacher | null
  isOpen: boolean
  onClose: () => void
  onSave: (teacher: PloneTeacher) => Promise<void>
  onDelete: (teacher: PloneTeacher) => Promise<void>
  securityContext: any
}

export function TeacherModal({
  teacher,
  isOpen,
  onClose,
  onSave,
  onDelete,
  securityContext
}: TeacherModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteUserAccount, setDeleteUserAccount] = useState(false)
  const [editedTeacher, setEditedTeacher] = useState<PloneTeacher | null>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [teacherClasses, setTeacherClasses] = useState<any[]>([])

  useEffect(() => {
    if (teacher && isOpen) {
      setEditedTeacher({ ...teacher })
      setIsEditing(false)
      loadTeacherData()
    }
  }, [teacher, isOpen])

  const loadTeacherData = async () => {
    if (!teacher) return

    try {
      // Load classes and find which ones this teacher is assigned to
      const allClasses = await ploneAPI.getClasses()
      setClasses(allClasses)
      
      // Find classes taught by this teacher
      const assignedClasses = allClasses.filter((cls: any) => 
        cls.teacher === teacher.fullname || 
        cls.teacher === teacher.username ||
        cls.teacher?.toLowerCase() === teacher.fullname?.toLowerCase()
      )
      setTeacherClasses(assignedClasses)
    } catch (error) {
      console.error('Error loading teacher data:', error)
    }
  }

  const handleSave = async () => {
    if (!editedTeacher) return

    try {
      setIsSaving(true)
      await onSave(editedTeacher)
      setIsEditing(false)
      toast.success('Teacher information updated successfully')
    } catch (error) {
      console.error('Error saving teacher:', error)
      toast.error('Failed to save teacher information')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedTeacher({ ...teacher } as PloneTeacher)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!teacher) return

    try {
      setIsDeleting(true)
      
      // Create the deletion request with options
      const deleteRequest = {
        ...teacher,
        deleteUserAccount: deleteUserAccount && !!(teacher.email || teacher.username)
      }
      
      await onDelete(deleteRequest as PloneTeacher)
      toast.success('Teacher account deleted successfully')
      setDeleteConfirm(false)
      onClose()
    } catch (error) {
      console.error('Error deleting teacher:', error)
      toast.error('Failed to delete teacher account')
    } finally {
      setIsDeleting(false)
    }
  }

  const getRoleDisplay = (roles: string[]) => {
    if (roles.includes('Manager') || roles.includes('Site Administrator')) {
      return 'Administrator'
    } else if (roles.includes('Editor')) {
      return 'Teacher'
    }
    return 'Staff'
  }

  const getRoleBadgeColor = (roles: string[]) => {
    if (roles.includes('Manager') || roles.includes('Site Administrator')) {
      return 'bg-purple-100 text-purple-700 border-purple-200'
    } else if (roles.includes('Editor')) {
      return 'bg-blue-100 text-blue-700 border-blue-200'
    }
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const getTeacherInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const canEdit = () => {
    return securityContext?.isAdmin() || false
  }

  const canDelete = () => {
    return securityContext?.isAdmin() || false
  }

  const canViewSensitiveData = () => {
    return securityContext?.isAdmin() || false
  }

  if (!teacher) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {teacher.fullname}
            </div>
            <div className="flex items-center gap-2">
              {canViewSensitiveData() && (
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
              {canEdit() && !isEditing && (
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
              {canDelete() && !isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(true)}
                  className="text-red-600 hover:text-red-700 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Teacher Profile Header */}
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src="" alt={teacher.fullname} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-lg">
                {getTeacherInitials(teacher.fullname)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{teacher.fullname}</h3>
              <p className="text-sm text-muted-foreground">{teacher.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getRoleBadgeColor(teacher.roles)}>
                  {getRoleDisplay(teacher.roles)}
                </Badge>
                <p className="text-sm text-muted-foreground">@{teacher.username}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delete Confirmation */}
          {deleteConfirm && (
            <div className="border-red-200 bg-red-50 border rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-2">Delete Teacher</h4>
              <p className="text-sm text-red-700 mb-4">
                Are you sure you want to delete <strong>{teacher.fullname}</strong>? This will remove their teacher account and all associated data.
              </p>
              
              {canDelete() && (
                <div className="mb-4">
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={deleteUserAccount}
                      onChange={(e) => setDeleteUserAccount(e.target.checked)}
                      className="rounded border-gray-300"
                      disabled={!teacher.email && !teacher.username}
                    />
                    <span className={`${!teacher.email && !teacher.username ? 'text-gray-400' : 'text-red-700'}`}>
                      Also delete user account (teacher will not be able to log in)
                      {!teacher.email && !teacher.username && ' - No username available'}
                    </span>
                  </label>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Teacher'}
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
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullname">Full Name</Label>
                {isEditing ? (
                  <Input
                    id="fullname"
                    value={editedTeacher?.fullname || ''}
                    onChange={(e) => setEditedTeacher(prev => prev ? { ...prev, fullname: e.target.value } : null)}
                  />
                ) : (
                  <p className="text-sm py-2">{teacher.fullname}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={editedTeacher?.email || ''}
                    onChange={(e) => setEditedTeacher(prev => prev ? { ...prev, email: e.target.value } : null)}
                  />
                ) : (
                  <p className="text-sm py-2">{teacher.email}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <p className="text-sm py-2 text-muted-foreground">@{teacher.username}</p>
            </div>
          </div>

          <Separator />

          {/* Professional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Professional Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {isEditing ? (
                  <Input
                    id="department"
                    value={editedTeacher?.department || ''}
                    onChange={(e) => setEditedTeacher(prev => prev ? { ...prev, department: e.target.value } : null)}
                    placeholder="e.g., Mathematics"
                  />
                ) : (
                  <p className="text-sm py-2">{teacher.department || 'Not specified'}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="office">Office Location</Label>
                {isEditing ? (
                  <Input
                    id="office"
                    value={editedTeacher?.office || ''}
                    onChange={(e) => setEditedTeacher(prev => prev ? { ...prev, office: e.target.value } : null)}
                    placeholder="e.g., Room 203"
                  />
                ) : (
                  <p className="text-sm py-2">{teacher.office || 'Not specified'}</p>
                )}
              </div>
            </div>

            {showSensitiveData && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={editedTeacher?.phone || ''}
                    onChange={(e) => setEditedTeacher(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    placeholder="(555) 123-4567"
                  />
                ) : (
                  <p className="text-sm py-2">{teacher.phone || 'Not provided'}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Specialties</Label>
              {isEditing ? (
                <Textarea
                  id="bio"
                  value={editedTeacher?.bio || ''}
                  onChange={(e) => setEditedTeacher(prev => prev ? { ...prev, bio: e.target.value } : null)}
                  placeholder="Brief description of teaching specialties and background..."
                  rows={3}
                />
              ) : (
                <p className="text-sm py-2">{teacher.bio || 'No bio provided'}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Teaching Assignments */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Teaching Assignments
            </h3>
            
            {teacherClasses.length > 0 ? (
              <div className="grid gap-3">
                {teacherClasses.map((cls) => (
                  <div key={cls.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{cls.title}</h4>
                        <p className="text-sm text-muted-foreground">{cls.description}</p>
                      </div>
                      <Badge variant="outline">{cls.subject || 'General'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">No classes assigned</p>
            )}
          </div>

          <Separator />

          {/* System Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              System Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Roles</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {teacher.roles.map((role) => (
                    <Badge key={role} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Account Created</Label>
                <p className="mt-1">{teacher.created ? new Date(teacher.created).toLocaleDateString() : 'Unknown'}</p>
              </div>
            </div>
          </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
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