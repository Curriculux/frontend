"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, UserPlus, Users, CheckCircle, AlertTriangle } from "lucide-react"
import { ploneAPI, PloneClass } from "@/lib/api"
import { StudentSelect } from "@/components/ui/student-select"
import { toast } from "sonner"

interface EnrollExistingStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentEnrolled?: (studentUsername: string, classId: string) => void
  defaultClassId?: string
  availableClasses?: PloneClass[]
}

export function EnrollExistingStudentDialog({
  open,
  onOpenChange,
  onStudentEnrolled,
  defaultClassId,
  availableClasses = []
}: EnrollExistingStudentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId || "")
  const [selectedStudentUsername, setSelectedStudentUsername] = useState("")
  const [classes, setClasses] = useState<PloneClass[]>(availableClasses)
  const [enrollmentResult, setEnrollmentResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  useEffect(() => {
    if (open) {
      loadClasses()
      resetForm()
    }
  }, [open])

  useEffect(() => {
    if (availableClasses.length > 0) {
      setClasses(availableClasses)
    }
  }, [availableClasses])

  const loadClasses = async () => {
    if (availableClasses.length > 0) return
    
    try {
      setLoading(true)
      const classesData = await ploneAPI.getClasses()
      setClasses(classesData)
    } catch (error) {
      console.error('Error loading classes:', error)
      toast.error('Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedStudentUsername("")
    setEnrollmentResult(null)
    setSelectedClassId(defaultClassId || "")
  }

  const handleEnrollStudent = async () => {
    if (!selectedStudentUsername || !selectedClassId) {
      toast.error('Please select both a student and a class')
      return
    }

    try {
      setEnrolling(true)
      setEnrollmentResult(null)

      await ploneAPI.enrollStudentInClass(selectedStudentUsername, selectedClassId)
      
      setEnrollmentResult({
        success: true,
        message: `Successfully enrolled student in the selected class`
      })

      toast.success(`Student has been enrolled in the class`)
      
      // Call the callback if provided
      onStudentEnrolled?.(selectedStudentUsername, selectedClassId)
      
      // Reset form for next enrollment
      setTimeout(() => {
        resetForm()
      }, 2000)

    } catch (error) {
      console.error('Error enrolling student:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to enroll student'
      
      setEnrollmentResult({
        success: false,
        message: errorMessage
      })
      
      toast.error(`Failed to enroll student: ${errorMessage}`)
    } finally {
      setEnrolling(false)
    }
  }

  const handleClose = () => {
    if (!enrolling) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Enroll Existing Student
          </DialogTitle>
          <DialogDescription>
            Select an existing student from the dropdown to enroll them into a class. The student must already have an account in the system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Class Selection */}
          <div className="space-y-2">
            <Label htmlFor="class">Target Class *</Label>
            <Select
              value={selectedClassId}
              onValueChange={setSelectedClassId}
              disabled={loading || enrolling}
            >
              <SelectTrigger id="class">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id!}>
                    {cls.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Selection */}
          <div className="space-y-2">
            <Label htmlFor="student">Select Student *</Label>
            <StudentSelect
              value={selectedStudentUsername}
              onValueChange={setSelectedStudentUsername}
              placeholder="Search and select a student..."
              disabled={enrolling}
            />
          </div>

          {/* Enrollment Result */}
          {enrollmentResult && (
            <Alert className={enrollmentResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              {enrollmentResult.success ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              <AlertDescription className={enrollmentResult.success ? "text-green-800" : "text-red-800"}>
                {enrollmentResult.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={enrolling}
            >
              {enrollmentResult?.success ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleEnrollStudent}
              disabled={!selectedStudentUsername || !selectedClassId || enrolling}
              className="min-w-[120px]"
            >
              {enrolling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Enrolling...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Enroll Student
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 