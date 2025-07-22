"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Award, Plus, Clock, ChevronRight, BookOpen, Calendar, Users, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ploneAPI } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface Test {
  id: string
  title: string
  description: string
  classId: string
  className: string
  questions: Question[]
  timeLimit?: number
  attempts: number
  status: 'draft' | 'published' | 'archived'
  created: string
  dueDate?: string
}

interface Question {
  id: string
  type: 'multiple-choice' | 'short-answer' | 'essay' | 'true-false'
  question: string
  options?: string[]
  correctAnswer?: string | number
  points: number
}

interface ClassWithTests {
  '@id': string;
  id: string;
  title: string;
  tests: Test[];
}

export function TestsView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classes, setClasses] = useState<ClassWithTests[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const { toast } = useToast()

  const [newTest, setNewTest] = useState({
    title: "",
    description: "",
    classId: "",
    timeLimit: "",
    dueDate: ""
  })

  const loadTestsAndClasses = async () => {
    try {
      setLoading(true)
      
      // First get all classes
      const classesData = await ploneAPI.getClasses()
      
      // Then get tests for each class (for now empty until backend supports it)
      const classesWithTests = classesData.map((cls: any) => ({
        ...cls,
        tests: [] // TODO: Load actual tests when API supports it
      }))
      
      setClasses(classesWithTests)
      
      // Set the first class as selected if none selected
      if (!selectedClassId && classesWithTests.length > 0) {
        setSelectedClassId(classesWithTests[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTestsAndClasses()
  }, [])

  const handleCreateTest = async () => {
    if (!newTest.title || !newTest.classId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    try {
      // In a real implementation, this would call the API
      const test: Test = {
        id: `test-${Date.now()}`,
        title: newTest.title,
        description: newTest.description,
        classId: newTest.classId,
        className: classes.find(c => c.id === newTest.classId)?.title || "",
        questions: [],
        timeLimit: newTest.timeLimit ? parseInt(newTest.timeLimit) : undefined,
        attempts: 0,
        status: 'draft',
        created: new Date().toISOString(),
        dueDate: newTest.dueDate || undefined
      }

      // Add test to the appropriate class
      setClasses(prev => prev.map(cls => 
        cls.id === newTest.classId 
          ? { ...cls, tests: [test, ...cls.tests] }
          : cls
      ))

      setCreateDialogOpen(false)
      setNewTest({ title: "", description: "", classId: "", timeLimit: "", dueDate: "" })
      
      toast({
        title: "Success!",
        description: "Test created successfully."
      })
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to create test. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'default'
      case 'draft':
        return 'secondary'
      case 'archived':
        return 'outline'
      default:
        return 'outline'
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

  const filterTests = (tests: Test[]) => {
    switch (activeTab) {
      case "published":
        return tests.filter(test => test.status === 'published')
      case "draft":
        return tests.filter(test => test.status === 'draft')
      case "archived":
        return tests.filter(test => test.status === 'archived')
      default:
        return tests
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        <span className="ml-2">Loading tests...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading tests</p>
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
          <h1 className="text-3xl font-bold text-slate-900">Tests & Quizzes</h1>
          <p className="text-slate-600 mt-1">
            Create and manage tests across all your classes
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              disabled={classes.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Test
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Test</DialogTitle>
              <DialogDescription>
                Set up a new test or quiz for your students
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Test Title *</Label>
                <Input
                  id="title"
                  value={newTest.title}
                  onChange={(e) => setNewTest({ ...newTest, title: e.target.value })}
                  placeholder="e.g., Chapter 5 Quiz"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="class">Class *</Label>
                <Select
                  value={newTest.classId}
                  onValueChange={(value) => setNewTest({ ...newTest, classId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTest.description}
                  onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                  placeholder="Brief description of the test..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    value={newTest.timeLimit}
                    onChange={(e) => setNewTest({ ...newTest, timeLimit: e.target.value })}
                    placeholder="e.g., 30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="datetime-local"
                    value={newTest.dueDate}
                    onChange={(e) => setNewTest({ ...newTest, dueDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTest}>
                Create Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {classes.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-12">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Classes Yet</h3>
            <p className="text-slate-600 mb-6">
              Create a class first before adding tests
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
                      {cls.tests.length}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Tests List */}
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
                      <TabsTrigger value="published">Published</TabsTrigger>
                      <TabsTrigger value="draft">Draft</TabsTrigger>
                      <TabsTrigger value="archived">Archived</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {selectedClass && (
                  <div className="space-y-4">
                    {filterTests(selectedClass.tests).length === 0 ? (
                      <div className="text-center py-12">
                        <Award className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600">
                          {activeTab === "all" 
                            ? "No tests yet"
                            : `No ${activeTab} tests`
                          }
                        </p>
                      </div>
                    ) : (
                      filterTests(selectedClass.tests).map((test, index) => (
                        <motion.div
                          key={test.id || `test-${index}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="group"
                        >
                          <Card 
                            className="border hover:border-purple-200 transition-colors cursor-pointer"
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg text-slate-900 group-hover:text-purple-600 transition-colors">
                                    {test.title}
                                  </h3>
                                  {test.description && (
                                    <p className="text-sm text-slate-600 mt-1">
                                      {test.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                                    {test.timeLimit && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        <span>{test.timeLimit} min</span>
                                      </div>
                                    )}
                                    {test.dueDate && (
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        <span>{new Date(test.dueDate).toLocaleDateString()}</span>
                                      </div>
                                    )}
                                    {test.attempts > 0 && (
                                      <div className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        <span>{test.attempts} attempts</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={getStatusColor(test.status) as any}>
                                    {test.status}
                                  </Badge>
                                  {test.dueDate && (() => {
                                    const status = getDueDateStatus(test.dueDate)
                                    return status ? (
                                      <Badge variant={status.color as any}>
                                        {status.text}
                                      </Badge>
                                    ) : null
                                  })()}
                                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
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
    </div>
  )
} 