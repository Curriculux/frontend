"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Award, TrendingUp, TrendingDown, BarChart3, Calendar, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ploneAPI } from "@/lib/api"
import { useAuth } from "@/lib/auth"

interface StudentGrade {
  assignmentId: string
  assignmentTitle: string
  classId: string
  className?: string
  grade: number
  maxPoints: number
  submittedAt: string
  gradedAt: string
  feedback?: string
  subject?: string
}

interface ClassGradesSummary {
  classId: string
  className: string
  subject?: string
  teacher?: string
  averageGrade: number
  totalPoints: number
  earnedPoints: number
  assignmentCount: number
  grades: StudentGrade[]
  trend: 'up' | 'down' | 'stable'
}

export function StudentGradesView() {
  const [loading, setLoading] = useState(true)
  const [grades, setGrades] = useState<StudentGrade[]>([])
  const [classSummaries, setClassSummaries] = useState<ClassGradesSummary[]>([])
  const [overallGPA, setOverallGPA] = useState(0)
  const { user } = useAuth()

  useEffect(() => {
    loadStudentGrades()
  }, [])

  const loadStudentGrades = async () => {
    try {
      setLoading(true)
      
      // Get all grades for the student
      const studentGrades = await ploneAPI.getStudentGrades(user?.username ?? '')
      
      // Group grades by class
      const gradesByClass = studentGrades.reduce((acc: { [key: string]: StudentGrade[] }, grade) => {
        if (!acc[grade.classId]) {
          acc[grade.classId] = []
        }
        acc[grade.classId].push(grade)
        return acc
      }, {})
      
      // Create class summaries
      const summaries: ClassGradesSummary[] = []
      let totalGPA = 0
      
      for (const [classId, classGrades] of Object.entries(gradesByClass)) {
        const totalPoints = classGrades.reduce((sum, grade) => sum + grade.maxPoints, 0)
        const earnedPoints = classGrades.reduce((sum, grade) => sum + (grade.grade / 100) * grade.maxPoints, 0)
        const averageGrade = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
        
        // Calculate trend (simplified - compare first half vs second half of grades)
        const sortedGrades = classGrades.sort((a, b) => new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime())
        const firstHalf = sortedGrades.slice(0, Math.floor(sortedGrades.length / 2))
        const secondHalf = sortedGrades.slice(Math.floor(sortedGrades.length / 2))
        
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (firstHalf.length > 0 && secondHalf.length > 0) {
          const firstAvg = firstHalf.reduce((sum, g) => sum + g.grade, 0) / firstHalf.length
          const secondAvg = secondHalf.reduce((sum, g) => sum + g.grade, 0) / secondHalf.length
          if (secondAvg > firstAvg + 2) trend = 'up'
          else if (secondAvg < firstAvg - 2) trend = 'down'
        }
        
        summaries.push({
          classId,
          className: classGrades[0]?.className || classId,
          subject: classGrades[0]?.subject,
          averageGrade,
          totalPoints,
          earnedPoints,
          assignmentCount: classGrades.length,
          grades: classGrades,
          trend
        })
        
        totalGPA += averageGrade
      }
      
      setGrades(studentGrades)
      setClassSummaries(summaries)
      setOverallGPA(summaries.length > 0 ? totalGPA / summaries.length : 0)
    } catch (error) {
      console.error('Error loading student grades:', error)
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "text-green-600"
    if (grade >= 80) return "text-blue-600"
    if (grade >= 70) return "text-yellow-600"
    if (grade >= 60) return "text-orange-600"
    return "text-red-600"
  }

  const getGradeBadgeColor = (grade: number) => {
    if (grade >= 90) return "bg-green-100 text-green-800"
    if (grade >= 80) return "bg-blue-100 text-blue-800"
    if (grade >= 70) return "bg-yellow-100 text-yellow-800"
    if (grade >= 60) return "bg-orange-100 text-orange-800"
    return "bg-red-100 text-red-800"
  }

  const getGradeLetter = (grade: number) => {
    if (grade >= 90) return "A"
    if (grade >= 80) return "B"
    if (grade >= 70) return "C"
    if (grade >= 60) return "D"
    return "F"
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />
      default:
        return <BarChart3 className="w-4 h-4 text-slate-600" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Grades</h1>
          <p className="text-slate-600 mt-1">
            Track your academic progress across all classes
          </p>
        </div>
      </div>

      {/* Overall Stats */}
      {classSummaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Overall GPA</p>
                  <p className={`text-3xl font-bold ${getGradeColor(overallGPA)}`}>
                    {overallGPA.toFixed(1)}%
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center`}>
                  <Award className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-4">
                <Badge className={getGradeBadgeColor(overallGPA)}>
                  {getGradeLetter(overallGPA)} Average
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Classes</p>
                  <p className="text-3xl font-bold text-slate-900">{classSummaries.length}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-2">Currently enrolled</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Assignments</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {classSummaries.reduce((sum, cls) => sum + cls.assignmentCount, 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-2">Graded assignments</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Best Class</p>
                  <p className="text-lg font-bold text-green-600">
                    {Math.max(...classSummaries.map(cls => cls.averageGrade)).toFixed(1)}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-2">Highest average</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Class Grades */}
      {classSummaries.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Grades by Class</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {classSummaries.map((classSummary, index) => (
              <motion.div
                key={classSummary.classId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{classSummary.className}</CardTitle>
                        {classSummary.subject && (
                          <p className="text-sm text-slate-600">{classSummary.subject}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(classSummary.trend)}
                        <Badge className={getGradeBadgeColor(classSummary.averageGrade)}>
                          {classSummary.averageGrade.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Progress</span>
                          <span className="font-medium">
                            {classSummary.earnedPoints.toFixed(0)}/{classSummary.totalPoints} points
                          </span>
                        </div>
                        <Progress 
                          value={(classSummary.earnedPoints / classSummary.totalPoints) * 100} 
                          className="h-2" 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-slate-900">Recent Assignments</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {classSummary.grades
                            .sort((a, b) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime())
                            .slice(0, 5)
                            .map((grade) => (
                              <div key={grade.assignmentId} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {grade.assignmentTitle}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(grade.gradedAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${getGradeColor(grade.grade)}`}>
                                    {grade.grade}%
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {((grade.grade / 100) * grade.maxPoints).toFixed(0)}/{grade.maxPoints}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Grades Yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            You don't have any graded assignments yet. Complete and submit assignments to see your grades here.
          </p>
        </div>
      )}
    </div>
  )
} 