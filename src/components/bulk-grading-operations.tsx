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
import { Separator } from "@/components/ui/separator"
import { 
  Calculator,
  TrendingUp,
  Users,
  Zap,
  BarChart3,
  Target,
  Award,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Download,
  Upload,
  FileSpreadsheet
} from "lucide-react"
import { toast } from "sonner"
import { gradebookAPI } from "@/lib/gradebook-api"
import { ploneAPI } from "@/lib/api"
import { EnhancedGrade, WeightedCategory, GradeCurve } from "@/types/gradebook"

interface BulkGradingOperationsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
  assignmentId: string
  assignmentTitle: string
  submissions: any[]
  onOperationComplete: () => void
}

export function BulkGradingOperations({
  open,
  onOpenChange,
  classId,
  assignmentId,
  assignmentTitle,
  submissions,
  onOperationComplete
}: BulkGradingOperationsProps) {
  const [operation, setOperation] = useState<'grade' | 'curve' | 'feedback' | 'import'>('grade')
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<WeightedCategory[]>([])
  
  // Bulk grading states
  const [bulkGrade, setBulkGrade] = useState('')
  const [bulkFeedback, setBulkFeedback] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  
  // Grade curve states
  const [curveType, setCurveType] = useState<'flat' | 'percentage' | 'bell'>('flat')
  const [curveAmount, setCurveAmount] = useState('')
  const [curveMaxGrade, setCurveMaxGrade] = useState('')
  const [curveReason, setCurveReason] = useState('')
  
  // Statistics
  const [stats, setStats] = useState({
    average: 0,
    median: 0,
    min: 0,
    max: 0,
    standardDeviation: 0,
    distribution: {} as Record<string, number>
  })

  useEffect(() => {
    if (open) {
      loadGradebookSettings()
      calculateStatistics()
    }
  }, [open, submissions])

  const loadGradebookSettings = async () => {
    try {
      const settings = await gradebookAPI.getGradebookSettings(classId)
      setCategories(settings.categories)
      if (settings.categories.length > 0) {
        setSelectedCategory(settings.categories[0].id)
      }
    } catch (error) {
      console.error('Error loading gradebook settings:', error)
    }
  }

  const calculateStatistics = () => {
    const gradedSubmissions = submissions.filter(s => s.grade !== undefined && s.grade !== null)
    
    if (gradedSubmissions.length === 0) {
      setStats({ average: 0, median: 0, min: 0, max: 0, standardDeviation: 0, distribution: {} })
      return
    }

    const grades = gradedSubmissions.map(s => s.grade).sort((a, b) => a - b)
    
    const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length
    const median = grades.length % 2 === 0 
      ? (grades[grades.length / 2 - 1] + grades[grades.length / 2]) / 2
      : grades[Math.floor(grades.length / 2)]
    const min = Math.min(...grades)
    const max = Math.max(...grades)
    
    const variance = grades.reduce((sum, grade) => sum + Math.pow(grade - average, 2), 0) / grades.length
    const standardDeviation = Math.sqrt(variance)
    
    // Grade distribution
    const distribution: Record<string, number> = {
      'A (90-100)': grades.filter(g => g >= 90).length,
      'B (80-89)': grades.filter(g => g >= 80 && g < 90).length,
      'C (70-79)': grades.filter(g => g >= 70 && g < 80).length,
      'D (60-69)': grades.filter(g => g >= 60 && g < 70).length,
      'F (0-59)': grades.filter(g => g < 60).length
    }

    setStats({ average, median, min, max, standardDeviation, distribution })
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

  const selectByGradeRange = (min: number, max: number) => {
    const submissionsInRange = submissions.filter(s => {
      const grade = s.grade || 0
      return grade >= min && grade <= max
    })
    setSelectedSubmissions(new Set(submissionsInRange.map(s => s.id)))
  }

  const handleBulkGrade = async () => {
    if (selectedSubmissions.size === 0 || !bulkGrade) {
      toast.error('Please select submissions and enter a grade')
      return
    }

    setLoading(true)
    try {
      const gradeValue = parseInt(bulkGrade)
      const maxPoints = 100 // TODO: Get from assignment

      const promises = Array.from(selectedSubmissions).map(async (submissionId) => {
        const submission = submissions.find(s => s.id === submissionId)
        if (!submission) return

        const enhancedGrade: EnhancedGrade = {
          id: `grade-${assignmentId}-${submission.studentId}`,
          studentId: submission.studentId,
          assignmentId: assignmentId,
          classId: classId,
          categoryId: selectedCategory,
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
      
      toast.success(`Applied grade ${bulkGrade}% to ${selectedSubmissions.size} submissions!`)
      onOperationComplete()
      onOpenChange(false)
    } catch (error) {
      console.error('Error applying bulk grades:', error)
      toast.error('Failed to apply bulk grades')
    } finally {
      setLoading(false)
    }
  }

  const handleGradeCurve = async () => {
    if (selectedSubmissions.size === 0 || !curveAmount) {
      toast.error('Please select submissions and enter curve amount')
      return
    }

    setLoading(true)
    try {
      const curve: GradeCurve = {
        type: curveType,
        amount: parseInt(curveAmount),
        maxGrade: curveMaxGrade ? parseInt(curveMaxGrade) : undefined,
        affectedStudents: Array.from(selectedSubmissions),
        reason: curveReason
      }

      // Apply curve to selected submissions
      const promises = Array.from(selectedSubmissions).map(async (submissionId) => {
        const submission = submissions.find(s => s.id === submissionId)
        if (!submission || submission.grade === undefined) return

        let newGrade = submission.grade
        
        switch (curveType) {
          case 'flat':
            newGrade = submission.grade + curve.amount
            break
          case 'percentage':
            newGrade = submission.grade * (1 + curve.amount / 100)
            break
          case 'bell':
            // Simple bell curve adjustment - could be more sophisticated
            const deviation = submission.grade - stats.average
            newGrade = stats.average + deviation * (1 + curve.amount / 100)
            break
        }

        // Apply maximum grade limit if specified
        if (curve.maxGrade) {
          newGrade = Math.min(newGrade, curve.maxGrade)
        }

        // Ensure grade is within bounds
        newGrade = Math.max(0, Math.min(100, Math.round(newGrade)))

        const enhancedGrade: EnhancedGrade = {
          id: `grade-${assignmentId}-${submission.studentId}`,
          studentId: submission.studentId,
          assignmentId: assignmentId,
          classId: classId,
          categoryId: selectedCategory,
          points: newGrade,
          maxPoints: 100,
          percentage: newGrade,
          feedback: `Grade curved: ${curveReason || 'Grade adjustment applied'}`,
          gradedBy: 'teacher',
          gradedAt: new Date().toISOString()
        }

        return gradebookAPI.saveEnhancedGrade(enhancedGrade)
      })

      await Promise.all(promises)
      
      toast.success(`Applied ${curveType} curve to ${selectedSubmissions.size} submissions!`)
      onOperationComplete()
      onOpenChange(false)
    } catch (error) {
      console.error('Error applying grade curve:', error)
      toast.error('Failed to apply grade curve')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkFeedback = async () => {
    if (selectedSubmissions.size === 0 || !bulkFeedback) {
      toast.error('Please select submissions and enter feedback')
      return
    }

    setLoading(true)
    try {
      const promises = Array.from(selectedSubmissions).map(async (submissionId) => {
        const submission = submissions.find(s => s.id === submissionId)
        if (!submission) return

        // Update existing grade with additional feedback
        const existingGrade = await gradebookAPI.getEnhancedGrade(classId, assignmentId, submission.studentId)
        
        const enhancedGrade: EnhancedGrade = {
          ...(existingGrade || {
            id: `grade-${assignmentId}-${submission.studentId}`,
            studentId: submission.studentId,
            assignmentId: assignmentId,
            classId: classId,
            categoryId: selectedCategory,
            points: submission.grade || 0,
            maxPoints: 100,
            percentage: submission.grade || 0,
            gradedBy: 'teacher',
            gradedAt: new Date().toISOString()
          }),
          feedback: existingGrade?.feedback 
            ? `${existingGrade.feedback}\n\n${bulkFeedback}`
            : bulkFeedback
        }

        return gradebookAPI.saveEnhancedGrade(enhancedGrade)
      })

      await Promise.all(promises)
      
      toast.success(`Added feedback to ${selectedSubmissions.size} submissions!`)
      onOperationComplete()
      onOpenChange(false)
    } catch (error) {
      console.error('Error adding bulk feedback:', error)
      toast.error('Failed to add bulk feedback')
    } finally {
      setLoading(false)
    }
  }

  const exportGrades = () => {
    const csvData = submissions.map(submission => ({
      'Student ID': submission.studentId,
      'Student Name': submission.studentName,
      'Grade': submission.grade || '',
      'Submitted At': submission.submittedAt,
      'Graded At': submission.gradedAt || '',
      'Feedback': submission.feedback?.[0]?.description || ''
    }))

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${assignmentTitle}_grades.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    toast.success('Grades exported successfully!')
  }

  const getGradeColor = (grade: number | undefined) => {
    if (grade === undefined || grade === null) return 'text-gray-400'
    if (grade >= 90) return 'text-green-600'
    if (grade >= 80) return 'text-blue-600'
    if (grade >= 70) return 'text-yellow-600'
    if (grade >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Bulk Grading Operations - {assignmentTitle}
          </DialogTitle>
          <DialogDescription>
            Efficiently manage grades for multiple students with advanced operations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statistics Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Grade Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Average</p>
                  <p className={`text-xl font-bold ${getGradeColor(stats.average)}`}>
                    {stats.average.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Median</p>
                  <p className={`text-xl font-bold ${getGradeColor(stats.median)}`}>
                    {stats.median.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Min</p>
                  <p className={`text-xl font-bold ${getGradeColor(stats.min)}`}>
                    {stats.min.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Max</p>
                  <p className={`text-xl font-bold ${getGradeColor(stats.max)}`}>
                    {stats.max.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Std Dev</p>
                  <p className="text-xl font-bold text-gray-700">
                    {stats.standardDeviation.toFixed(1)}
                  </p>
                </div>
              </div>
              
              {/* Grade Distribution */}
              <div className="space-y-2">
                <h4 className="font-medium">Grade Distribution</h4>
                {Object.entries(stats.distribution).map(([grade, count]) => (
                  <div key={grade} className="flex items-center gap-3">
                    <span className="text-sm w-20">{grade}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(count / submissions.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Operation Tabs */}
          <Tabs value={operation} onValueChange={(value) => setOperation(value as 'grade' | 'curve' | 'feedback' | 'import')}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="grade">Bulk Grade</TabsTrigger>
              <TabsTrigger value="curve">Grade Curve</TabsTrigger>
              <TabsTrigger value="feedback">Bulk Feedback</TabsTrigger>
              <TabsTrigger value="import">Import/Export</TabsTrigger>
            </TabsList>

            {/* Selection Controls */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Student Selection ({selectedSubmissions.size} selected)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedSubmissions.size === submissions.length && submissions.length > 0}
                      onCheckedChange={selectAllSubmissions}
                    />
                    <Label>Select All ({submissions.length})</Label>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectByGradeRange(90, 100)}
                  >
                    A Students ({submissions.filter(s => (s.grade || 0) >= 90).length})
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectByGradeRange(80, 89)}
                  >
                    B Students ({submissions.filter(s => (s.grade || 0) >= 80 && (s.grade || 0) < 90).length})
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectByGradeRange(0, 69)}
                  >
                    Below C ({submissions.filter(s => (s.grade || 0) < 70).length})
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedSubmissions(new Set(submissions.filter(s => s.grade === undefined).map(s => s.id)))}
                  >
                    Ungraded ({submissions.filter(s => s.grade === undefined).length})
                  </Button>
                </div>

                {/* Student List */}
                <div className="max-h-60 overflow-y-auto border rounded p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {submissions.map(submission => (
                      <div key={submission.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedSubmissions.has(submission.id)}
                          onCheckedChange={() => toggleSubmissionSelection(submission.id)}
                        />
                        <span className="text-sm truncate flex-1">{submission.studentName}</span>
                        <span className={`text-xs ${getGradeColor(submission.grade)}`}>
                          {submission.grade !== undefined ? `${submission.grade}%` : 'Not graded'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <TabsContent value="grade" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Apply Grade to Selected Students</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bulk-grade">Grade (0-100)</Label>
                      <Input
                        id="bulk-grade"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Enter grade"
                        value={bulkGrade}
                        onChange={(e) => setBulkGrade(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="grade-category">Category</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
                  </div>
                  
                  <div>
                    <Label htmlFor="bulk-feedback">Optional Feedback</Label>
                    <Textarea
                      id="bulk-feedback"
                      placeholder="Feedback to apply to all selected submissions..."
                      value={bulkFeedback}
                      onChange={(e) => setBulkFeedback(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleBulkGrade}
                    disabled={selectedSubmissions.size === 0 || !bulkGrade || loading}
                    className="w-full"
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Apply Grade to {selectedSubmissions.size} Student{selectedSubmissions.size !== 1 ? 's' : ''}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="curve" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Apply Grade Curve</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="curve-type">Curve Type</Label>
                      <Select value={curveType} onValueChange={(value: 'flat' | 'percentage' | 'bell') => setCurveType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat Addition</SelectItem>
                          <SelectItem value="percentage">Percentage Increase</SelectItem>
                          <SelectItem value="bell">Bell Curve Adjustment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="curve-amount">
                        {curveType === 'flat' ? 'Points to Add' : 'Percentage Increase'}
                      </Label>
                      <Input
                        id="curve-amount"
                        type="number"
                        placeholder={curveType === 'flat' ? '5' : '10'}
                        value={curveAmount}
                        onChange={(e) => setCurveAmount(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="curve-max">Max Grade (Optional)</Label>
                      <Input
                        id="curve-max"
                        type="number"
                        max="100"
                        placeholder="100"
                        value={curveMaxGrade}
                        onChange={(e) => setCurveMaxGrade(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="curve-reason">Reason for Curve</Label>
                    <Input
                      id="curve-reason"
                      placeholder="e.g., Assignment was more difficult than expected"
                      value={curveReason}
                      onChange={(e) => setCurveReason(e.target.value)}
                    />
                  </div>
                  
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Grade curves will permanently modify student grades. This action cannot be easily undone.
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    onClick={handleGradeCurve}
                    disabled={selectedSubmissions.size === 0 || !curveAmount || loading}
                    className="w-full"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Apply Curve to {selectedSubmissions.size} Student{selectedSubmissions.size !== 1 ? 's' : ''}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add Bulk Feedback</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="feedback-text">Feedback Message</Label>
                    <Textarea
                      id="feedback-text"
                      placeholder="Feedback to add to all selected submissions..."
                      value={bulkFeedback}
                      onChange={(e) => setBulkFeedback(e.target.value)}
                      rows={4}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleBulkFeedback}
                    disabled={selectedSubmissions.size === 0 || !bulkFeedback || loading}
                    className="w-full"
                  >
                    <Award className="w-4 h-4 mr-2" />
                    Add Feedback to {selectedSubmissions.size} Student{selectedSubmissions.size !== 1 ? 's' : ''}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="import" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Import/Export Grades</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={exportGrades}
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center"
                    >
                      <Download className="w-6 h-6 mb-2" />
                      Export Grades to CSV
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center"
                      disabled
                    >
                      <Upload className="w-6 h-6 mb-2" />
                      Import Grades from CSV
                      <span className="text-xs text-gray-500">(Coming Soon)</span>
                    </Button>
                  </div>
                  
                  <Alert>
                    <FileSpreadsheet className="w-4 h-4" />
                    <AlertDescription>
                      Export includes student IDs, names, grades, submission dates, and feedback.
                      Use this to backup grades or for external analysis.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 