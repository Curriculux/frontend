"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Target, 
  Award, 
  BookOpen, 
  Save, 
  Copy,
  Loader2,
  Star,
  AlertCircle,
  CheckCircle,
  Lightbulb
} from "lucide-react"
import { AssignmentRubric, RubricCriteria, RubricLevel } from "@/types/gradebook"
import { gradebookAPI } from "@/lib/gradebook-api"
import { toast } from "sonner"

interface RubricCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
  existingRubric?: AssignmentRubric | null
  onRubricSaved: (rubric: AssignmentRubric) => void
}

const DEFAULT_LEVELS: RubricLevel[] = [
  { score: 4, label: "Exceeds Expectations", description: "Demonstrates exceptional understanding and skill", points: 4 },
  { score: 3, label: "Meets Expectations", description: "Demonstrates solid understanding and skill", points: 3 },
  { score: 2, label: "Approaching Expectations", description: "Demonstrates developing understanding and skill", points: 2 },
  { score: 1, label: "Below Expectations", description: "Demonstrates limited understanding and skill", points: 1 }
]

const DEFAULT_CRITERIA: RubricCriteria = {
  id: '',
  name: '',
  description: '',
  weight: 1,
  levels: [...DEFAULT_LEVELS],
  standardsAlignment: []
}

