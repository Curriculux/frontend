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
import { ploneAPI } from "@/lib/api"
import { Calendar, Clock, Edit, Trash2, Save, X, FileText, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DateTimePicker } from "@/components/ui/date-time-picker"

interface Assignment {
  '@id': string;
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  points?: number;
  classId: string;
  created: string;
  modified: string;
  instructions?: string;
}

interface AssignmentDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment: Assignment | null
  onAssignmentUpdated: () => void
  onAssignmentDeleted: () => void
}

export function AssignmentDetailsModal({ 
  open, 
  onOpenChange, 
  assignment,
  onAssignmentUpdated,
  onAssignmentDeleted
}: AssignmentDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    points: "",
    instructions: ""
  })
  const { toast } = useToast()

  // Update form when assignment changes
  useEffect(() => {
    if (assignment) {
      setFormData({
        title: assignment.title || "",
        description: assignment.description || "",
        dueDate: assignment.dueDate || "",
        points: assignment.points?.toString() || "",
        instructions: assignment.instructions || ""
      })
      setIsEditing(false)
      setDeleteConfirm(false)
    }
  }, [assignment])

  const handleSave = async () => {
    if (!assignment) return

    setLoading(true)
    try {
      await ploneAPI.updateAssignment(assignment.classId, assignment.id, {
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate || undefined,
        points: formData.points ? parseInt(formData.points) : undefined,
        instructions: formData.instructions
      })
      
      toast({
        title: "Success!",
        description: "Assignment updated successfully."
      })
      
      setIsEditing(false)
      onAssignmentUpdated()
    } catch (error) {
      console.error("Failed to update assignment:", error)
      toast({
        title: "Error",
        description: "Failed to update assignment. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!assignment) return

    setLoading(true)
    try {
      await ploneAPI.deleteAssignment(assignment.classId, assignment.id)
      
      toast({
        title: "Success!",
        description: "Assignment deleted successfully."
      })
      
      onOpenChange(false)
      onAssignmentDeleted()
    } catch (error) {
      console.error("Failed to delete assignment:", error)
      toast({
        title: "Error",
        description: "Failed to delete assignment. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getDueDateStatus = (dueDate?: string) => {
    if (!dueDate) return null
    
    const due = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { text: "Overdue", color: "destructive" }
    if (diffDays === 0) return { text: "Due Today", color: "warning" }
    if (diffDays === 1) return { text: "Due Tomorrow", color: "warning" }
    if (diffDays <= 7) return { text: `Due in ${diffDays} days`, color: "default" }
    return { text: `Due ${due.toLocaleDateString()}`, color: "secondary" }
  }

  if (!assignment) return null

  const dueDateStatus = getDueDateStatus(assignment.dueDate)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl">
                <span className="truncate">{isEditing ? "Edit Assignment" : assignment.title}</span>
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isEditing ? "Update assignment details" : assignment.description}
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
              <h4 className="font-semibold text-red-800 mb-2">Delete Assignment</h4>
              <p className="text-sm text-red-700 mb-4">
                Are you sure you want to delete "{assignment.title}"? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Yes, Delete
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title">Assignment Title</Label>
                    <Input
                      id="edit-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Input
                      id="edit-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-dueDate">Due Date</Label>
                      <DateTimePicker
                        value={formData.dueDate}
                        onChange={(value) => setFormData({ ...formData, dueDate: value })}
                        placeholder="Select due date and time"
                        disabled={loading}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="edit-points">Points</Label>
                      <Input
                        id="edit-points"
                        type="number"
                        value={formData.points}
                        onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                        disabled={loading}
                        min="0"
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="edit-instructions">Instructions</Label>
                    <Textarea
                      id="edit-instructions"
                      value={formData.instructions}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, instructions: e.target.value })}
                      disabled={loading}
                      rows={4}
                      placeholder="Detailed instructions for students..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Assignment Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">Due Date</span>
                        </div>
                        {assignment.dueDate ? (
                          <div className="space-y-1">
                            <p className="text-sm">
                              {new Date(assignment.dueDate).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </p>
                            {dueDateStatus && (
                              <Badge variant={dueDateStatus.color as any}>
                                {dueDateStatus.text}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No due date set</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          <span className="font-medium">Points</span>
                        </div>
                        <p className="text-sm">
                          {assignment.points ? `${assignment.points} points` : "No points assigned"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Instructions */}
                  {assignment.instructions && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Instructions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap">{assignment.instructions}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Metadata */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Created:</span> {new Date(assignment.created).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">Last Modified:</span> {new Date(assignment.modified).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="submissions">
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Submissions Coming Soon</h3>
                  <p className="text-sm text-gray-600">
                    Student submission tracking and grading will be available here.
                  </p>
                </CardContent>
              </Card>
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
                setFormData({
                  title: assignment.title || "",
                  description: assignment.description || "",
                  dueDate: assignment.dueDate || "",
                  points: assignment.points?.toString() || "",
                  instructions: assignment.instructions || ""
                })
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