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
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DateTimePicker } from "@/components/ui/date-time-picker"

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
  const { toast } = useToast()

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
      await ploneAPI.createAssignment(formData.classId, {
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate || undefined,
        points: formData.points ? parseInt(formData.points) : undefined,
        instructions: formData.instructions
      })
      
      toast({
        title: "Success!",
        description: `${formData.title} has been created successfully.`
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
  )
} 