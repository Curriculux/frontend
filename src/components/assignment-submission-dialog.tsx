"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Upload,
  FileText,
  X,
  Send,
  Paperclip,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ploneAPI } from "@/lib/api"
import { getSecurityManager } from "@/lib/security"
import { toast } from "sonner"

interface AssignmentSubmissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment: {
    id: string
    title: string
    description: string
    classId: string
    dueDate?: string
    points?: number
    status?: string
  }
  onSubmissionComplete?: () => void
}

export function AssignmentSubmissionDialog({
  open,
  onOpenChange,
  assignment,
  onSubmissionComplete
}: AssignmentSubmissionDialogProps) {
  const [submissionText, setSubmissionText] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return

    const newFiles = Array.from(files)
    
    // Basic file validation
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif'
    ]

    const validFiles = newFiles.filter(file => {
      if (file.size > maxFileSize) {
        toast.error(`File ${file.name} is too large (max 10MB)`)
        return false
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type ${file.type} is not allowed`)
        return false
      }
      return true
    })

    setSelectedFiles(prev => [...prev, ...validFiles])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)

      const securityManager = getSecurityManager()
      const securityContext = securityManager.getSecurityContext()
      
      if (!securityContext || !securityContext.isStudent()) {
        toast.error('Access denied: Student role required')
        return
      }

      if (!submissionText.trim() && selectedFiles.length === 0) {
        toast.error('Please provide submission content or attach files')
        return
      }

      const studentId = securityContext.user.id || securityContext.user.username

      await ploneAPI.submitAssignment(assignment.classId, assignment.id, {
        studentId,
        content: submissionText,
        files: selectedFiles,
        submittedAt: new Date().toISOString()
      })

      toast.success('Assignment submitted successfully!')
      onSubmissionComplete?.()
      onOpenChange(false)
      
      // Reset form
      setSubmissionText("")
      setSelectedFiles([])
      
    } catch (error) {
      console.error('Submission error:', error)
      toast.error('Failed to submit assignment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date()
  const isAlreadySubmitted = assignment.status === 'submitted' || assignment.status === 'graded'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Submit Assignment
          </DialogTitle>
          <DialogDescription>
            Submit your work for "{assignment.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Assignment Details */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">{assignment.title}</h4>
            <p className="text-sm text-muted-foreground mb-3">{assignment.description}</p>
            
            <div className="flex items-center gap-4 text-sm">
              {assignment.dueDate && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">Due:</span>
                  <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                    {new Date(assignment.dueDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {assignment.points && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">Points:</span>
                  <span>{assignment.points}</span>
                </div>
              )}
              <Badge 
                variant={isOverdue ? "destructive" : "secondary"}
                className="ml-auto"
              >
                {isOverdue ? 'Overdue' : 'On Time'}
              </Badge>
            </div>
          </div>

          {/* Alerts */}
          {isOverdue && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This assignment is overdue. Check with your teacher about late submission policies.
              </AlertDescription>
            </Alert>
          )}

          {isAlreadySubmitted && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                You have already submitted this assignment. This will replace your previous submission.
              </AlertDescription>
            </Alert>
          )}

          {/* Submission Text */}
          <div className="space-y-2">
            <Label htmlFor="submission-text">Written Response</Label>
            <Textarea
              id="submission-text"
              placeholder="Type your submission here..."
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {submissionText.length} characters
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>File Attachments</Label>
            
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">
                Drop files here or click to select
              </p>
              <p className="text-xs text-gray-500">
                PDF, Word, Text, or Image files (max 10MB each)
              </p>
            </div>

            <input
              id="file-input"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
            />

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Selected Files ({selectedFiles.length})</Label>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium truncate">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(1)} MB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (!submissionText.trim() && selectedFiles.length === 0)}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Assignment
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 