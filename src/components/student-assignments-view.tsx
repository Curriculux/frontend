"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FileText, Clock, CheckCircle, AlertTriangle, Calendar, Upload, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ploneAPI } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { AssignmentSubmissionDialog } from "./assignment-submission-dialog"
import { AssignmentDetailsModal } from "./assignment-details-modal"
import { toast } from "sonner"

interface StudentAssignment {
  '@id': string
  id: string
  title: string
  description: string
  dueDate?: string
  points?: number
  classId: string
  className?: string
  status: 'pending' | 'submitted' | 'graded' | 'overdue'
  grade?: number
  submittedAt?: string
  feedback?: string
  instructions?: string
}

export function StudentAssignmentsView() {
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<StudentAssignment[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignment | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    loadStudentAssignments()
  }, [])

  const loadStudentAssignments = async () => {
    try {
      setLoading(true)
      
      // Get all assignments for the student across all classes
      const studentAssignments = await ploneAPI.getStudentAssignments(user?.username ?? '')
      
      setAssignments(studentAssignments)
    } catch (error) {
      console.error('Error loading student assignments:', error)
      toast.error('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitAssignment = (assignment: StudentAssignment) => {
    setSelectedAssignment(assignment)
    setSubmissionDialogOpen(true)
  }

  const handleViewAssignment = (assignment: StudentAssignment) => {
    setSelectedAssignment(assignment)
    setDetailsModalOpen(true)
  }

  const handleSubmissionComplete = () => {
    // The success message is now handled in the submission dialog
    setSubmissionDialogOpen(false)
    setSelectedAssignment(null)
    // Reload assignments to reflect new submission status
    loadStudentAssignments()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'graded':
        return <CheckCircle className="w-5 h-5 text-blue-600" />
      case 'overdue':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-orange-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-100 text-green-800'
      case 'graded':
        return 'bg-blue-100 text-blue-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-orange-100 text-orange-800'
    }
  }

  const filterAssignments = (status: string) => {
    if (status === 'all') return assignments
    return assignments.filter(assignment => assignment.status === status)
  }

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "text-green-600"
    if (grade >= 80) return "text-blue-600"
    if (grade >= 70) return "text-yellow-600"
    if (grade >= 60) return "text-orange-600"
    return "text-red-600"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  const assignmentCounts = {
    all: assignments.length,
    pending: assignments.filter(a => a.status === 'pending').length,
    submitted: assignments.filter(a => a.status === 'submitted').length,
    graded: assignments.filter(a => a.status === 'graded').length,
    overdue: assignments.filter(a => a.status === 'overdue').length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Assignments</h1>
        <p className="text-slate-600 mt-1">
          You have {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} across all classes
        </p>
      </div>

      {/* Assignments List */}
      {assignments.length > 0 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({assignmentCounts.all})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({assignmentCounts.pending})</TabsTrigger>
            <TabsTrigger value="submitted">Submitted ({assignmentCounts.submitted})</TabsTrigger>
            <TabsTrigger value="graded">Graded ({assignmentCounts.graded})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({assignmentCounts.overdue})</TabsTrigger>
          </TabsList>

          {['all', 'pending', 'submitted', 'graded', 'overdue'].map(status => (
            <TabsContent key={status} value={status} className="mt-6">
              <div className="space-y-4">
                {filterAssignments(status).map((assignment, index) => (
                  <motion.div
                    key={assignment['@id']}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="flex-shrink-0 mt-1">
                              {getStatusIcon(assignment.status)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="text-lg font-semibold text-slate-900 truncate">
                                    {assignment.title}
                                  </h3>
                                  <p className="text-sm text-slate-600">
                                    {assignment.className || assignment.classId}
                                  </p>
                                </div>
                                <Badge className={getStatusColor(assignment.status)}>
                                  {assignment.status}
                                </Badge>
                              </div>
                              
                              {assignment.description && (
                                <p className="text-sm text-slate-700 mb-3 line-clamp-2">
                                  {assignment.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                {assignment.dueDate && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                                  </div>
                                )}
                                
                                {assignment.points && (
                                  <div className="flex items-center gap-1">
                                    <FileText className="w-4 h-4" />
                                    <span>{assignment.points} points</span>
                                  </div>
                                )}
                                
                                {assignment.grade !== undefined && (
                                  <div className="flex items-center gap-1">
                                    <span>Grade:</span>
                                    <span className={`font-bold ${getGradeColor(assignment.grade)}`}>
                                      {assignment.grade}%
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {assignment.submittedAt && (
                                <div className="text-xs text-slate-500 mt-2">
                                  Submitted: {new Date(assignment.submittedAt).toLocaleString()}
                                </div>
                              )}
                              
                              {assignment.feedback && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                  <p className="text-sm text-blue-900 font-medium mb-1">Teacher Feedback:</p>
                                  <p className="text-sm text-blue-800">{assignment.feedback}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 ml-4">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewAssignment(assignment)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                            
                            {assignment.status === 'pending' && (
                              <Button 
                                size="sm"
                                onClick={() => handleSubmitAssignment(assignment)}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Submit
                              </Button>
                            )}
                            
                            {assignment.status === 'overdue' && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleSubmitAssignment(assignment)}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Submit Late
                              </Button>
                            )}
                            
                            {(assignment.status === 'submitted' || assignment.status === 'graded') && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleSubmitAssignment(assignment)}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Resubmit
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
                
                {filterAssignments(status).length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      No {status === 'all' ? '' : status} assignments
                    </h3>
                    <p className="text-slate-600">
                      {status === 'all' 
                        ? "You don't have any assignments yet."
                        : `You don't have any ${status} assignments.`
                      }
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Assignments Yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            You don't have any assignments yet. Check back later or contact your teachers if you think this is an error.
          </p>
        </div>
      )}

      {/* Assignment Submission Dialog */}
      {selectedAssignment && (
        <AssignmentSubmissionDialog
          open={submissionDialogOpen}
          onOpenChange={setSubmissionDialogOpen}
          assignment={{
            id: selectedAssignment.id,
            title: selectedAssignment.title,
            description: selectedAssignment.description,
            classId: selectedAssignment.classId,
            dueDate: selectedAssignment.dueDate,
            points: selectedAssignment.points,
            status: selectedAssignment.status
          }}
          onSubmissionComplete={handleSubmissionComplete}
        />
      )}

      {/* Assignment Details Modal */}
      {selectedAssignment && (
        <AssignmentDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          assignment={{
            '@id': selectedAssignment['@id'],
            id: selectedAssignment.id,
            title: selectedAssignment.title,
            description: selectedAssignment.description,
            classId: selectedAssignment.classId,
            dueDate: selectedAssignment.dueDate,
            points: selectedAssignment.points,
            created: '',
            modified: '',
            instructions: selectedAssignment.instructions
          }}
          onAssignmentUpdated={() => {}}
          onAssignmentDeleted={() => {}}
        />
      )}
    </div>
  )
} 