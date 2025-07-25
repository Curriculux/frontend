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
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Using basic table elements instead of shadcn table component
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { GradebookEntry, WeightedCategory, GradebookAnalytics, EnhancedGrade } from "@/types/gradebook"
import { gradebookAPI } from "@/lib/gradebook-api"
import { ploneAPI } from "@/lib/api"
import { GradeCategoriesDialog } from "./grade-categories-dialog"
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
  const [categories, setCategories] = useState<WeightedCategory[]>([])
  const [analytics, setAnalytics] = useState<GradebookAnalytics | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<{ studentId: string; assignmentId: string } | null>(null)
  const [tempGradeValue, setTempGradeValue] = useState('')

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
        settings,
        analyticsData
      ] = await Promise.all([
        gradebookAPI.getGradebookData(classId),
        ploneAPI.getAssignments(classId),
        gradebookAPI.getGradebookSettings(classId),
        gradebookAPI.getGradebookAnalytics(classId)
      ])

      setGradebookData(gradebookEntries)
      setAssignments(assignmentsData)
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
      const category = categories[0] // TODO: Get actual category from assignment

      await gradebookAPI.saveEnhancedGrade({
        studentId,
        assignmentId,
        classId,
        categoryId: category?.id || 'general',
        points: newGrade,
        maxPoints: assignment?.points || 100,
        percentage: newGrade,
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
    : assignments.filter(a => {
        // TODO: Filter by category when assignment metadata is available
        return true
      })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading gradebook...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${fullScreen ? 'min-h-screen' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Enhanced Gradebook</h1>
          <p className="text-slate-600 mt-1">
            {className} • {gradebookData.length} students • {assignments.length} assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Categories
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={loadGradebookData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Class Average</p>
                  <p className={`text-3xl font-bold ${getGradeColor(analytics.averageGrade)}`}>
                    {analytics.averageGrade.toFixed(1)}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">At Risk Students</p>
                  <p className="text-3xl font-bold text-red-600">
                    {analytics.atRiskStudents.length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Missing Assignments</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {analytics.missingAssignmentAlerts.reduce((sum, alert) => sum + alert.assignmentIds.length, 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Grade Distribution</p>
                  <div className="flex gap-1 mt-1">
                    {Object.entries(analytics.gradeDistribution).map(([letter, count]) => (
                      <Badge key={letter} variant="outline" className="text-xs">
                        {letter}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All Categories
              </Button>
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="text-white"
                  style={{ backgroundColor: selectedCategory === category.id ? category.color : undefined }}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gradebook Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gradebook Grid</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{filteredGradebookData.length} students</Badge>
              <Badge variant="outline">{filteredAssignments.length} assignments</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-200">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background min-w-[200px] border-r p-3 text-left font-medium">
                    Student
                  </th>
                  {filteredAssignments.map(assignment => (
                    <th key={assignment.id} className="text-center min-w-[80px] p-3 border-b font-medium">
                      <div className="space-y-1">
                        <div className="font-medium truncate" title={assignment.title}>
                          {assignment.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {assignment.points ? `${assignment.points}pts` : '100pts'}
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="text-center min-w-[100px] bg-slate-50 sticky right-0 border-l p-3 font-medium">
                    Overall
                  </th>
                  <th className="text-center min-w-[60px] bg-slate-50 sticky right-0 p-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredGradebookData.map(entry => (
                  <tr key={entry.studentId} className="hover:bg-slate-50 border-b">
                    {/* Student Name */}
                    <td className="sticky left-0 bg-background border-r p-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{entry.studentName}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {getTrendIcon(entry.trend)}
                            <span>{entry.trend}</span>
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
                        <td key={assignment.id} className="text-center p-3 border-b">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={tempGradeValue}
                              onChange={(e) => setTempGradeValue(e.target.value)}
                              onBlur={() => {
                                const newGrade = parseFloat(tempGradeValue)
                                if (!isNaN(newGrade)) {
                                  handleGradeEdit(entry.studentId, assignment.id, newGrade)
                                }
                                setEditingGrade(null)
                                setTempGradeValue('')
                              }}
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
                              className="w-16 h-8 text-center"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingGrade({ studentId: entry.studentId, assignmentId: assignment.id })
                                setTempGradeValue(grade?.percentage?.toString() || '')
                              }}
                              className={`hover:bg-slate-100 rounded px-2 py-1 ${getGradeColor(grade?.percentage || null)}`}
                            >
                              {grade ? (
                                <div>
                                  <div className="font-medium">
                                    {grade.percentage}%
                                  </div>
                                  {grade.isLate && (
                                    <div className="text-xs text-red-500">Late</div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-gray-400">—</div>
                              )}
                            </button>
                                                     )}
                         </td>
                       )
                     })}

                     {/* Overall Grade */}
                     <td className="text-center bg-slate-50 sticky right-0 border-l p-3">
                       <div className="space-y-1">
                         <div className={`font-bold text-lg ${getGradeColor(entry.overallGrade)}`}>
                           {entry.overallGrade.toFixed(1)}%
                         </div>
                         {entry.overallLetter && (
                           <Badge variant="outline">{entry.overallLetter}</Badge>
                         )}
                       </div>
                     </td>

                     {/* Actions */}
                     <td className="text-center bg-slate-50 sticky right-0 p-3">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="sm">
                             <MoreVertical className="w-4 h-4" />
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                           <DropdownMenuItem>
                             <Eye className="w-4 h-4 mr-2" />
                             View Details
                           </DropdownMenuItem>
                           <DropdownMenuItem>
                             <Mail className="w-4 h-4 mr-2" />
                             Email Student
                           </DropdownMenuItem>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem>
                             <FileText className="w-4 h-4 mr-2" />
                             Progress Report
                           </DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categories.map(category => {
                const categoryAverage = filteredGradebookData.reduce((sum, entry) => {
                  const categoryGrade = entry.categoryGrades[category.id]
                  return sum + (categoryGrade?.percentage || 0)
                }, 0) / filteredGradebookData.length

                return (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                        <Badge variant="outline">{category.weight}%</Badge>
                      </div>
                      <span className={`font-bold ${getGradeColor(categoryAverage)}`}>
                        {categoryAverage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={categoryAverage} 
                      className="h-2"
                      style={{ 
                        '--tw-bg-opacity': '0.2',
                        backgroundColor: category.color + '33' 
                      } as any}
                    />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.missingAssignmentAlerts.slice(0, 5).map(alert => (
                <div key={alert.studentId} className="flex items-center gap-3 p-2 rounded-lg bg-orange-50">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {gradebookData.find(e => e.studentId === alert.studentId)?.studentName}
                    </p>
                    <p className="text-xs text-orange-600">
                      {alert.assignmentIds.length} missing assignment{alert.assignmentIds.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
              
              {analytics?.atRiskStudents.slice(0, 3).map(studentId => (
                <div key={studentId} className="flex items-center gap-3 p-2 rounded-lg bg-red-50">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {gradebookData.find(e => e.studentId === studentId)?.studentName}
                    </p>
                    <p className="text-xs text-red-600">Below 60% - needs attention</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grade Categories Settings Dialog */}
      <GradeCategoriesDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        classId={classId}
        className={className}
        onSettingsSaved={loadGradebookData}
      />
    </div>
  )
} 