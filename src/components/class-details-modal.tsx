"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ploneAPI, PloneStudent } from "@/lib/api"
import { GRADE_LEVELS, SUBJECTS, SUBJECT_COLORS } from "@/lib/constants"
import { BookOpen, Edit, Trash2, Save, X, Users, FileText, Calendar, GraduationCap, Loader2, Plus, MoreVertical, AlertTriangle, CheckSquare, Square, Video, PenTool, Calculator } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { VirtualMeetingButton } from "./virtual-meeting-button"
import { WhiteboardModal } from "./whiteboard-modal"
import { EnrollExistingStudentDialog } from "./enroll-existing-student-dialog"
import { useRouter } from "next/navigation"
import { getSecurityManager } from "@/lib/security"
import { useAuth } from "@/lib/auth"

interface PloneClass {
  '@id': string;
  id: string;
  title: string;
  description: string;
  originalDescription?: string;
  teacher?: string;
  subject?: string;
  gradeLevel?: string;
  schedule?: string;
  created: string;
  modified: string;
}

interface ClassDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classData: PloneClass | null
  onClassUpdated: () => void
  onClassDeleted: () => void
}

export function ClassDetailsModal({ 
  open, 
  onOpenChange, 
  classData,
  onClassUpdated,
  onClassDeleted
}: ClassDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [assignments, setAssignments] = useState<any[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [enrollExistingStudentDialogOpen, setEnrollExistingStudentDialogOpen] = useState(false)
  const [studentsRefreshTrigger, setStudentsRefreshTrigger] = useState(0)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    teacher: "",
    subject: "",
    gradeLevel: "",
    schedule: ""
  })
  const { toast } = useToast()
  const router = useRouter()
  
  // Security context and user info
  const { user } = useAuth()
  const securityManager = getSecurityManager()
  const securityContext = securityManager.getSecurityContext()
  
  // Permission checks
  const canEdit = () => {
    if (!user || !securityContext || !classData) return false
    
    // Admins can edit any class
    if (securityContext.isAdmin()) return true
    
    // Teachers can edit only their own classes
    if (securityContext.isTeacher()) {
      return classData.teacher === user.fullname || classData.teacher === user.username
    }
    
    // Students cannot edit
    return false
  }
  
  const canDelete = () => {
    if (!user || !securityContext || !classData) return false
    
    // Only admins can delete classes
    return securityContext.isAdmin()
  }
  
  const canViewStudents = () => {
    if (!user || !securityContext || !classData) return false
    
    // Admins can view all students
    if (securityContext.isAdmin()) return true
    
    // Teachers can view students in their classes
    if (securityContext.isTeacher()) {
      return classData.teacher === user.fullname || classData.teacher === user.username
    }
    
    // Students cannot view other students
    return false
  }

  // Reset edit mode if user doesn't have permission
  useEffect(() => {
    if (isEditing && !canEdit()) {
      setIsEditing(false)
    }
  }, [isEditing, canEdit])

  // Load assignments for this class
  const loadAssignments = async () => {
    if (!classData?.id) return
    
    setAssignmentsLoading(true)
    try {
      const assignmentsData = await ploneAPI.getAssignments(classData.id)
      setAssignments(assignmentsData)
    } catch (error: any) {
      console.error('Failed to load assignments:', error)
      // If class is not found (404), it means the class was deleted
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        console.log('Class not found, likely deleted. Clearing assignments.')
        setAssignments([])
      }
    } finally {
      setAssignmentsLoading(false)
    }
  }

  // Update form when class changes
  useEffect(() => {
    if (classData && open) {
      // Parse metadata from original description (or fallback to description)
      const descriptionWithMetadata = classData.originalDescription || classData.description || ''
      const metadata = ploneAPI.parseClassMetadata(descriptionWithMetadata)
      const cleanDescription = descriptionWithMetadata.replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim()

      setFormData({
        title: classData.title || "",
        description: cleanDescription || "",
        teacher: metadata.teacher || classData.teacher || "",
        subject: metadata.subject || "",
        gradeLevel: metadata.gradeLevel || "",
        schedule: metadata.schedule || ""
      })
      setIsEditing(false)
      setDeleteConfirm(false)
      
      // Load assignments when class changes and modal is open
      loadAssignments()
    }
  }, [classData, open])

  // Clear assignments when modal closes
  useEffect(() => {
    if (!open) {
      setAssignments([])
      setAssignmentsLoading(false)
    }
  }, [open])

  const handleSave = async () => {
    if (!classData) return

    // Validate required fields
    if (!formData.title || !formData.teacher || !formData.subject || !formData.gradeLevel) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (Title, Teacher, Subject, and Grade Level)",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      await ploneAPI.updateClass(classData.id, {
        title: formData.title,
        description: formData.description,
        teacher: formData.teacher,
        subject: formData.subject,
        grade_level: formData.gradeLevel,
        schedule: formData.schedule
      })
      
      toast({
        title: "Success!",
        description: "Class updated successfully."
      })
      
      setIsEditing(false)
      onClassUpdated()
    } catch (error) {
      console.error("Failed to update class:", error)
      toast({
        title: "Error",
        description: "Failed to update class. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!classData) return

    setLoading(true)
    try {
      await ploneAPI.deleteClass(classData.id)
      
      toast({
        title: "Success!",
        description: "Class deleted successfully."
      })
      
      onOpenChange(false)
      onClassDeleted()
    } catch (error) {
      console.error("Failed to delete class:", error)
      toast({
        title: "Error",
        description: "Failed to delete class. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (!classData) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span className="truncate">{isEditing ? "Edit Class" : classData.title}</span>
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isEditing ? "Update class information" : formData.description || "Class details and settings"}
              </DialogDescription>
            </div>
            {!isEditing && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    router.push(`/gradebook/${classData.id}`)
                  }}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Gradebook
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowWhiteboard(true);
                    onOpenChange(false); // Close the class details modal
                  }}
                >
                  <PenTool className="w-4 h-4 mr-1" />
                  Whiteboard
                </Button>
                {canEdit() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                {canDelete() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirm(true)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {deleteConfirm ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-red-800 mb-2">Delete Class</h4>
              <p className="text-sm text-red-700 mb-4">
                Are you sure you want to delete "{classData.title}"? This will also delete all assignments, students, and other content in this class. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Yes, Delete Class
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className={`grid w-full ${canViewStudents() ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="details">Details</TabsTrigger>
              {canViewStudents() && <TabsTrigger value="students">Students</TabsTrigger>}
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="meetings">Meetings</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 min-h-[400px]">
              {isEditing && canEdit() ? (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title">Class Name *</Label>
                    <Input
                      id="edit-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      disabled={loading}
                      placeholder="e.g., Algebra I - Period 3"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="edit-teacher">Teacher *</Label>
                    <Input
                      id="edit-teacher"
                      value={formData.teacher}
                      onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                      disabled={loading}
                      placeholder="e.g., Ms. Smith"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-subject">Subject *</Label>
                      <Select
                        value={formData.subject}
                        onValueChange={(value: string) => setFormData({ ...formData, subject: value })}
                        disabled={loading}
                      >
                        <SelectTrigger id="edit-subject">
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBJECTS.map((subject) => (
                            <SelectItem key={subject} value={subject}>
                              {subject}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="edit-gradeLevel">Grade Level *</Label>
                      <Select
                        value={formData.gradeLevel}
                        onValueChange={(value: string) => setFormData({ ...formData, gradeLevel: value })}
                        disabled={loading}
                      >
                        <SelectTrigger id="edit-gradeLevel">
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
                  
                  <div className="grid gap-2">
                    <Label htmlFor="edit-schedule">Schedule (Optional)</Label>
                    <Input
                      id="edit-schedule"
                      value={formData.schedule}
                      onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                      disabled={loading}
                      placeholder="e.g., MWF 9:00-10:15 AM"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="edit-description">Description (Optional)</Label>
                    <Textarea
                      id="edit-description"
                      value={formData.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                      disabled={loading}
                      rows={3}
                      placeholder="Brief description of the class..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Class Name */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{classData.title}</h3>
                    {formData.description && (
                      <p className="text-sm text-slate-600">{formData.description}</p>
                    )}
                  </div>

                  {/* Teacher */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700 block mb-2">Teacher</Label>
                    <p className="text-sm text-slate-900 font-medium">
                      {formData.teacher || "No teacher assigned"}
                    </p>
                  </div>

                  {/* Required Fields */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-sm font-medium text-slate-700 block mb-2">Subject</Label>
                      {formData.subject ? (
                        <div>
                          <Badge className={`${SUBJECT_COLORS[formData.subject] || "bg-gray-100 text-gray-800"}`}>
                            {formData.subject}
                          </Badge>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No subject set</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-slate-700 block mb-2">Grade Level</Label>
                      <p className="text-sm text-slate-900">
                        {formData.gradeLevel || "No grade level set"}
                      </p>
                    </div>
                  </div>

                  {/* Optional Fields */}
                  {formData.schedule && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700 block mb-2">Schedule</Label>
                      <p className="text-sm text-slate-900">{formData.schedule}</p>
                    </div>
                  )}


                </div>
              )}
            </TabsContent>

            {canViewStudents() && (
              <TabsContent value="students" className="min-h-[400px]">
                <StudentsTab 
                  classId={classData.id} 
                  onEnrollExistingStudent={() => setEnrollExistingStudentDialogOpen(true)}
                  refreshTrigger={studentsRefreshTrigger}
                />
              </TabsContent>
            )}

            <TabsContent value="assignments" className="min-h-[400px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Assignments</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      onOpenChange(false)
                      // Navigate to assignments view
                    }}
                  >
                    View All Assignments
                  </Button>
                </div>
                
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : assignments.length > 0 ? (
                  <div className="space-y-3">
                    {assignments.slice(0, 5).map((assignment, index) => (
                      <Card key={assignment.id || `assignment-${index}`} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{assignment.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{assignment.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              {assignment.dueDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Due: {new Date(assignment.dueDate).toLocaleDateString()}
                                </div>
                              )}
                              {assignment.points && (
                                <div className="flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3" />
                                  {assignment.points} points
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {assignments.length > 5 && (
                      <p className="text-sm text-gray-500 text-center">
                        And {assignments.length - 5} more assignments...
                      </p>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="font-semibold text-gray-900 mb-2">No Assignments Yet</h3>
                      <p className="text-sm text-gray-600">
                        No assignments have been created for this class yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="meetings" className="min-h-[400px]">
              <MeetingsTab classId={classData?.id || ''} />
            </TabsContent>
          </Tabs>
        )}

        {isEditing && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false)
                // Reset form data
                if (classData) {
                  const descriptionWithMetadata = classData.originalDescription || classData.description || ''
                  const metadata = ploneAPI.parseClassMetadata(descriptionWithMetadata)
                  setFormData({
                    title: classData.title || "",
                    description: descriptionWithMetadata.replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim() || "",
                    teacher: metadata.teacher || classData.teacher || "",
                    subject: metadata.subject || "",
                    gradeLevel: metadata.gradeLevel || "",
                    schedule: metadata.schedule || ""
                  })
                }
              }}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4 mr-1" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
      
      {/* Whiteboard Modal */}
      {classData && (
        <WhiteboardModal
          open={showWhiteboard}
          onOpenChange={(open) => {
            setShowWhiteboard(open);
            // If whiteboard modal is closing, reopen the class details modal
            if (!open) {
              onOpenChange(true);
            }
          }}
          classId={classData.id || ''}
        />
      )}

      {/* Enroll Existing Student Dialog */}
      {classData && (
        <EnrollExistingStudentDialog
          open={enrollExistingStudentDialogOpen}
          onOpenChange={setEnrollExistingStudentDialogOpen}
          defaultClassId={classData.id}
          onStudentEnrolled={(studentUsername, classId) => {
            // Refresh students list after enrollment
            setStudentsRefreshTrigger(prev => prev + 1)
            // Also refresh assignments in case they're relevant
            loadAssignments()
          }}
        />
      )}
    </Dialog>
  )
}

// StudentsTab component to show enrolled students
function StudentsTab({ 
  classId, 
  onEnrollExistingStudent,
  refreshTrigger 
}: { 
  classId: string;
  onEnrollExistingStudent: () => void;
  refreshTrigger?: number;
}) {
  const [students, setStudents] = useState<PloneStudent[]>([])
  const [loading, setLoading] = useState(true)
  
  // Security context for permission checks
  const securityManager = getSecurityManager()
  const securityContext = securityManager.getSecurityContext()

  useEffect(() => {
    loadStudents()
  }, [classId])

  // Refresh students when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadStudents()
    }
  }, [refreshTrigger])

  const loadStudents = async () => {
    try {
      setLoading(true)
      const classStudents = await ploneAPI.getStudents(classId)
      setStudents(classStudents)
    } catch (error) {
      console.error('Error loading students:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading students...</p>
        </CardContent>
      </Card>
    )
  }

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">No Students Enrolled</h3>
          <p className="text-sm text-gray-600 mb-4">
            Students will appear here when they are enrolled in this class.
          </p>
          {(securityContext?.isAdmin() || securityContext?.isTeacher()) && (
            <Button 
              onClick={onEnrollExistingStudent}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Enroll Existing Student
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Enrolled Students ({students.length})</h3>
        {(securityContext?.isAdmin() || securityContext?.isTeacher()) && (
          <Button 
            onClick={onEnrollExistingStudent}
            size="sm"
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Enroll Student
          </Button>
        )}
      </div>
      
      <div className="grid gap-4">
        {students.map((student, index) => (
          <Card key={student.id || student.email || index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{student.name}</h4>
                  <p className="text-sm text-gray-600">{student.email}</p>
                  {student.student_id && (
                    <p className="text-xs text-gray-500">ID: {student.student_id}</p>
                  )}
                </div>
                <div className="text-right">
                  {student.grade_level && (
                    <Badge variant="outline">{student.grade_level}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  )
}

// MeetingsTab component to show class meetings
function MeetingsTab({ classId }: { classId: string }) {
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const [deleteConfirm, setDeleteConfirm] = useState<{ meetingId: string; title: string } | null>(null)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadMeetings()
  }, [classId])

  const loadMeetings = async () => {
    try {
      setLoading(true)
      const classMeetings = await ploneAPI.getMeetings(classId)
      setMeetings(classMeetings)
    } catch (error) {
      console.error('Error loading meetings:', error)
    } finally {
      setLoading(false)
    }
  }



  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      await ploneAPI.deleteMeeting(meetingId, classId)
      toast({
        title: "Meeting Deleted",
        description: "The meeting has been successfully deleted."
      })
      setDeleteConfirm(null)
      loadMeetings() // Refresh the list
    } catch (error) {
      console.error('Error deleting meeting:', error)
      toast({
        title: "Error",
        description: "Failed to delete the meeting. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleBulkDeleteOlder = async (daysOld: number) => {
    setBulkDeleteLoading(true)
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)
      
      const results = await ploneAPI.deleteMeetingsBefore(cutoffDate.toISOString(), classId)
      
      toast({
        title: "Bulk Delete Complete",
        description: `Successfully deleted ${results.deleted} old meetings. ${results.errors.length > 0 ? `${results.errors.length} errors occurred.` : ''}`
      })
      
      if (results.errors.length > 0) {
        console.error('Bulk delete errors:', results.errors)
      }
      
      setBulkDeleteOpen(false)
      loadMeetings() // Refresh the list
    } catch (error) {
      console.error('Error bulk deleting meetings:', error)
      toast({
        title: "Error",
        description: "Failed to delete old meetings. Please try again.",
        variant: "destructive"
      })
    } finally {
      setBulkDeleteLoading(false)
    }
  }

  const getOlderMeetingsCount = (daysOld: number): number => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    return meetings.filter(meeting => new Date(meeting.startTime) < cutoffDate).length
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading meetings...</p>
        </CardContent>
      </Card>
    )
  }

  if (meetings.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Class Meetings (0)</h3>
          <VirtualMeetingButton
            classId={classId}
            className="h-9 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          />
        </div>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No Meetings Scheduled</h3>
            <p className="text-sm text-gray-600 mb-4">
              Virtual meetings will appear here when scheduled. You can also use the "Clean Up" feature to remove old meetings.
            </p>
            <VirtualMeetingButton
              classId={classId}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Class Meetings ({meetings.length})</h3>
        <div className="flex items-center gap-2">
          {meetings.length > 0 && (
            <DropdownMenu open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clean Up
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="p-3">
                  <h4 className="font-medium text-sm mb-2">Delete Old Meetings</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Remove meetings older than a specified time to clean up your class.
                  </p>
                  
                  <div className="space-y-2">
                    {[30, 60, 90].map((days) => {
                      const count = getOlderMeetingsCount(days)
                      return (
                        <DropdownMenuItem 
                          key={days}
                          disabled={count === 0 || bulkDeleteLoading}
                          onClick={() => handleBulkDeleteOlder(days)}
                          className="flex items-center justify-between"
                        >
                          <span>Older than {days} days</span>
                          <Badge variant="secondary" className="ml-2">
                            {count}
                          </Badge>
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
                  
                  {bulkDeleteLoading && (
                    <div className="flex items-center justify-center mt-3 pt-2 border-t">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span className="text-sm text-gray-500">Deleting...</span>
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <VirtualMeetingButton
            classId={classId}
            className="h-9 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          />
        </div>
      </div>
      
      <div className="grid gap-4">
        {meetings.map((meeting, index) => {
          const meetingDate = new Date(meeting.startTime)
          const isOld = meetingDate < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Older than 7 days
          const isPast = meetingDate < new Date()
          
          return (
            <Card key={meeting.id || index} className={isOld ? "border-orange-200 bg-orange-50/30" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{meeting.title}</h4>
                      {isOld && <Badge variant="outline" className="text-orange-600 border-orange-200">Old</Badge>}
                      {isPast && meeting.status === 'scheduled' && <Badge variant="outline" className="text-gray-500">Past</Badge>}
                    </div>
                    <p className="text-sm text-gray-600">{meeting.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {meetingDate.toLocaleString()}
                      </div>
                      <div>{meeting.duration} minutes</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={meeting.status === 'scheduled' ? 'default' : 'secondary'}>
                      {meeting.status}
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        window.open(`/meeting/${meeting.id}?classId=${classId}`, '_blank')
                      }}
                    >
                      Join
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            router.push(`/classes/${classId}/meetings/${meeting.id}/recordings`)
                          }}
                        >
                          <Video className="w-4 h-4 mr-2" />
                          View Recordings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm({ meetingId: meeting.id, title: meeting.title })}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Meeting
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Delete Meeting
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteConfirm.title}"? This action cannot be undone.
                All meeting data, recordings, and participants will be permanently removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleDeleteMeeting(deleteConfirm.meetingId)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Meeting
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
} 