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
import { GRADE_LEVELS, SUBJECTS } from "@/lib/constants"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CreateClassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClassCreated: () => void
}

export function CreateClassDialog({ open, onOpenChange, onClassCreated }: CreateClassDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    teacher: "",
    subject: "",
    gradeLevel: "",
    schedule: ""
  })
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
      await ploneAPI.createClass(formData)
      
      toast({
        title: "Success!",
        description: `${formData.title} has been created successfully.`
      })
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        teacher: "",
        subject: "",
        gradeLevel: "",
        schedule: ""
      })
      
      onOpenChange(false)
      onClassCreated()
    } catch (error) {
      console.error("Failed to create class:", error)
      toast({
        title: "Error",
        description: "Failed to create class. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
            <DialogDescription>
              Set up a new class for your students. You can add students and assignments after creation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Class Name *</Label>
              <Input
                id="title"
                placeholder="e.g., Algebra I - Period 3"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="teacher">Teacher *</Label>
              <Input
                id="teacher"
                placeholder="e.g., Ms. Smith"
                value={formData.teacher}
                onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject *</Label>
              <Select
                value={formData.subject}
                onValueChange={(value: string) => setFormData({ ...formData, subject: value })}
                disabled={loading}
              >
                <SelectTrigger id="subject">
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
              <Label htmlFor="gradeLevel">Grade Level *</Label>
              <Select
                value={formData.gradeLevel}
                onValueChange={(value: string) => setFormData({ ...formData, gradeLevel: value })}
                disabled={loading}
              >
                <SelectTrigger id="gradeLevel">
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
            
            <div className="grid gap-2">
              <Label htmlFor="schedule">Schedule (Optional)</Label>
              <Input
                id="schedule"
                placeholder="e.g., MWF 9:00-10:15 AM"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the class..."
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
                rows={3}
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
                "Create Class"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 