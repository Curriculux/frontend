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
import { Loader2, Settings, Plus, BookOpen, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { TeacherSelect } from "@/components/ui/teacher-select"
import { CreateTeacherDialog } from "@/components/create-teacher-dialog"
import { gradebookAPI } from "@/lib/gradebook-api"
import { WeightedCategory } from "@/types/gradebook"

interface CreateClassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClassCreated: () => void
}

export function CreateClassDialog({ open, onOpenChange, onClassCreated }: CreateClassDialogProps) {
  const [loading, setLoading] = useState(false)
  const [createTeacherDialogOpen, setCreateTeacherDialogOpen] = useState(false)
  const [teacherRefreshTrigger, setTeacherRefreshTrigger] = useState(0)
  const [step, setStep] = useState<'basic' | 'categories'>('basic')
  const [createdClassId, setCreatedClassId] = useState<string | null>(null)
  const [gradeCategories, setGradeCategories] = useState<any[]>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    teacher: "",
    subject: "",
    gradeLevel: "",
    schedule: ""
  })
  const { toast } = useToast()

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.teacher || !formData.subject || !formData.gradeLevel) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (Title, Teacher, Subject, and Grade Level)",
        variant: "destructive"
      })
      return
    }

    // Just move to the next step - don't create the class yet
    setStep('categories')
    
    toast({
      title: "Basic Information Saved",
      description: "Now set up grade categories for your class."
    })
  }

  const handleCategoriesComplete = async () => {
    setLoading(true)
    
    try {
      // First validate that categories have been set up with total weight = 100%
      const totalWeight = gradeCategories.reduce((sum, cat) => sum + cat.weight, 0)
      
      if (gradeCategories.length === 0) {
        toast({
          title: "Categories Required",
          description: "Please add at least one grade category before completing class setup.",
          variant: "destructive"
        })
        return
      }
      
      if (totalWeight !== 100) {
        toast({
          title: "Weight Distribution Error",
          description: `Category weights must total 100%. Current total: ${totalWeight}%`,
          variant: "destructive"
        })
        return
      }
      
      // Create the class
      const newClass = await ploneAPI.createClass(formData)
      setCreatedClassId(newClass.id)
      
      // Save the grade settings to the real class
      try {
        const gradebookSettings = {
          classId: newClass.id,
          categories: gradeCategories.map(cat => ({
            id: cat.name.toLowerCase().replace(/\s+/g, '-'),
            name: cat.name,
            weight: cat.weight,
            color: cat.color || '#3b82f6',
            dropLowest: 0,
            icon: '📚' // Default icon
          })),
          gradingScale: {
            id: 'standard',
            name: 'Standard',
            ranges: [
              { min: 97, max: 100, letter: 'A+', gpa: 4.0, color: '#16a34a' },
              { min: 93, max: 96, letter: 'A', gpa: 4.0, color: '#22c55e' },
              { min: 90, max: 92, letter: 'A-', gpa: 3.7, color: '#65a30d' },
              { min: 87, max: 89, letter: 'B+', gpa: 3.3, color: '#84cc16' },
              { min: 83, max: 86, letter: 'B', gpa: 3.0, color: '#eab308' },
              { min: 80, max: 82, letter: 'B-', gpa: 2.7, color: '#f59e0b' },
              { min: 77, max: 79, letter: 'C+', gpa: 2.3, color: '#f97316' },
              { min: 73, max: 76, letter: 'C', gpa: 2.0, color: '#ea580c' },
              { min: 70, max: 72, letter: 'C-', gpa: 1.7, color: '#dc2626' },
              { min: 67, max: 69, letter: 'D+', gpa: 1.3, color: '#b91c1c' },
              { min: 65, max: 66, letter: 'D', gpa: 1.0, color: '#991b1b' },
              { min: 0, max: 64, letter: 'F', gpa: 0.0, color: '#7f1d1d' }
            ]
          },
          allowLateSubmissions: true,
          latePenalty: 10,
          maxLateDays: 7,
          roundingMethod: 'round' as const,
          showStudentGrades: true,
          parentNotifications: false
        }
        await gradebookAPI.saveGradebookSettings(gradebookSettings)
        console.log('Grade settings saved successfully')
      } catch (settingsError) {
        console.warn('Could not save grade settings:', settingsError)
        // Don't fail the whole process if settings save fails
      }

      toast({
        title: "Class Setup Complete!",
        description: `${formData.title} has been created and is ready for students and assignments.`
      })
      
      // Reset form and close
      setFormData({
        title: "",
        description: "",
        teacher: "",
        subject: "",
        gradeLevel: "",
        schedule: ""
      })
      setStep('basic')
      setCreatedClassId(null)
      setGradeCategories([])
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

  const handleClose = () => {
    if (step === 'categories' && createdClassId) {
      // If user tries to close during categories step, warn them
      toast({
        title: "Setup Incomplete",
        description: "Please complete grade category setup or go back to cancel class creation.",
        variant: "destructive"
      })
      return
    }
    
    // Reset everything
    setFormData({
      title: "",
      description: "",
      teacher: "",
      subject: "",
      gradeLevel: "",
      schedule: ""
    })
    setStep('basic')
    setCreatedClassId(null)
    setGradeCategories([])
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          {step === 'basic' ? (
            <form onSubmit={handleBasicInfoSubmit}>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
                <DialogDescription>
                  Step 1: Set up basic class information. You'll configure grade categories next.
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
                  <TeacherSelect
                    value={formData.teacher}
                    onValueChange={(value) => setFormData({ ...formData, teacher: value })}
                    placeholder="Search and select a teacher..."
                    disabled={loading}
                    allowCreateNew={true}
                    onCreateNew={() => setCreateTeacherDialogOpen(true)}
                    refreshTrigger={teacherRefreshTrigger}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Select
                      value={formData.subject}
                      onValueChange={(value) => setFormData({ ...formData, subject: value })}
                      disabled={loading}
                    >
                      <SelectTrigger id="subject">
                        <SelectValue placeholder="Select subject" />
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
                      onValueChange={(value) => setFormData({ ...formData, gradeLevel: value })}
                      disabled={loading}
                    >
                      <SelectTrigger id="gradeLevel">
                        <SelectValue placeholder="Select grade" />
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
                  <Label htmlFor="schedule">Schedule (Optional)</Label>
                  <Input
                    id="schedule"
                    placeholder="e.g., Mon/Wed/Fri 9:00-10:30 AM"
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
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Class...
                    </>
                  ) : (
                    "Next: Setup Categories"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div>
              <DialogHeader>
                <DialogTitle>Setup Grade Categories</DialogTitle>
                <DialogDescription>
                  Step 2: Configure weighted grade categories for {formData.title}. Categories must total 100%.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-6 space-y-4">
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Grade Categories Setup</h4>
                  <p className="text-sm text-blue-700">
                    Set up weighted categories like Homework (20%), Tests (50%), Projects (30%), etc. 
                    The total must equal exactly 100%.
                  </p>
                </div>
                
                {/* Embedded Grade Categories Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Grade Categories</h4>
                    <Button 
                      type="button"
                      size="sm"
                      onClick={() => setGradeCategories([...gradeCategories, { name: '', weight: 0, color: '#3b82f6' }])}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Category
                    </Button>
                  </div>
                  
                  {gradeCategories.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No categories yet. Add some grade categories to get started.</p>
                    </div>
                  )}
                  
                  {gradeCategories.map((category, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <Input
                        placeholder="Category name (e.g., Homework)"
                        value={category.name}
                        onChange={(e) => {
                          const updated = [...gradeCategories]
                          updated[index].name = e.target.value
                          setGradeCategories(updated)
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Weight %"
                        value={category.weight}
                        onChange={(e) => {
                          const updated = [...gradeCategories]
                          updated[index].weight = parseInt(e.target.value) || 0
                          setGradeCategories(updated)
                        }}
                        className="w-20"
                        min="0"
                        max="100"
                      />
                      <span className="text-sm text-gray-500">%</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = gradeCategories.filter((_, i) => i !== index)
                          setGradeCategories(updated)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {gradeCategories.length > 0 && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Total Weight:</span>
                        <span className={`font-medium ${gradeCategories.reduce((sum, cat) => sum + cat.weight, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {gradeCategories.reduce((sum, cat) => sum + cat.weight, 0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep('basic')}
                >
                  Back
                </Button>
                <Button onClick={handleCategoriesComplete}>
                  Complete Class Setup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Teacher Dialog */}
      <CreateTeacherDialog
        open={createTeacherDialogOpen}
        onOpenChange={setCreateTeacherDialogOpen}
        onTeacherCreated={(teacher) => {
          // Set the newly created teacher as selected
          setFormData({ ...formData, teacher: teacher.fullname })
          // Refresh the teacher list
          setTeacherRefreshTrigger(prev => prev + 1)
          toast({
            title: "Teacher Created",
            description: `${teacher.fullname} has been created and selected for this class.`
          })
        }}
      />

      {/* Grade Categories are now embedded in the second step */}
    </>
  )
} 