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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ploneAPI } from "@/lib/api"
import { Calendar, Clock, Edit, Trash2, Save, X, FileText, Users, Download, MessageSquare, Star, Eye, Image, FileImage, File } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { toast } from "sonner"

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

interface Submission {
  id: string
  studentId: string
  studentName?: string
  submittedAt: string
  content?: any
  attachments: any[]
  feedback?: any[]
  grade?: number
  gradedAt?: string
  status: 'submitted' | 'graded' | 'late'
}

// Submissions Tab Component
function SubmissionsTab({ assignment }: { assignment: Assignment }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<{ [key: string]: any }>({})
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null)
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' })
  const [previewFile, setPreviewFile] = useState<any>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (assignment) {
      loadSubmissions()
    }
  }, [assignment])

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      
      // Get all submissions for this assignment
      const submissionsData = await ploneAPI.getAllSubmissionsForAssignment(assignment.classId, assignment.id)
      
      // Get class students to map student IDs to names
      const classStudents = await ploneAPI.getStudents(assignment.classId)
      const studentsMap: { [key: string]: any } = {}
      classStudents.forEach((student: any) => {
        // Try multiple ways to get the student ID
        const studentId = student.id || student['@id']?.split('/').pop() || student.title?.toLowerCase().replace(/\s+/g, '')
        if (studentId) {
          studentsMap[studentId] = student
        }
        // Also map by title/name in case ID extraction fails
        if (student.title) {
          studentsMap[student.title.toLowerCase().replace(/\s+/g, '')] = student
        }
      })
      setStudents(studentsMap)
      
      console.log('Students map:', studentsMap)
      console.log('Submissions data:', submissionsData)
      
      // Process submissions and add student information
      const processedSubmissions: Submission[] = submissionsData.map((submission: any) => {
        const studentId = submission.studentId
        
        // Try multiple ways to find the student
        let student = studentsMap[studentId];
        if (!student) {
          student = studentsMap[studentId?.toLowerCase()];
        }
        if (!student) {
          student = studentsMap[studentId?.toLowerCase().replace(/\s+/g, '')];
        }
        
        // Try to match by partial name
        if (!student && studentId) {
          const studentKeys = Object.keys(studentsMap);
          const matchingKey = studentKeys.find(key => 
            key.includes(studentId.toLowerCase()) || studentId.toLowerCase().includes(key)
          );
          if (matchingKey) {
            student = studentsMap[matchingKey];
          }
        }
        
        console.log(`Processing submission for studentId: "${studentId}", found student:`, student)
        
        // Extract more readable name
        let studentName = `Student ${studentId}`;
        if (student) {
          studentName = student.title || student.name;
        } else {
          // Try to make the ID more readable
          if (studentId) {
            studentName = studentId.charAt(0).toUpperCase() + studentId.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');
          }
        }
        
        return {
          id: submission.id,
          studentId: studentId,
          studentName: studentName,
          submittedAt: submission.submittedAt || submission.created,
          content: submission.content,
          attachments: submission.attachments || [],
          feedback: submission.feedback || [],
          grade: submission.grade,
          gradedAt: submission.gradedAt,
          status: submission.grade !== undefined ? 'graded' : 'submitted'
        }
      })
      
      setSubmissions(processedSubmissions)
    } catch (error) {
      console.error('Error loading submissions:', error)
      toast.error('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getSubmissionStatus = (submission: Submission) => {
    if (submission.status === 'graded') {
      return { text: 'Graded', color: 'bg-blue-100 text-blue-800' }
    }
    
    // Check if late
    if (assignment.dueDate) {
      const dueDate = new Date(assignment.dueDate)
      const submittedDate = new Date(submission.submittedAt)
      if (submittedDate > dueDate) {
        return { text: 'Late', color: 'bg-red-100 text-red-800' }
      }
    }
    
    return { text: 'Submitted', color: 'bg-green-100 text-green-800' }
  }

  const handleGradeSubmission = (submission: Submission) => {
    setGradingSubmission(submission)
    setGradeForm({
      grade: submission.grade?.toString() || '',
      feedback: submission.feedback?.[0]?.description || ''
    })
  }

  const submitGrade = async () => {
    if (!gradingSubmission || !gradeForm.grade) {
      toast.error('Please enter a grade')
      return
    }

    try {
      await ploneAPI.updateSubmissionGrade(
        assignment.classId,
        assignment.id,
        gradingSubmission.id,
        {
          grade: parseInt(gradeForm.grade),
          feedback: gradeForm.feedback,
          gradedAt: new Date().toISOString()
        }
      )
      
      toast.success('Grade submitted successfully!')
      setGradingSubmission(null)
      setGradeForm({ grade: '', feedback: '' })
      loadSubmissions() // Reload to show updated grade
    } catch (error) {
      console.error('Error submitting grade:', error)
      toast.error('Failed to submit grade')
    }
  }

  const getFileType = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop() || ''
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
      return 'image'
    } else if (['pdf'].includes(ext)) {
      return 'pdf'
    } else if (['txt', 'md', 'csv', 'log', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h'].includes(ext)) {
      return 'text'
    } else if (['doc', 'docx', 'rtf'].includes(ext)) {
      return 'document'
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return 'spreadsheet'
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      return 'video'
    } else if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
      return 'audio'
    }
    return 'other'
  }

  const getFileIcon = (filename: string) => {
    const type = getFileType(filename)
    switch (type) {
      case 'image': return <FileImage className="w-4 h-4" />
      case 'pdf': return <FileText className="w-4 h-4 text-red-500" />
      case 'text': return <FileText className="w-4 h-4 text-blue-500" />
      case 'document': return <FileText className="w-4 h-4 text-blue-600" />
      case 'spreadsheet': return <FileText className="w-4 h-4 text-green-600" />
      default: return <File className="w-4 h-4" />
    }
  }

  const canPreview = (filename: string) => {
    const type = getFileType(filename)
    return ['image', 'pdf', 'text'].includes(type)
  }

  const downloadFile = async (file: any) => {
    try {
      console.log('Downloading file:', file)
      
      let downloadUrl: string
      
      if (file.isS3 || file.storageType === 's3') {
        // For S3 files, get a presigned URL
        if (file.s3Key) {
          try {
            downloadUrl = await ploneAPI.getSecureFileUrl(file.s3Key, 300) // 5 minutes
          } catch (error) {
            console.error('Failed to get presigned URL, using direct URL:', error)
            downloadUrl = file.s3Url || file.url
          }
        } else {
          downloadUrl = file.s3Url || file.url
        }
      } else {
        // For Plone files, use the download endpoint
        const fileUrl = file['@id'] || file.url
        if (!fileUrl) {
          toast.error('File URL not available')
          return
        }

        if (fileUrl.includes('/api/plone')) {
          downloadUrl = fileUrl.replace('/api/plone', '') + '/@@download/file'
        } else if (!fileUrl.startsWith('http')) {
          downloadUrl = `http://127.0.0.1:8080/Plone${fileUrl}/@@download/file`
        } else {
          downloadUrl = fileUrl
        }
      }

      // Create a temporary link to trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = file.title || file.filename || file.id || 'download'
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`Downloading ${file.title || file.filename || file.id}`)
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download file')
    }
  }

  const previewFileContent = async (file: any) => {
    if (!canPreview(file.title || file.filename || file.id)) {
      toast.error('File type not supported for preview')
      return
    }

    setPreviewFile(file)
    setPreviewLoading(true)
    setPreviewContent(null)

    try {
      const type = getFileType(file.title || file.filename || file.id)
      let contentUrl: string
      
      if (file.isS3 || file.storageType === 's3') {
        // For S3 files, get a presigned URL
        if (file.s3Key) {
          try {
            contentUrl = await ploneAPI.getSecureFileUrl(file.s3Key, 300) // 5 minutes
          } catch (error) {
            console.error('Failed to get presigned URL, using direct URL:', error)
            contentUrl = file.s3Url || file.url
          }
        } else {
          contentUrl = file.s3Url || file.url
        }
      } else {
        // For Plone files, use the download endpoint
        const fileUrl = file['@id'] || file.url
        
        if (!fileUrl) {
          throw new Error('File URL not available')
        }

        if (fileUrl.includes('/api/plone')) {
          contentUrl = fileUrl.replace('/api/plone', '') + '/@@download/file'
        } else if (!fileUrl.startsWith('http')) {
          contentUrl = `http://127.0.0.1:8080/Plone${fileUrl}/@@download/file`
        } else {
          contentUrl = fileUrl
        }
      }

      if (type === 'text') {
        // For text files, fetch the content directly
        const response = await fetch(contentUrl)
        if (response.ok) {
          const content = await response.text()
          setPreviewContent(content)
        } else {
          throw new Error('Failed to load file content')
        }
      } else if (type === 'image' || type === 'pdf') {
        // For images and PDFs, use the URL for display
        setPreviewContent(contentUrl)
      }
    } catch (error) {
      console.error('Error loading file preview:', error)
      toast.error('Failed to load file preview')
      setPreviewFile(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">No Submissions Yet</h3>
          <p className="text-sm text-gray-600">
            Students haven't submitted their work for this assignment yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Student Submissions ({submissions.length})</h3>
        <Button variant="outline" size="sm" onClick={loadSubmissions}>
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {submissions.map((submission, index) => {
          const statusInfo = getSubmissionStatus(submission)
          
          return (
            <Card key={submission.id || `submission-${index}`} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-slate-200">
                        {submission.studentName?.split(' ').map(n => n[0]).join('') || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-slate-900">{submission.studentName}</h4>
                        <Badge className={statusInfo.color}>
                          {statusInfo.text}
                        </Badge>
                        {submission.grade !== undefined && (
                          <Badge variant="outline">
                            {submission.grade}%
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            Submitted {new Date(submission.submittedAt).toLocaleDateString()} at{' '}
                            {new Date(submission.submittedAt).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        
                        {submission.attachments.length > 0 && (
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{submission.attachments.length} file{submission.attachments.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>

                      {/* Attachments */}
                      {submission.attachments && submission.attachments.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-700">
                              Submitted Files ({submission.attachments.length})
                            </p>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  // Download all files (could be implemented later)
                                  submission.attachments.forEach((file: any) => downloadFile(file))
                                }}
                                className="text-xs"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                All
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {submission.attachments.map((file: any, fileIndex: number) => (
                              <div key={file.id || file.title || `file-${fileIndex}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                                <div className="flex-shrink-0">
                                  {getFileIcon(file.title || file.filename || file.id)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {file.title || file.filename || file.id}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {file.size && (
                                      <span className="text-xs text-slate-500">
                                        {formatFileSize(file.size)}
                                      </span>
                                    )}
                                    <span className="text-xs text-slate-500">
                                      {getFileType(file.title || file.filename || file.id).toUpperCase()}
                                    </span>
                                    {(file.isS3 || file.storageType === 's3') && (
                                      <span className="text-xs text-blue-600 font-medium">S3</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  {canPreview(file.title || file.filename || file.id) && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                      onClick={() => previewFileContent(file)}
                                      title="Preview file"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
                                    onClick={() => downloadFile(file)}
                                    title="Download file"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      


                      {/* Content Preview */}
                      {submission.content?.description && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-slate-700 mb-1">Submission Content:</p>
                          <div className="p-3 bg-slate-50 rounded-md">
                            <p className="text-sm text-slate-800 whitespace-pre-wrap">
                              {submission.content.description.slice(0, 200)}
                              {submission.content.description.length > 200 && '...'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Feedback */}
                      {submission.feedback && submission.feedback.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-md">
                          <p className="text-sm font-medium text-blue-900 mb-1">Teacher Feedback:</p>
                          <p className="text-sm text-blue-800">
                            {submission.feedback[0]?.description || 'Feedback available'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleGradeSubmission(submission)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      {submission.grade !== undefined ? 'Update Grade' : 'Grade'}
                    </Button>
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Grading Dialog */}
      {gradingSubmission && (
        <Card className="mt-4 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg text-blue-900">
              Grade Submission - {gradingSubmission.studentName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="grade">Grade (0-100)</Label>
                <Input
                  id="grade"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Enter grade"
                  value={gradeForm.grade}
                  onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="feedback">Feedback</Label>
                <Textarea
                  id="feedback"
                  placeholder="Optional feedback for student"
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={submitGrade}>
                Submit Grade
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setGradingSubmission(null)
                  setGradeForm({ grade: '', feedback: '' })
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getFileIcon(previewFile.title || previewFile.filename || previewFile.id)}
                {previewFile.title || previewFile.filename || previewFile.id}
              </DialogTitle>
              <DialogDescription>
                File preview for submission
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                  <span className="ml-2">Loading preview...</span>
                </div>
              ) : (
                <div className="w-full h-full">
                  {(() => {
                    const type = getFileType(previewFile.title || previewFile.filename || previewFile.id)
                    
                    if (type === 'image' && previewContent) {
                      return (
                        <div className="flex justify-center">
                          <img 
                            src={previewContent} 
                            alt={previewFile.title || previewFile.filename || previewFile.id}
                            className="max-w-full max-h-[60vh] object-contain rounded-lg"
                          />
                        </div>
                      )
                    } else if (type === 'pdf' && previewContent) {
                      return (
                        <iframe
                          src={previewContent}
                          title={previewFile.title || previewFile.filename || previewFile.id}
                          className="w-full h-[60vh] border rounded-lg"
                        />
                      )
                    } else if (type === 'text' && previewContent) {
                      return (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono overflow-auto max-h-[60vh]">
                            {previewContent}
                          </pre>
                        </div>
                      )
                    } else {
                      return (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                          Preview not available for this file type
                        </div>
                      )
                    }
                  })()}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewFile(null)}>
                Close
              </Button>
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}


    </div>
  )
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
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
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
              <SubmissionsTab assignment={assignment} />
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