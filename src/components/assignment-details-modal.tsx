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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ploneAPI } from "@/lib/api"
import { gradebookAPI } from "@/lib/gradebook-api"
import { 
  Calendar, 
  Clock, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  FileText, 
  Users, 
  Download, 
  MessageSquare, 
  Star, 
  Eye, 
  Image, 
  FileImage, 
  File,
  Calculator,
  TrendingUp,
  Award,
  BarChart3,
  Zap,
  CheckCircle2,
  AlertTriangle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { toast } from "sonner"
import { WeightedCategory, EnhancedGrade } from "@/types/gradebook"

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
  categoryId?: string; // Add category assignment
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
  enhancedGrade?: EnhancedGrade
}

// Enhanced Submissions Tab Component
function SubmissionsTab({ assignment }: { assignment: Assignment }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<{ [key: string]: any }>({})
  const [gradingMode, setGradingMode] = useState<'simple' | 'rubric' | 'bulk'>('simple')
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set())
  const [categories, setCategories] = useState<WeightedCategory[]>([])
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null)
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '', categoryId: '' })
  const [bulkGradeValue, setBulkGradeValue] = useState('')
  const [bulkFeedback, setBulkFeedback] = useState('')
  const [previewFile, setPreviewFile] = useState<any>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submissionHistory, setSubmissionHistory] = useState<Submission[]>([])
  const [showHistorySidebar, setShowHistorySidebar] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (assignment) {
      loadSubmissions()
      loadGradebookSettings()
    }
  }, [assignment])

  const loadGradebookSettings = async () => {
    try {
      const settings = await gradebookAPI.getGradebookSettings(assignment.classId)
      setCategories(settings.categories)
    } catch (error) {
      console.error('Error loading gradebook settings:', error)
    }
  }

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      
      // Get submissions and enhanced grades
      const submissionsData = await ploneAPI.getLatestSubmissionsForAssignment(assignment.classId, assignment.id)
      
      // Get class students to map student IDs to names
      const classStudents = await ploneAPI.getStudents(assignment.classId)
      const studentsMap: { [key: string]: any } = {}
      classStudents.forEach((student: any) => {
        const studentId = student.id || student['@id']?.split('/').pop() || student.title?.toLowerCase().replace(/\s+/g, '')
        if (studentId) {
          studentsMap[studentId] = student
        }
        if (student.title) {
          studentsMap[student.title.toLowerCase().replace(/\s+/g, '')] = student
        }
      })
      setStudents(studentsMap)
      
      // Process submissions and add enhanced grading data
      const processedSubmissions: Submission[] = await Promise.all(
        submissionsData.map(async (submission: any) => {
          const studentId = submission.studentId
          
          // Find student info
          let student = studentsMap[studentId] || studentsMap[studentId?.toLowerCase()]
          if (!student) {
            const studentKeys = Object.keys(studentsMap)
            const matchingKey = studentKeys.find(key => {
              const keyNoHyphens = key.replace(/-/g, '').toLowerCase()
              const studentIdNoHyphens = studentId.replace(/-/g, '').toLowerCase()
              return keyNoHyphens === studentIdNoHyphens ||
                     key.includes(studentId.toLowerCase()) || 
                     studentId.toLowerCase().includes(key)
            })
            if (matchingKey) {
              student = studentsMap[matchingKey]
            }
          }
          
          let studentName = `Student ${studentId}`
          if (student) {
            studentName = student.title || student.name
          } else if (studentId) {
            studentName = studentId.charAt(0).toUpperCase() + studentId.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2')
          }

          // Get enhanced grade data
          let enhancedGrade: EnhancedGrade | undefined
          try {
            enhancedGrade = await gradebookAPI.getEnhancedGrade(assignment.classId, assignment.id, studentId) || undefined
          } catch (error) {
            console.warn('Could not load enhanced grade:', error)
          }
          
          const processedSubmission: Submission = {
            id: submission.id,
            studentId: studentId,
            studentName: studentName,
            submittedAt: submission.submittedAt || submission.created,
            content: submission.content,
            attachments: submission.attachments || [],
            feedback: submission.feedback || [],
            grade: enhancedGrade?.points || submission.grade,
            gradedAt: enhancedGrade?.gradedAt || submission.gradedAt,
            status: (enhancedGrade?.points !== undefined || submission.grade !== undefined ? 'graded' : 'submitted') as 'submitted' | 'graded' | 'late',
            enhancedGrade
          }
          
          return processedSubmission
        })
      )
      
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

  const getGradeColor = (grade: number | undefined) => {
    if (grade === undefined || grade === null) return 'text-gray-400'
    if (grade >= 90) return 'text-green-600'
    if (grade >= 80) return 'text-blue-600'
    if (grade >= 70) return 'text-yellow-600'
    if (grade >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const handleGradeSubmission = async (submission: Submission) => {
    setGradingSubmission(submission)
    setGradeForm({
      grade: submission.grade?.toString() || '',
      feedback: submission.feedback?.[0]?.description || '',
      categoryId: submission.enhancedGrade?.categoryId || categories[0]?.id || ''
    })
    
    // Load submission history for this student
    setSelectedStudentId(submission.studentId)
    setHistoryLoading(true)
    setShowHistorySidebar(true)
    
    try {
      const history = await ploneAPI.getStudentSubmissionHistory(
        assignment.classId, 
        assignment.id, 
        submission.studentId
      )
      setSubmissionHistory(history)
    } catch (error) {
      console.error('Error loading submission history:', error)
      toast.error('Failed to load submission history')
    } finally {
      setHistoryLoading(false)
    }
  }

  const submitGrade = async () => {
    if (!gradingSubmission || !gradeForm.grade) {
      toast.error('Please enter a grade')
      return
    }

    try {
      const gradeValue = parseInt(gradeForm.grade)
      const maxPoints = assignment.points || 100

      // Save enhanced grade
      const enhancedGrade: EnhancedGrade = {
        id: `grade-${assignment.id}-${gradingSubmission.studentId}`,
        studentId: gradingSubmission.studentId,
        assignmentId: assignment.id,
        classId: assignment.classId,
        categoryId: gradeForm.categoryId || categories[0]?.id || 'general',
        points: gradeValue,
        maxPoints: maxPoints,
        percentage: (gradeValue / maxPoints) * 100,
        feedback: gradeForm.feedback,
        gradedBy: 'teacher', // TODO: Get from auth context
        gradedAt: new Date().toISOString()
      }

      await gradebookAPI.saveEnhancedGrade(enhancedGrade)
      
      toast.success('Grade submitted successfully!')
      setGradingSubmission(null)
      setGradeForm({ grade: '', feedback: '', categoryId: '' })
      setShowHistorySidebar(false)
      loadSubmissions() // Reload to show updated grade
    } catch (error) {
      console.error('Error submitting grade:', error)
      toast.error('Failed to submit grade')
    }
  }

  const handleBulkGrade = async () => {
    if (selectedSubmissions.size === 0 || !bulkGradeValue) {
      toast.error('Please select submissions and enter a grade')
      return
    }

    try {
      const gradeValue = parseInt(bulkGradeValue)
      const maxPoints = assignment.points || 100

      // Apply grades to all selected submissions
      const promises = Array.from(selectedSubmissions).map(async (submissionId) => {
        const submission = submissions.find(s => s.id === submissionId)
        if (!submission) return

        const enhancedGrade: EnhancedGrade = {
          id: `grade-${assignment.id}-${submission.studentId}`,
          studentId: submission.studentId,
          assignmentId: assignment.id,
          classId: assignment.classId,
          categoryId: categories[0]?.id || 'general',
          points: gradeValue,
          maxPoints: maxPoints,
          percentage: (gradeValue / maxPoints) * 100,
          feedback: bulkFeedback,
          gradedBy: 'teacher',
          gradedAt: new Date().toISOString()
        }

        return gradebookAPI.saveEnhancedGrade(enhancedGrade)
      })

      await Promise.all(promises)
      
      toast.success(`Applied grade to ${selectedSubmissions.size} submissions!`)
      setSelectedSubmissions(new Set())
      setBulkGradeValue('')
      setBulkFeedback('')
      loadSubmissions()
    } catch (error) {
      console.error('Error applying bulk grades:', error)
      toast.error('Failed to apply bulk grades')
    }
  }

  const toggleSubmissionSelection = (submissionId: string) => {
    const newSelection = new Set(selectedSubmissions)
    if (newSelection.has(submissionId)) {
      newSelection.delete(submissionId)
    } else {
      newSelection.add(submissionId)
    }
    setSelectedSubmissions(newSelection)
  }

  const selectAllSubmissions = () => {
    if (selectedSubmissions.size === submissions.length) {
      setSelectedSubmissions(new Set())
    } else {
      setSelectedSubmissions(new Set(submissions.map(s => s.id)))
    }
  }

  // Calculate class statistics
  const gradedSubmissions = submissions.filter(s => s.grade !== undefined)
  const classAverage = gradedSubmissions.length > 0 
    ? gradedSubmissions.reduce((sum, s) => sum + (s.grade || 0), 0) / gradedSubmissions.length
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Statistics */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Student Submissions ({submissions.length})</h3>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Graded: {gradedSubmissions.length}/{submissions.length}</span>
            {gradedSubmissions.length > 0 && (
              <span>Class Average: <span className={getGradeColor(classAverage)}>{classAverage.toFixed(1)}%</span></span>
            )}
            <span>Category: {categories.find(c => c.id === assignment.categoryId)?.name || 'General'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={gradingMode} onValueChange={(value: 'simple' | 'rubric' | 'bulk') => setGradingMode(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple Grading</SelectItem>
              <SelectItem value="rubric">Rubric Grading</SelectItem>
              <SelectItem value="bulk">Bulk Operations</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadSubmissions}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Bulk Grading Interface */}
      {gradingMode === 'bulk' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              Bulk Grading Operations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedSubmissions.size === submissions.length && submissions.length > 0}
                  onCheckedChange={selectAllSubmissions}
                />
                <Label htmlFor="select-all">
                  Select All ({selectedSubmissions.size} selected)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Grade (0-100)"
                  value={bulkGradeValue}
                  onChange={(e) => setBulkGradeValue(e.target.value)}
                  className="w-32"
                  min="0"
                  max="100"
                />
                <Input
                  placeholder="Bulk feedback (optional)"
                  value={bulkFeedback}
                  onChange={(e) => setBulkFeedback(e.target.value)}
                  className="w-64"
                />
                <Button 
                  onClick={handleBulkGrade}
                  disabled={selectedSubmissions.size === 0 || !bulkGradeValue}
                >
                  Apply to {selectedSubmissions.size} submissions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submissions List */}
      <div className="space-y-4">
        {submissions.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Submissions Yet</h3>
              <p className="text-sm text-gray-600">
                Students haven't submitted their work for this assignment yet.
              </p>
            </CardContent>
          </Card>
        )}

        {submissions.map((submission, index) => {
          const statusInfo = getSubmissionStatus(submission)
          const isSelected = selectedSubmissions.has(submission.id)
          
          return (
            <Card key={submission.id || `submission-${index}`} className={`border-0 shadow-sm transition-colors ${
              isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {gradingMode === 'bulk' && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSubmissionSelection(submission.id)}
                        className="mt-1"
                      />
                    )}
                    
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
                          <>
                            <Badge variant="outline" className={getGradeColor(submission.grade)}>
                              {submission.grade}%
                            </Badge>
                            {submission.enhancedGrade && (
                              <Badge variant="secondary" className="text-xs">
                                Enhanced
                              </Badge>
                            )}
                          </>
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
                        
                        {submission.attachments.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{submission.attachments.length} file{submission.attachments.length > 1 ? 's' : ''}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="w-4 h-4" />
                            <span>No files submitted</span>
                          </div>
                        )}
                        
                        {submission.enhancedGrade?.categoryId && (
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-4 h-4" />
                            <span>{categories.find(c => c.id === submission.enhancedGrade?.categoryId)?.name || 'General'}</span>
                          </div>
                        )}
                      </div>

                      {/* Enhanced Grade Information */}
                      {submission.enhancedGrade && (
                        <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">Enhanced Grade Details</span>
                            <Badge variant="outline" className="text-blue-700">
                              {submission.enhancedGrade.points}/{submission.enhancedGrade.maxPoints} pts
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs text-blue-800">
                            <div>Percentage: {submission.enhancedGrade.percentage.toFixed(1)}%</div>
                            <div>Category: {categories.find(c => c.id === submission.enhancedGrade?.categoryId)?.name || 'General'}</div>
                            {submission.enhancedGrade.rubricScores && submission.enhancedGrade.rubricScores.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                <span>Rubric-based assessment</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* File attachments or no files message */}
                      {submission.attachments && submission.attachments.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-700">
                              Submitted Files ({submission.attachments.length})
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {submission.attachments.slice(0, 3).map((file: any, fileIndex: number) => (
                              <div key={file.id || `file-${fileIndex}`} className="flex items-center gap-3 p-2 bg-slate-50 rounded border">
                                <FileText className="w-4 h-4 text-slate-500" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {file.title || file.filename || file.id}
                                  </p>
                                  {file.size && (
                                    <p className="text-xs text-slate-500">
                                      {formatFileSize(file.size)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {submission.attachments.length > 3 && (
                              <p className="text-xs text-slate-500 text-center py-2">
                                +{submission.attachments.length - 3} more files
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Alert className="border-amber-200 bg-amber-50">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            No files submitted - student may have only provided text content or experienced upload issues.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Feedback display */}
                      {submission.feedback && submission.feedback.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
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
                      {submission.grade !== undefined ? 'Update' : 'Grade'}
                    </Button>
                    
                    {gradingMode === 'rubric' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-yellow-600 hover:text-yellow-700"
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Rubric
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Enhanced Grading Dialog */}
      {gradingSubmission && (
        <Dialog open={!!gradingSubmission} onOpenChange={() => {
          setGradingSubmission(null)
          setGradeForm({ grade: '', feedback: '', categoryId: '' })
          setShowHistorySidebar(false)
          setSubmissionHistory([])
          setSelectedStudentId(null)
        }}>
          <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
            <div className="flex h-full">
              {/* Main Grading Area */}
              <div className="flex-1 p-6 overflow-y-auto">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Enhanced Grading - {students[gradingSubmission.studentId]?.name || gradingSubmission.studentId}
                  </DialogTitle>
                  <DialogDescription>
                    Comprehensive grading with category assignment and detailed feedback
                  </DialogDescription>
                </DialogHeader>

                {/* Current Submission Details */}
                <div className="space-y-6 mb-6">
                  {/* Submission Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Submission Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Submitted:</span> {new Date(gradingSubmission.submittedAt).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Files:</span> {gradingSubmission.attachments?.length || 0} attachment(s)
                        </div>
                        <div>
                          <span className="font-medium">Current Grade:</span> {gradingSubmission.grade !== undefined ? `${gradingSubmission.grade}%` : 'Not graded'}
                        </div>
                        <div>
                          <span className="font-medium">Assignment Points:</span> {assignment.points || 100} points
                        </div>
                      </div>
                      
                      {/* File attachments in grading dialog */}
                      {gradingSubmission.attachments && gradingSubmission.attachments.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Submitted Files:</p>
                          <div className="grid gap-2">
                            {gradingSubmission.attachments.map((file: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-gray-500" />
                                  <div>
                                    <span className="text-sm font-medium">{file.title || file.filename}</span>
                                    {file.size && (
                                      <span className="text-xs text-gray-500 ml-2">
                                        ({formatFileSize(file.size)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Enhanced Grading Form */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Grade Assignment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="grade">Points Earned *</Label>
                          <Input
                            id="grade"
                            type="number"
                            min="0"
                            max={assignment.points || 100}
                            placeholder={`0-${assignment.points || 100}`}
                            value={gradeForm.grade}
                            onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
                          />
                          {gradeForm.grade && (
                            <p className="text-xs text-gray-600 mt-1">
                              Percentage: {((parseInt(gradeForm.grade) / (assignment.points || 100)) * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="category">Grade Category</Label>
                          <Select 
                            value={gradeForm.categoryId} 
                            onValueChange={(value) => setGradeForm({ ...gradeForm, categoryId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(category => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name} ({category.weight}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-end">
                          <div className="text-center">
                            <p className="text-sm font-medium text-gray-700">Letter Grade</p>
                            <p className={`text-2xl font-bold ${getGradeColor(gradeForm.grade ? (parseInt(gradeForm.grade) / (assignment.points || 100)) * 100 : undefined)}`}>
                              {gradeForm.grade ? 
                                (((parseInt(gradeForm.grade) / (assignment.points || 100)) * 100) >= 90 ? 'A' :
                                 ((parseInt(gradeForm.grade) / (assignment.points || 100)) * 100) >= 80 ? 'B' :
                                 ((parseInt(gradeForm.grade) / (assignment.points || 100)) * 100) >= 70 ? 'C' :
                                 ((parseInt(gradeForm.grade) / (assignment.points || 100)) * 100) >= 60 ? 'D' : 'F')
                                : '--'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="feedback">Detailed Feedback</Label>
                        <Textarea
                          id="feedback"
                          placeholder="Provide comprehensive feedback on the student's work..."
                          value={gradeForm.feedback}
                          onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                          rows={4}
                        />
                      </div>
                      
                      {gradingSubmission.enhancedGrade && (
                        <Alert>
                          <CheckCircle2 className="w-4 h-4" />
                          <AlertDescription>
                            This submission has enhanced grading data. Updating will preserve the enhanced features.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <DialogFooter className="gap-2">
                  <Button onClick={submitGrade} disabled={!gradeForm.grade}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Grade
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setGradingSubmission(null)
                      setGradeForm({ grade: '', feedback: '', categoryId: '' })
                      setShowHistorySidebar(false)
                      setSubmissionHistory([])
                      setSelectedStudentId(null)
                    }}
                  >
                    Cancel
                  </Button>
                </DialogFooter>
              </div>

              {/* Submission History Sidebar */}
              {showHistorySidebar && (
                <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Submission History</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHistorySidebar(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                      <span className="ml-2 text-sm">Loading...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submissionHistory.map((historicalSubmission, index) => (
                        <Card key={index} className={`${index === 0 ? 'border-blue-200 bg-blue-50' : ''}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                {index === 0 ? 'Latest' : `Version ${submissionHistory.length - index}`}
                              </span>
                              {historicalSubmission.grade !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  {historicalSubmission.grade}%
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <p>{new Date(historicalSubmission.submittedAt).toLocaleString()}</p>
                              <p>{historicalSubmission.attachments?.length || 0} file(s)</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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