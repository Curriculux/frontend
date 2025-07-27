"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ploneAPI } from "@/lib/api"
import { Loader2, Target, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RubricCreationDialog } from "@/components/rubric-creation-dialog"
import { AssignmentRubric } from "@/types/gradebook"

interface CreateAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssignmentCreated: () => void
  classes: any[]
  defaultClassId?: string | null
}

export function CreateAssignmentDialog({ 
  open, 
  onOpenChange, 
  onAssignmentCreated,
  classes,
  defaultClassId
}: CreateAssignmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    classId: defaultClassId || "",
    dueDate: "",
    points: "",
    instructions: ""
  })
  const [assignmentRubric, setAssignmentRubric] = useState<AssignmentRubric | null>(null)
  const [rubricDialogOpen, setRubricDialogOpen] = useState(false)
  const { toast } = useToast()

  const handleRubricSaved = (rubric: AssignmentRubric) => {
    setAssignmentRubric(rubric)
    // If rubric has points, auto-populate assignment points
    if (!formData.points && rubric.totalPoints > 0) {
      setFormData(prev => ({ ...prev, points: rubric.totalPoints.toString() }))
    }
    toast({
      title: "Rubric Created",
      description: `"${rubric.title}" has been attached to this assignment`,
    })
  }

  const handleRemoveRubric = () => {
    setAssignmentRubric(null)
    toast({
      title: "Rubric Removed",
      description: "The rubric has been removed from this assignment",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.classId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    try {
      const assignment = await ploneAPI.createAssignment(formData.classId, {
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate || undefined,
        points: formData.points ? parseInt(formData.points) : undefined,
        instructions: formData.instructions
      })

      // If there's a rubric, associate it with the assignment
      if (assignmentRubric) {
        try {
          // Import gradebook API
          const { gradebookAPI } = await import('@/lib/gradebook-api')
          
          // Update rubric to reference this specific assignment
          const updatedRubric = {
            ...assignmentRubric,
            assignmentId: assignment.id,
            assignmentTitle: formData.title
          }
          await gradebookAPI.saveAssignmentRubric(formData.classId, updatedRubric)
          console.log('Rubric associated with assignment:', assignment.id)
        } catch (rubricError) {
          console.warn('Failed to associate rubric with assignment:', rubricError)
          // Don't fail assignment creation if rubric association fails
        }
      }
      
      toast({
        title: "Success!",
        description: `${formData.title} has been created successfully.${assignmentRubric ? ' Rubric has been attached.' : ''}`
      })
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        classId: defaultClassId || "",
        dueDate: "",
        points: "",
        instructions: ""
      })
      setAssignmentRubric(null)
      
      onOpenChange(false)
      onAssignmentCreated()
    } catch (error) {
      console.error("Failed to create assignment:", error)
      toast({
        title: "Error",
        description: "Failed to create assignment. Please try again.",
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

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Assignment</DialogTitle>
            <DialogDescription>
              Create an assignment for your students. You can add due dates, points, and detailed instructions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
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
            
            <div className="grid gap-2">
              <Label htmlFor="title">Assignment Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Chapter 5 Homework"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Brief Description</Label>
              <Input
                id="description"
                placeholder="Short summary of the assignment"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <DateTimePicker
                  value={formData.dueDate}
                  onChange={(value) => setFormData({ ...formData, dueDate: value })}
                  placeholder="Select due date and time"
                  disabled={loading}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  placeholder="100"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                  disabled={loading}
                  min="0"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="instructions">Detailed Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Provide detailed instructions for the assignment..."
                value={formData.instructions}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, instructions: e.target.value })}
                disabled={loading}
                rows={4}
              />
            </div>

            {/* Rubric Section */}
            <div className="grid gap-3">
              <Label>Assessment Rubric (Optional)</Label>
              {assignmentRubric ? (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-600" />
                        <CardTitle className="text-sm">{assignmentRubric.title}</CardTitle>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveRubric}
                        disabled={loading}
                      >
                        Remove
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{assignmentRubric.criteria.length} criteria</span>
                      <span>{assignmentRubric.totalPoints} total points</span>
                      <Badge variant="outline" className="text-xs">
                        {assignmentRubric.masteryThreshold}% mastery
                      </Badge>
                    </div>
                    {assignmentRubric.description && (
                      <p className="text-sm text-muted-foreground mt-2">{assignmentRubric.description}</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-6">
                    <Target className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center mb-3">
                      Add a rubric to provide detailed assessment criteria for this assignment
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setRubricDialogOpen(true)}
                      disabled={loading || !formData.classId}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Rubric
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Assignment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Rubric Creation Dialog */}
    {formData.classId && (
      <RubricCreationDialog
        open={rubricDialogOpen}
        onOpenChange={setRubricDialogOpen}
        classId={formData.classId}
        onRubricSaved={handleRubricSaved}
      />
    )}
  </>
  )
} 