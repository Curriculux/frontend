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
  CheckCircle,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Progress } from "@/components/ui/progress"
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

interface FileUploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
}

export function AssignmentSubmissionDialog({
  open,
  onOpenChange,
  assignment,
  onSubmissionComplete
}: AssignmentSubmissionDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileProgress, setFileProgress] = useState<FileUploadProgress[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)

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
    
    // Initialize progress tracking for new files
    const newProgress = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }))
    setFileProgress(prev => [...prev, ...newProgress])
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
    setFileProgress(prev => prev.filter((_, i) => i !== index))
  }

  const updateFileProgress = (index: number, progress: number, status: FileUploadProgress['status'], error?: string) => {
    setFileProgress(prev => prev.map((item, i) => 
      i === index ? { ...item, progress, status, error } : item
    ))
    
    // Update overall progress
    setFileProgress(current => {
      const totalProgress = current.reduce((sum, item) => sum + item.progress, 0)
      const avgProgress = current.length > 0 ? totalProgress / current.length : 0
      setOverallProgress(avgProgress)
      return current
    })
  }

  const simulateFileUpload = async (file: File, index: number): Promise<void> => {
    updateFileProgress(index, 0, 'uploading')
    
    // Simulate chunked upload progress
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 100))
      updateFileProgress(index, progress, 'uploading')
    }
    
    updateFileProgress(index, 100, 'complete')
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setOverallProgress(0)

      const securityManager = getSecurityManager()
      const securityContext = securityManager.getSecurityContext()
      
      if (!securityContext || !securityContext.isStudent()) {
        toast.error('Access denied: Student role required')
        return
      }

      if (!assignment.id || assignment.id === 'undefined' || assignment.id === 'null' || assignment.id === 'unknown') {
        toast.error('Cannot submit assignment: Invalid assignment identifier')
        return
      }

      if (!assignment.classId) {
        toast.error('Cannot submit assignment: Missing class information')
        return
      }

      const studentId = securityContext.user.id || securityContext.user.username

      // Simulate file upload progress
      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map((file, index) => 
          simulateFileUpload(file, index)
        )
        
        await Promise.all(uploadPromises)
      }

      if (selectedFiles.length === 0) {
        toast.error('Please select at least one file to submit')
        return
      }

      // Actually submit the assignment
      await ploneAPI.submitAssignment(assignment.classId, assignment.id, {
        studentId,
        content: '', // This dialog only handles file submissions
        files: selectedFiles,
        submittedAt: new Date().toISOString()
      })

      toast.success('Assignment submitted successfully!')
      onSubmissionComplete?.()
      onOpenChange(false)
      
      // Reset form
      setSelectedFiles([])
      setFileProgress([])
      setOverallProgress(0)
      
    } catch (error) {
      console.error('Submission error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit assignment. Please try again.'
      toast.error(errorMessage)
      
      // Mark all files as error
      setFileProgress(prev => prev.map(item => ({
        ...item,
        status: 'error' as const,
        error: 'Upload failed'
      })))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date()
  const isAlreadySubmitted = assignment.status === 'submitted' || assignment.status === 'graded'
  const hasFilesUploading = fileProgress.some(fp => fp.status === 'uploading')

  const getFileStatusIcon = (status: FileUploadProgress['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Paperclip className="h-4 w-4 text-gray-500" />
    }
  }

  const getFileStatusColor = (status: FileUploadProgress['status']) => {
    switch (status) {
      case 'complete':
        return 'bg-green-50 border-green-200'
      case 'uploading':
        return 'bg-blue-50 border-blue-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-white border-gray-200'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Upload className="h-5 w-5" />
            Submit Assignment
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Upload your files for "{assignment.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Assignment Details */}
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h4 className="font-semibold mb-2 text-gray-900">{assignment.title}</h4>
            <p className="text-sm text-gray-700 mb-3">{assignment.description}</p>
            
            <div className="flex items-center gap-4 text-sm">
              {assignment.dueDate && (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">Due:</span>
                  <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}>
                    {new Date(assignment.dueDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {assignment.points && (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">Points:</span>
                  <span className="text-gray-700">{assignment.points}</span>
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
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                This assignment is overdue. Check with your teacher about late submission policies.
              </AlertDescription>
            </Alert>
          )}

          {isAlreadySubmitted && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                You have already submitted this assignment. This will replace your previous submission.
              </AlertDescription>
            </Alert>
          )}

          {/* Overall Progress */}
          {(isSubmitting || hasFilesUploading) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Upload Progress</span>
                <span className="text-gray-700">{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          {/* File Upload */}
          <div className="space-y-4">
            <Label className="text-base font-medium text-gray-900">Upload Assignment Files</Label>
            
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              } ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !isSubmitting && document.getElementById('file-input')?.click()}
            >
              <Upload className="h-8 w-8 text-gray-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-700 mb-2">
                Drop files here or click to select
              </p>
              <p className="text-sm text-gray-600 mb-3">
                Upload your completed assignment files
              </p>
              <p className="text-xs text-gray-500">
                Supported: PDF, Word, Text, and Image files (max 10MB each)
              </p>
            </div>

            <input
              id="file-input"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
              disabled={isSubmitting}
            />

            {/* Selected Files with Progress */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                <Label className="text-sm font-medium text-gray-900">
                  Selected Files ({selectedFiles.length})
                </Label>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => {
                    const progress = fileProgress[index]
                    // Truncate filename if too long
                    const truncateFilename = (filename: string, maxLength: number = 40) => {
                      if (filename.length <= maxLength) return filename
                      const extension = filename.split('.').pop()
                      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'))
                      const truncatedName = nameWithoutExt.substring(0, maxLength - extension!.length - 4) + '...'
                      return `${truncatedName}.${extension}`
                    }
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center justify-between p-3 rounded border ${
                          progress ? getFileStatusColor(progress.status) : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getFileStatusIcon(progress?.status || 'pending')}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                              {truncateFilename(file.name)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {(file.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                            {progress?.status === 'uploading' && (
                              <div className="mt-1">
                                <Progress value={progress.progress} className="h-1" />
                                <p className="text-xs text-gray-600 mt-1">
                                  {progress.progress}% uploaded
                                </p>
                              </div>
                            )}
                            {progress?.error && (
                              <p className="text-xs text-red-600 mt-1">
                                {progress.error}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2 flex-shrink-0"
                          disabled={isSubmitting}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedFiles.length === 0}
              className="flex-1"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {hasFilesUploading ? 'Uploading...' : 'Submitting...'}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Assignment ({selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'})
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 