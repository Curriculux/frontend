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
import { ploneAPI } from "@/lib/api"
import { BookOpen, Edit, Trash2, Save, X, Users, FileText, Calendar, GraduationCap, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PloneClass {
  '@id': string;
  id: string;
  title: string;
  description: string;
  originalDescription?: string;
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

const subjects = [
  "Mathematics",
  "Science", 
  "English Language Arts",
  "Social Studies",
  "Computer Science",
  "Art",
  "Music",
  "Physical Education",
  "Foreign Language",
  "Other"
]

const gradeLevels = [
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade"
]

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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    gradeLevel: "",
    schedule: ""
  })
  const { toast } = useToast()

  // Load assignments for this class
  const loadAssignments = async () => {
    if (!classData?.id) return
    
    setAssignmentsLoading(true)
    try {
      const assignmentsData = await ploneAPI.getAssignments(classData.id)
      setAssignments(assignmentsData)
    } catch (error) {
      console.error('Failed to load assignments:', error)
    } finally {
      setAssignmentsLoading(false)
    }
  }

  // Update form when class changes
  useEffect(() => {
    if (classData) {
      // Parse metadata from original description (or fallback to description)
      const descriptionWithMetadata = classData.originalDescription || classData.description || ''
      const metadata = ploneAPI.parseClassMetadata(descriptionWithMetadata)
      const cleanDescription = descriptionWithMetadata.replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim()

      setFormData({
        title: classData.title || "",
        description: cleanDescription || "",
        subject: metadata.subject || "",
        gradeLevel: metadata.gradeLevel || "",
        schedule: metadata.schedule || ""
      })
      setIsEditing(false)
      setDeleteConfirm(false)
      
      // Load assignments when class changes
      loadAssignments()
    }
  }, [classData])

  const handleSave = async () => {
    if (!classData) return

    setLoading(true)
    try {
      await ploneAPI.updateClass(classData.id, {
        title: formData.title,
        description: formData.description,
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

  const getSubjectColor = (subject: string) => {
    const colorMap: { [key: string]: string } = {
      "Mathematics": "bg-blue-100 text-blue-800",
      "Science": "bg-green-100 text-green-800",
      "English Language Arts": "bg-purple-100 text-purple-800",
      "Social Studies": "bg-orange-100 text-orange-800",
      "Computer Science": "bg-cyan-100 text-cyan-800",
      "Art": "bg-pink-100 text-pink-800",
      "Music": "bg-violet-100 text-violet-800",
      "Physical Education": "bg-yellow-100 text-yellow-800",
      "Foreign Language": "bg-indigo-100 text-indigo-800",
    }
    return colorMap[subject] || "bg-gray-100 text-gray-800"
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
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(true)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 min-h-[400px]">
              {isEditing ? (
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
                          {subjects.map((subject) => (
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
                          {gradeLevels.map((grade) => (
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

                  {/* Required Fields */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="text-sm font-medium text-slate-700 block mb-2">Subject</Label>
                      {formData.subject ? (
                        <div>
                          <Badge className={`${getSubjectColor(formData.subject)}`}>
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

            <TabsContent value="students" className="min-h-[400px]">
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Student Management Coming Soon</h3>
                  <p className="text-sm text-gray-600">
                    Student enrollment and management features will be available here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

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
    </Dialog>
  )
} 