"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Users, 
  Settings, 
  Download, 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Eye,
  Edit,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Plus,
  MoreVertical,
  Mail,
  FileText,
  RefreshCw,
  Zap,
  Target,
  Award,
  BookOpen,
  PieChart
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  GradebookEntry, 
  WeightedCategory, 
  GradebookAnalytics, 
  EnhancedGrade,
  StudentGradeSummary
} from "@/types/gradebook"
import { gradebookAPI } from "@/lib/gradebook-api"
import { ploneAPI } from "@/lib/api"
import { GradeCategoriesDialog } from "./grade-categories-dialog"
import { BulkGradingOperations } from "./bulk-grading-operations"
import { toast } from "sonner"

interface EnhancedGradebookViewProps {
  classId: string
  className?: string
  fullScreen?: boolean
}

export function EnhancedGradebookView({ classId, className, fullScreen = false }: EnhancedGradebookViewProps) {
  const [loading, setLoading] = useState(true)
  const [gradebookData, setGradebookData] = useState<GradebookEntry[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [categories, setCategories] = useState<WeightedCategory[]>([])
  const [analytics, setAnalytics] = useState<GradebookAnalytics | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bulkOperationsOpen, setBulkOperationsOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [editingGrade, setEditingGrade] = useState<{ studentId: string; assignmentId: string } | null>(null)
  const [tempGradeValue, setTempGradeValue] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'summary' | 'analytics'>('grid')

  useEffect(() => {
    if (classId) {
      loadGradebookData()
    }
  }, [classId])

  const loadGradebookData = async () => {
    try {
      setLoading(true)
      
      const [
        gradebookEntries,
        assignmentsData,
        studentsData,
        settings,
        analyticsData
      ] = await Promise.all([
        gradebookAPI.getGradebookData(classId),
        ploneAPI.getAssignments(classId),
        ploneAPI.getStudents(classId),
        gradebookAPI.getGradebookSettings(classId),
        gradebookAPI.getGradebookAnalytics(classId)
      ])

      setGradebookData(gradebookEntries)
      setAssignments(assignmentsData)
      setStudents(studentsData)
      setCategories(settings.categories)
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Error loading gradebook data:', error)
      toast.error('Failed to load gradebook data')
    } finally {
      setLoading(false)
    }
  }

  const handleGradeEdit = async (studentId: string, assignmentId: string, newGrade: number) => {
    try {
      const assignment = assignments.find(a => a.id === assignmentId)
      const category = categories.find(c => c.id === assignment?.categoryId) || categories[0]

      await gradebookAPI.saveEnhancedGrade({
        id: `grade-${assignmentId}-${studentId}`,
        studentId,
        assignmentId,
        classId,
        categoryId: category?.id || 'general',
        points: newGrade,
        maxPoints: assignment?.points || 100,
        percentage: (newGrade / (assignment?.points || 100)) * 100,
        gradedBy: 'teacher',
        gradedAt: new Date().toISOString()
      })

      toast.success('Grade updated successfully!')
      await loadGradebookData() // Refresh data
    } catch (error) {
      console.error('Error updating grade:', error)
      toast.error('Failed to update grade')
    }
  }

  const getGradeColor = (grade: number | null) => {
    if (grade === null || grade === undefined) return 'text-gray-400'
    if (grade >= 90) return 'text-green-600'
    if (grade >= 80) return 'text-blue-600'
    if (grade >= 70) return 'text-yellow-600'
    if (grade >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-600" />
      default:
        return <BarChart3 className="w-4 h-4 text-gray-600" />
    }
  }

  const filteredGradebookData = gradebookData.filter(entry => {
    const matchesSearch = entry.studentName.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const filteredAssignments = selectedCategory === 'all' 
    ? assignments 
    : assignments.filter(a => a.categoryId === selectedCategory)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading gradebook...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${fullScreen ? 'p-6' : ''}`}>
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Enhanced Gradebook</h1>
          <p className="text-slate-600 mt-1">
            {className} • {gradebookData.length} students • {assignments.length} assignments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={viewMode} onValueChange={(value: 'grid' | 'summary' | 'analytics') => setViewMode(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">Grade Grid</SelectItem>
              <SelectItem value="summary">Student Summary</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={loadGradebookData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Grade Categories
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="w-4 h-4 mr-2" />
                Export Gradebook
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Mail className="w-4 h-4 mr-2" />
                Email Reports
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Class Average</p>
                  <p className={`text-3xl font-bold ${getGradeColor(analytics.averageGrade)}`}>
                    {analytics.averageGrade.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Students</p>
                  <p className="text-3xl font-bold text-slate-900">{analytics.totalStudents}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Assignments</p>
                  <p className="text-3xl font-bold text-slate-900">{assignments.length}</p>
                </div>
                <FileText className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">At Risk</p>
                  <p className="text-3xl font-bold text-red-600">{analytics.atRiskStudents.length}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={viewMode} onValueChange={(value: string) => setViewMode(value as 'grid' | 'summary' | 'analytics')}>
        <TabsContent value="grid">
          {/* Filters and Controls */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name} ({category.weight}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  onClick={() => setBulkOperationsOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Bulk Operations
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Grade Distribution */}
          {analytics && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Grade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.gradeDistribution).map(([letter, count]) => (
                    <div key={letter} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-12">{letter}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                          style={{ width: `${(count / analytics.totalStudents) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-8">{count}</span>
                      <span className="text-xs text-gray-500 w-12">
                        {((count / analytics.totalStudents) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gradebook Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Gradebook Grid</span>
                <Badge variant="outline">{filteredGradebookData.length} students</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-slate-700 sticky left-0 bg-slate-50 min-w-[200px]">
                        Student
                      </th>
                      {filteredAssignments.map(assignment => (
                        <th key={assignment.id} className="text-center p-2 font-medium text-slate-700 min-w-[80px]">
                          <div className="space-y-1">
                            <div className="text-xs truncate max-w-20" title={assignment.title}>
                              {assignment.title}
                            </div>
                            <div className="text-xs text-slate-500">
                              {assignment.points || 100}pts
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="text-center p-4 font-medium text-slate-700 min-w-[100px]">
                        Overall
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGradebookData.map(entry => (
                      <tr key={entry.studentId} className="border-b hover:bg-slate-50">
                        {/* Student Info */}
                        <td className="p-4 sticky left-0 bg-white border-r">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium">
                              {entry.studentName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{entry.studentName}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {getTrendIcon(entry.trend)}
                                {entry.missingAssignments.length > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {entry.missingAssignments.length} missing
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        {/* Assignment Grades */}
                        {filteredAssignments.map(assignment => {
                          const grade = entry.assignments[assignment.id]
                          const isEditing = editingGrade?.studentId === entry.studentId &&
                                           editingGrade?.assignmentId === assignment.id
                          
                          return (
                            <td key={assignment.id} className="text-center p-2">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  min="0"
                                  max={assignment.points || 100}
                                  value={tempGradeValue}
                                  onChange={(e) => setTempGradeValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const newGrade = parseFloat(tempGradeValue)
                                      if (!isNaN(newGrade)) {
                                        handleGradeEdit(entry.studentId, assignment.id, newGrade)
                                      }
                                      setEditingGrade(null)
                                      setTempGradeValue('')
                                    } else if (e.key === 'Escape') {
                                      setEditingGrade(null)
                                      setTempGradeValue('')
                                    }
                                  }}
                                  onBlur={() => {
                                    const newGrade = parseFloat(tempGradeValue)
                                    if (!isNaN(newGrade)) {
                                      handleGradeEdit(entry.studentId, assignment.id, newGrade)
                                    }
                                    setEditingGrade(null)
                                    setTempGradeValue('')
                                  }}
                                  className="w-16 h-8 text-center text-xs"
                                  autoFocus
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    setEditingGrade({ studentId: entry.studentId, assignmentId: assignment.id })
                                    setTempGradeValue(grade?.percentage?.toString() || '')
                                  }}
                                  className={`hover:bg-slate-100 rounded px-2 py-1 cursor-pointer ${getGradeColor(grade?.percentage || null)}`}
                                >
                                  {grade ? (
                                    <div className="space-y-1">
                                      <div className="font-medium">{grade.percentage.toFixed(0)}%</div>
                                      {grade.isLate && (
                                        <Badge variant="destructive" className="text-xs">Late</Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              )}
                            </td>
                          )
                        })}
                        
                        {/* Overall Grade */}
                        <td className="text-center p-4 border-l">
                          <div className={`font-bold text-lg ${getGradeColor(entry.overallGrade)}`}>
                            {entry.overallGrade.toFixed(1)}%
                          </div>
                          {entry.overallLetter && (
                            <div className="text-sm text-slate-600 mt-1">
                              {entry.overallLetter}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGradebookData.map(entry => (
              <Card key={entry.studentId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{entry.studentName}</span>
                    <div className={`text-xl font-bold ${getGradeColor(entry.overallGrade)}`}>
                      {entry.overallGrade.toFixed(1)}%
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Category Breakdown */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Category Performance</h4>
                    {Object.entries(entry.categoryGrades).map(([categoryId, categoryGrade]) => (
                      <div key={categoryId} className="flex items-center justify-between">
                        <span className="text-sm">{categoryGrade.categoryName}</span>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={categoryGrade.percentage} 
                            className="w-16 h-2" 
                          />
                          <span className={`text-sm font-medium ${getGradeColor(categoryGrade.percentage)}`}>
                            {categoryGrade.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Missing Assignments */}
                  {entry.missingAssignments.length > 0 && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {entry.missingAssignments.length} missing assignment{entry.missingAssignments.length !== 1 ? 's' : ''}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Trend */}
                  <div className="flex items-center gap-2">
                    {getTrendIcon(entry.trend)}
                    <span className="text-sm capitalize">{entry.trend} performance</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          {analytics && (
            <div className="space-y-6">
              {/* Assignment Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Assignment Performance Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.assignmentStats.map(stat => (
                      <div key={stat.assignmentId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{stat.title}</h4>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>Avg: {stat.average.toFixed(1)}%</span>
                            <span>Submissions: {(stat.submissionRate * 100).toFixed(1)}%</span>
                            <span>On Time: {(stat.onTimeRate * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className={`text-2xl font-bold ${getGradeColor(stat.average)}`}>
                          {stat.average.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Category Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Category Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analytics.categoryPerformance.map(cat => (
                      <div key={cat.categoryId} className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">{cat.categoryName}</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Class Average</span>
                            <span className={`font-bold ${getGradeColor(cat.classAverage)}`}>
                              {cat.classAverage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Struggling Students</span>
                            <span className="font-bold text-red-600">
                              {cat.strugglingStudents}
                            </span>
                          </div>
                          <Progress value={cat.classAverage} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* At-Risk Students */}
              {analytics.atRiskStudents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Students Needing Attention
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {analytics.atRiskStudents.map(studentId => {
                        const student = gradebookData.find(entry => entry.studentId === studentId)
                        return student ? (
                          <div key={studentId} className="p-4 border border-red-200 rounded-lg bg-red-50">
                            <h4 className="font-medium">{student.studentName}</h4>
                            <div className="mt-2 space-y-1 text-sm">
                              <div>Overall: <span className="font-bold text-red-600">{student.overallGrade.toFixed(1)}%</span></div>
                              <div>Missing: {student.missingAssignments.length} assignments</div>
                              <div>Trend: {getTrendIcon(student.trend)} {student.trend}</div>
                            </div>
                          </div>
                        ) : null
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Grade Categories Dialog */}
      <GradeCategoriesDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        classId={classId}
        className={className}
        onSettingsSaved={loadGradebookData}
      />

      {/* Bulk Operations Dialog */}
      {selectedAssignment && (
        <BulkGradingOperations
          open={bulkOperationsOpen}
          onOpenChange={setBulkOperationsOpen}
          classId={classId}
          assignmentId={selectedAssignment.id}
          assignmentTitle={selectedAssignment.title}
          submissions={[]} // TODO: Get submissions for selected assignment
          onOperationComplete={loadGradebookData}
        />
      )}
    </div>
  )
} 