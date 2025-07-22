"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FileText, Plus, Calendar, Clock, Loader2, ChevronRight, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ploneAPI } from "@/lib/api"
import { CreateAssignmentDialog } from "./create-assignment-dialog"
import { AssignmentDetailsModal } from "./assignment-details-modal"

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
}

interface ClassWithAssignments {
  '@id': string;
  id: string;
  title: string;
  assignments: Assignment[];
}

export function AssignmentsView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classes, setClasses] = useState<ClassWithAssignments[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  const loadAssignments = async () => {
    try {
      setLoading(true)
      
      // First get all classes
      const classesData = await ploneAPI.getClasses()
      
      // Then get assignments for each class
      const classesWithAssignments = await Promise.all(
        classesData.map(async (cls: any) => {
          const assignments = await ploneAPI.getAssignments(cls.id)
          return {
            ...cls,
            assignments: assignments
          }
        })
      )
      
      setClasses(classesWithAssignments)
      
      // Set the first class as selected if none selected
      if (!selectedClassId && classesWithAssignments.length > 0) {
        setSelectedClassId(classesWithAssignments[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [])

  const handleAssignmentCreated = () => {
    loadAssignments()
    setCreateDialogOpen(false)
  }

  const handleAssignmentClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
    setDetailsModalOpen(true)
  }

  const handleAssignmentUpdated = () => {
    loadAssignments()
  }

  const handleAssignmentDeleted = () => {
    loadAssignments()
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

  const filterAssignments = (assignments: Assignment[]) => {
    const now = new Date()
    
    switch (activeTab) {
      case "upcoming":
        return assignments.filter(a => {
          if (!a.dueDate) return false
          const due = new Date(a.dueDate)
          return due >= now
        })
      case "past":
        return assignments.filter(a => {
          if (!a.dueDate) return false
          const due = new Date(a.dueDate)
          return due < now
        })
      default:
        return assignments
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading assignments...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading assignments</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  const selectedClass = classes.find(c => c.id === selectedClassId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Assignments</h1>
          <p className="text-slate-600 mt-1">
            Manage assignments across all your classes
          </p>
        </div>
        <Button 
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          onClick={() => setCreateDialogOpen(true)}
          disabled={classes.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Assignment
        </Button>
      </div>

      {classes.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-12">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Classes Yet</h3>
            <p className="text-slate-600 mb-6">
              Create a class first before adding assignments
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/classes'}>
              Go to Classes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Class List */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classes</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {classes.map((cls) => (
                  <Button
                    key={cls['@id'] || cls.id || cls.title}
                    variant={selectedClassId === cls.id ? "default" : "ghost"}
                    className="w-full justify-between mb-1"
                    onClick={() => setSelectedClassId(cls.id)}
                  >
                    <span className="truncate">{cls.title}</span>
                    <Badge variant="secondary" className="ml-2">
                      {cls.assignments.length}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Assignments List */}
          <div className="lg:col-span-3">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {selectedClass?.title || 'Select a Class'}
                  </CardTitle>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                      <TabsTrigger value="past">Past Due</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {selectedClass && (
                  <div className="space-y-4">
                    {filterAssignments(selectedClass.assignments).length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600">
                          {activeTab === "all" 
                            ? "No assignments yet"
                            : `No ${activeTab} assignments`
                          }
                        </p>
                      </div>
                    ) : (
                      filterAssignments(selectedClass.assignments).map((assignment, index) => (
                        <motion.div
                          key={assignment['@id'] || assignment.id || `assignment-${index}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="group"
                        >
                          <Card 
                            className="border hover:border-blue-200 transition-colors cursor-pointer"
                            onClick={() => handleAssignmentClick(assignment)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                                    {assignment.title}
                                  </h3>
                                  {assignment.description && (
                                    <p className="text-sm text-slate-600 mt-1">
                                      {assignment.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                                    {assignment.dueDate && (
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        <span>{new Date(assignment.dueDate).toLocaleDateString()}</span>
                                      </div>
                                    )}
                                    {assignment.points && (
                                      <div className="flex items-center gap-1">
                                        <span>{assignment.points} points</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {assignment.dueDate && (() => {
                                    const status = getDueDateStatus(assignment.dueDate)
                                    return status ? (
                                      <Badge variant={status.color as any}>
                                        {status.text}
                                      </Badge>
                                    ) : null
                                  })()}
                                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Create Assignment Dialog */}
      <CreateAssignmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAssignmentCreated={handleAssignmentCreated}
        classes={classes}
        defaultClassId={selectedClassId}
      />

      {/* Assignment Details Modal */}
      <AssignmentDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        assignment={selectedAssignment}
        onAssignmentUpdated={handleAssignmentUpdated}
        onAssignmentDeleted={handleAssignmentDeleted}
      />
    </div>
  )
}