export function RubricCreationDialog({
  open,
  onOpenChange,
  classId,
  existingRubric,
  onRubricSaved
}: RubricCreationDialogProps) {
  const [loading, setLoading] = useState(false)
  const [rubricData, setRubricData] = useState<AssignmentRubric>({
    id: '',
    title: '',
    description: '',
    criteria: [{ ...DEFAULT_CRITERIA, id: crypto.randomUUID() }],
    totalPoints: 0,
    masteryThreshold: 75,
    createdBy: 'teacher', // TODO: Get from auth context
    createdAt: new Date().toISOString(),
    isTemplate: false
  })
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    if (open && existingRubric) {
      setRubricData(existingRubric)
    } else if (open && !existingRubric) {
      // Reset to default when creating new
      setRubricData({
        id: crypto.randomUUID(),
        title: '',
        description: '',
        criteria: [{ ...DEFAULT_CRITERIA, id: crypto.randomUUID() }],
        totalPoints: 0,
        masteryThreshold: 75,
        createdBy: 'teacher',
        createdAt: new Date().toISOString(),
        isTemplate: false
      })
    }
  }, [open, existingRubric])

  useEffect(() => {
    // Calculate total points whenever criteria change
    const total = rubricData.criteria.reduce((sum, criteria) => {
      const maxPoints = Math.max(...criteria.levels.map(level => level.points))
      return sum + (maxPoints * criteria.weight)
    }, 0)
    
    if (total !== rubricData.totalPoints) {
      setRubricData(prev => ({ ...prev, totalPoints: total }))
    }
  }, [rubricData.criteria])

  const handleAddCriteria = () => {
    const newCriteria = { ...DEFAULT_CRITERIA, id: crypto.randomUUID() }
    setRubricData(prev => ({
      ...prev,
      criteria: [...prev.criteria, newCriteria]
    }))
  }

  const handleRemoveCriteria = (criteriaId: string) => {
    setRubricData(prev => ({
      ...prev,
      criteria: prev.criteria.filter(c => c.id !== criteriaId)
    }))
  }

  const handleCriteriaChange = (criteriaId: string, field: keyof RubricCriteria, value: any) => {
    setRubricData(prev => ({
      ...prev,
      criteria: prev.criteria.map(c => 
        c.id === criteriaId ? { ...c, [field]: value } : c
      )
    }))
  }

  const handleLevelChange = (criteriaId: string, levelIndex: number, field: keyof RubricLevel, value: any) => {
    setRubricData(prev => ({
      ...prev,
      criteria: prev.criteria.map(c => 
        c.id === criteriaId 
          ? {
              ...c,
              levels: c.levels.map((level, index) => 
                index === levelIndex ? { ...level, [field]: value } : level
              )
            }
          : c
      )
    }))
  }

  const handleSave = async () => {
    if (!rubricData.title.trim()) {
      toast.error('Please enter a rubric title')
      return
    }

    if (rubricData.criteria.length === 0) {
      toast.error('Please add at least one criteria')
      return
    }

    // Validate criteria
    for (const criteria of rubricData.criteria) {
      if (!criteria.name.trim()) {
        toast.error('All criteria must have a name')
        return
      }
    }

    setLoading(true)
    try {
      const savedRubric = await gradebookAPI.saveAssignmentRubric(classId, rubricData)
      toast.success('Rubric saved successfully!')
      onRubricSaved(savedRubric)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving rubric:', error)
      toast.error('Failed to save rubric')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] w-[95vw] h-[95vh]" style={{ maxWidth: '95vw', maxHeight: '95vh', width: '95vw', height: '95vh' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            {existingRubric ? 'Edit Rubric' : 'Create New Rubric'}
          </DialogTitle>
          <DialogDescription>
            Design a detailed rubric to assess student work with multiple criteria and performance levels.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="criteria">Criteria & Levels</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <TabsContent value="overview" className="space-y-6 p-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Rubric Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Essay Writing Rubric"
                    value={rubricData.title}
                    onChange={(e) => setRubricData(prev => ({ ...prev, title: e.target.value }))}
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this rubric assesses..."
                    value={rubricData.description}
                    onChange={(e) => setRubricData(prev => ({ ...prev, description: e.target.value }))}
                    disabled={loading}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="mastery">Mastery Threshold (%)</Label>
                    <Input
                      id="mastery"
                      type="number"
                      min="0"
                      max="100"
                      value={rubricData.masteryThreshold}
                      onChange={(e) => setRubricData(prev => ({ 
                        ...prev, 
                        masteryThreshold: parseInt(e.target.value) || 0 
                      }))}
                      disabled={loading}
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <Switch
                      checked={rubricData.isTemplate}
                      onCheckedChange={(checked) => setRubricData(prev => ({ 
                        ...prev, 
                        isTemplate: checked 
                      }))}
                      disabled={loading}
                    />
                    <Label>Save as template for reuse</Label>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Rubric Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total Criteria:</span>
                        <p className="text-muted-foreground">{rubricData.criteria.length}</p>
                      </div>
                      <div>
                        <span className="font-medium">Total Points:</span>
                        <p className="text-muted-foreground">{rubricData.totalPoints}</p>
                      </div>
                      <div>
                        <span className="font-medium">Mastery Score:</span>
                        <p className="text-muted-foreground">
                          {Math.round((rubricData.totalPoints * rubricData.masteryThreshold) / 100)} points
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="criteria" className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Assessment Criteria</h3>
                <Button onClick={handleAddCriteria} size="sm" disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Criteria
                </Button>
              </div>

              <div className="space-y-8">
                {rubricData.criteria.map((criteria, index) => (
                  <Card key={criteria.id} className="shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-5 h-5 text-muted-foreground" />
                          <CardTitle className="text-lg">Criteria {index + 1}</CardTitle>
                        </div>
                        {rubricData.criteria.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveCriteria(criteria.id)}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="grid gap-3">
                          <Label className="text-sm font-medium">Criteria Name *</Label>
                          <Input
                            placeholder="e.g., Content Quality"
                            value={criteria.name}
                            onChange={(e) => handleCriteriaChange(criteria.id, 'name', e.target.value)}
                            disabled={loading}
                            className="h-10"
                          />
                        </div>
                        <div className="grid gap-3">
                          <Label className="text-sm font-medium">Weight</Label>
                          <Select
                            value={criteria.weight.toString()}
                            onValueChange={(value) => handleCriteriaChange(criteria.id, 'weight', parseInt(value))}
                            disabled={loading}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1x (Normal)</SelectItem>
                              <SelectItem value="2">2x (Important)</SelectItem>
                              <SelectItem value="3">3x (Very Important)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <Label className="text-sm font-medium">Description</Label>
                        <Textarea
                          placeholder="Describe what this criteria assesses..."
                          value={criteria.description}
                          onChange={(e) => handleCriteriaChange(criteria.id, 'description', e.target.value)}
                          disabled={loading}
                          rows={3}
                          className="min-h-[80px]"
                        />
                      </div>

                      <div className="space-y-4">
                        <Label>Performance Levels</Label>
                        <div className="grid gap-4">
                          {criteria.levels.map((level, levelIndex) => (
                            <div key={levelIndex} className="grid grid-cols-4 gap-4 p-4 border rounded-lg bg-gray-50">
                              <div className="grid gap-1">
                                <Label className="text-xs">Score</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="4"
                                  value={level.score}
                                  onChange={(e) => handleLevelChange(criteria.id, levelIndex, 'score', parseInt(e.target.value) || 1)}
                                  disabled={loading}
                                />
                              </div>
                              <div className="grid gap-1">
                                <Label className="text-xs">Points</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={level.points}
                                  onChange={(e) => handleLevelChange(criteria.id, levelIndex, 'points', parseInt(e.target.value) || 0)}
                                  disabled={loading}
                                />
                              </div>
                              <div className="grid gap-1">
                                <Label className="text-xs">Label</Label>
                                <Input
                                  value={level.label}
                                  onChange={(e) => handleLevelChange(criteria.id, levelIndex, 'label', e.target.value)}
                                  disabled={loading}
                                />
                              </div>
                              <div className="grid gap-1">
                                <Label className="text-xs">Description</Label>
                                <Input
                                  value={level.description}
                                  onChange={(e) => handleLevelChange(criteria.id, levelIndex, 'description', e.target.value)}
                                  disabled={loading}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-6 p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{rubricData.title || 'Untitled Rubric'}</h3>
                  {rubricData.description && (
                    <p className="text-muted-foreground mt-1">{rubricData.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <Badge variant="outline">
                    <Target className="w-3 h-3 mr-1" />
                    {rubricData.criteria.length} Criteria
                  </Badge>
                  <Badge variant="outline">
                    <Star className="w-3 h-3 mr-1" />
                    {rubricData.totalPoints} Total Points
                  </Badge>
                  <Badge variant="outline">
                    <Award className="w-3 h-3 mr-1" />
                    {rubricData.masteryThreshold}% Mastery
                  </Badge>
                </div>

                {/* Rubric Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="text-left p-4 font-medium text-slate-700 min-w-[200px] border-r">
                          Criteria
                        </th>
                        {/* Get performance levels from first criteria (assuming all criteria have same levels) */}
                        {rubricData.criteria.length > 0 && 
                          rubricData.criteria[0].levels
                            .sort((a, b) => b.score - a.score)
                            .map((level, index) => (
                              <th key={index} className="text-center p-4 font-medium text-slate-700 min-w-[120px] border-r last:border-r-0">
                                <div className="space-y-1">
                                  <div className="font-semibold">{level.label}</div>
                                  <Badge variant={level.score >= 3 ? "default" : "secondary"} className="text-xs">
                                    {level.points} pts
                                  </Badge>
                                </div>
                              </th>
                            ))
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {rubricData.criteria.map((criteria, criteriaIndex) => (
                        <tr key={criteria.id} className="border-b hover:bg-slate-50/50">
                          <td className="p-4 border-r bg-slate-25">
                            <div className="space-y-1">
                              <div className="font-medium flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                {criteria.name || `Criteria ${criteriaIndex + 1}`}
                                {criteria.weight > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {criteria.weight}x
                                  </Badge>
                                )}
                              </div>
                              {criteria.description && (
                                <p className="text-sm text-muted-foreground">{criteria.description}</p>
                              )}
                            </div>
                          </td>
                          {criteria.levels
                            .sort((a, b) => b.score - a.score)
                            .map((level, levelIndex) => (
                              <td key={levelIndex} className="p-4 border-r last:border-r-0 text-sm align-top">
                                <div className="space-y-1">
                                  <div className="text-muted-foreground">
                                    {level.description}
                                  </div>
                                </div>
                              </td>
                            ))
                          }
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {rubricData.criteria.length} criteria • {rubricData.totalPoints} total points
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Rubric
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 