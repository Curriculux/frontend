"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  BookOpen, 
  FileText, 
  FolderOpen, 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X,
  Settings,
  Percent,
  Target,
  Palette,
  Info,
  Calculator
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { WeightedCategory, GradebookSettings, GradingScale } from "@/types/gradebook"
import { gradebookAPI } from "@/lib/gradebook-api"
import { toast } from "sonner"

interface GradeCategoriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
  className?: string
  onSettingsSaved?: () => void
}

const CATEGORY_ICONS = [
  { value: 'BookOpen', label: 'Book', icon: BookOpen },
  { value: 'FileText', label: 'Document', icon: FileText },
  { value: 'FolderOpen', label: 'Folder', icon: FolderOpen },
  { value: 'Users', label: 'People', icon: Users },
  { value: 'Target', label: 'Target', icon: Target },
  { value: 'Calculator', label: 'Calculator', icon: Calculator }
]

const CATEGORY_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6366F1'  // Indigo
]

export function GradeCategoriesDialog({
  open,
  onOpenChange,
  classId,
  className,
  onSettingsSaved
}: GradeCategoriesDialogProps) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<GradebookSettings | null>(null)
  const [editingCategory, setEditingCategory] = useState<WeightedCategory | null>(null)
  const [newCategory, setNewCategory] = useState<Partial<WeightedCategory>>({
    name: '',
    weight: 0,
    dropLowest: 0,
    color: CATEGORY_COLORS[0],
    icon: 'BookOpen'
  })

  useEffect(() => {
    if (open && classId) {
      loadSettings()
    }
  }, [open, classId])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const gradebookSettings = await gradebookAPI.getGradebookSettings(classId)
      setSettings(gradebookSettings)
    } catch (error) {
      console.error('Error loading gradebook settings:', error)
      toast.error('Failed to load gradebook settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    try {
      setLoading(true)
      await gradebookAPI.saveGradebookSettings(settings)
      toast.success('Gradebook settings saved successfully!')
      onSettingsSaved?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save gradebook settings')
    } finally {
      setLoading(false)
    }
  }

  const addCategory = async () => {
    if (!settings || !newCategory.name || !newCategory.weight) {
      toast.error('Please fill in all required fields')
      return
    }

    const category: WeightedCategory = {
      id: newCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: newCategory.name,
      weight: newCategory.weight,
      dropLowest: newCategory.dropLowest || 0,
      color: newCategory.color || CATEGORY_COLORS[0],
      icon: newCategory.icon || 'BookOpen'
    }

    const updatedSettings = {
      ...settings,
      categories: [...settings.categories, category]
    }

    setSettings(updatedSettings)
    setNewCategory({
      name: '',
      weight: 0,
      dropLowest: 0,
      color: CATEGORY_COLORS[0],
      icon: 'BookOpen'
    })

    toast.success('Category added successfully!')
  }

  const updateCategory = (categoryId: string, updates: Partial<WeightedCategory>) => {
    if (!settings) return

    const updatedCategories = settings.categories.map(cat =>
      cat.id === categoryId ? { ...cat, ...updates } : cat
    )

    setSettings({
      ...settings,
      categories: updatedCategories
    })
  }

  const deleteCategory = (categoryId: string) => {
    if (!settings) return

    const updatedCategories = settings.categories.filter(cat => cat.id !== categoryId)
    setSettings({
      ...settings,
      categories: updatedCategories
    })

    toast.success('Category deleted successfully!')
  }

  const getTotalWeight = () => {
    if (!settings) return 0
    return settings.categories.reduce((sum, cat) => sum + cat.weight, 0)
  }

  const getIconComponent = (iconName: string) => {
    const iconData = CATEGORY_ICONS.find(i => i.value === iconName)
    return iconData?.icon || BookOpen
  }

  if (loading && !settings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Grade Categories & Settings
            </DialogTitle>
            <DialogDescription>
              Loading gradebook settings...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Grade Categories & Settings
          </DialogTitle>
          <DialogDescription>
            Configure weighted grade categories and grading settings for {className || 'your class'}
          </DialogDescription>
        </DialogHeader>

        {settings && (
          <Tabs defaultValue="categories" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="scale">Grading Scale</TabsTrigger>
              <TabsTrigger value="policies">Policies</TabsTrigger>
            </TabsList>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-6">
              {/* Weight Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-5 h-5" />
                    Weight Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Weight:</span>
                      <Badge variant={getTotalWeight() === 100 ? 'default' : 'destructive'}>
                        {getTotalWeight()}%
                      </Badge>
                    </div>
                    <Progress value={getTotalWeight()} className="h-3" />
                    {getTotalWeight() !== 100 && (
                      <Alert>
                        <Info className="w-4 h-4" />
                        <AlertDescription>
                          Total weight should equal 100% for accurate grade calculations.
                          {getTotalWeight() > 100 && ' Please reduce some category weights.'}
                          {getTotalWeight() < 100 && ' Please increase some category weights.'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Existing Categories */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Current Categories</h3>
                  <Badge variant="outline">{settings.categories.length} categories</Badge>
                </div>

                {settings.categories.map((category) => {
                  const IconComponent = getIconComponent(category.icon)
                  const isEditing = editingCategory?.id === category.id

                  return (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group"
                    >
                      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            {/* Category Icon & Color */}
                            <div 
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
                              style={{ backgroundColor: category.color }}
                            >
                              <IconComponent className="w-6 h-6" />
                            </div>

                            {/* Category Details */}
                            <div className="flex-1 space-y-3">
                              {isEditing ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div>
                                    <Label className="text-xs">Name</Label>
                                    <Input
                                      value={editingCategory.name}
                                      onChange={(e) => setEditingCategory({
                                        ...editingCategory,
                                        name: e.target.value
                                      })}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Weight (%)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={editingCategory.weight}
                                      onChange={(e) => setEditingCategory({
                                        ...editingCategory,
                                        weight: parseInt(e.target.value) || 0
                                      })}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Drop Lowest</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="10"
                                      value={editingCategory.dropLowest}
                                      onChange={(e) => setEditingCategory({
                                        ...editingCategory,
                                        dropLowest: parseInt(e.target.value) || 0
                                      })}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Color</Label>
                                    <div className="flex gap-1">
                                      {CATEGORY_COLORS.slice(0, 5).map(color => (
                                        <button
                                          key={color}
                                          onClick={() => setEditingCategory({
                                            ...editingCategory,
                                            color
                                          })}
                                          className={`w-6 h-6 rounded border-2 ${
                                            editingCategory.color === color ? 'border-gray-800' : 'border-gray-300'
                                          }`}
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-semibold text-lg">{category.name}</h4>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Percent className="w-3 h-3" />
                                        {category.weight}% weight
                                      </span>
                                      {category.dropLowest > 0 && (
                                        <span className="flex items-center gap-1">
                                          <Target className="w-3 h-3" />
                                          Drop {category.dropLowest} lowest
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline" 
                                      className="text-white border-white"
                                      style={{ backgroundColor: category.color }}
                                    >
                                      {category.weight}%
                                    </Badge>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      updateCategory(category.id, editingCategory)
                                      setEditingCategory(null)
                                    }}
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingCategory(null)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingCategory(category)}
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteCategory(category.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>

              <Separator />

              {/* Add New Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add New Category
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="new-name">Category Name *</Label>
                      <Input
                        id="new-name"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        placeholder="e.g., Labs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-weight">Weight (%) *</Label>
                      <Input
                        id="new-weight"
                        type="number"
                        min="0"
                        max="100"
                        value={newCategory.weight || ''}
                        onChange={(e) => setNewCategory({ ...newCategory, weight: parseInt(e.target.value) || 0 })}
                        placeholder="15"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-drop">Drop Lowest</Label>
                      <Input
                        id="new-drop"
                        type="number"
                        min="0"
                        max="10"
                        value={newCategory.dropLowest || ''}
                        onChange={(e) => setNewCategory({ ...newCategory, dropLowest: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-icon">Icon</Label>
                      <Select 
                        value={newCategory.icon} 
                        onValueChange={(value) => setNewCategory({ ...newCategory, icon: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_ICONS.map(icon => {
                            const IconComponent = icon.icon
                            return (
                              <SelectItem key={icon.value} value={icon.value}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="w-4 h-4" />
                                  {icon.label}
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2 mt-1">
                      {CATEGORY_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewCategory({ ...newCategory, color })}
                          className={`w-8 h-8 rounded-lg border-2 ${
                            newCategory.color === color ? 'border-gray-800' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <Button onClick={addCategory} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Grading Scale Tab */}
            <TabsContent value="scale" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Letter Grade Scale</CardTitle>
                  <CardDescription>
                    Configure the percentage ranges for letter grades
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {settings.gradingScale.ranges.map((range, index) => (
                      <div key={range.letter} className="flex items-center gap-4 p-3 rounded-lg border">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: range.color }}
                        >
                          {range.letter}
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs">Min %</Label>
                            <Input
                              type="number"
                              value={range.min}
                              onChange={(e) => {
                                const newRanges = [...settings.gradingScale.ranges]
                                newRanges[index] = { ...range, min: parseInt(e.target.value) || 0 }
                                setSettings({
                                  ...settings,
                                  gradingScale: { ...settings.gradingScale, ranges: newRanges }
                                })
                              }}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Max %</Label>
                            <Input
                              type="number"
                              value={range.max}
                              onChange={(e) => {
                                const newRanges = [...settings.gradingScale.ranges]
                                newRanges[index] = { ...range, max: parseInt(e.target.value) || 0 }
                                setSettings({
                                  ...settings,
                                  gradingScale: { ...settings.gradingScale, ranges: newRanges }
                                })
                              }}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">GPA Points</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={range.gpa}
                              onChange={(e) => {
                                const newRanges = [...settings.gradingScale.ranges]
                                newRanges[index] = { ...range, gpa: parseFloat(e.target.value) || 0 }
                                setSettings({
                                  ...settings,
                                  gradingScale: { ...settings.gradingScale, ranges: newRanges }
                                })
                              }}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Policies Tab */}
            <TabsContent value="policies" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Late Submission Policy */}
                <Card>
                  <CardHeader>
                    <CardTitle>Late Submission Policy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="allow-late"
                        checked={settings.allowLateSubmissions}
                        onChange={(e) => setSettings({
                          ...settings,
                          allowLateSubmissions: e.target.checked
                        })}
                      />
                      <Label htmlFor="allow-late">Allow late submissions</Label>
                    </div>
                    
                    {settings.allowLateSubmissions && (
                      <>
                        <div>
                          <Label htmlFor="late-penalty">Daily Penalty (%)</Label>
                          <Input
                            id="late-penalty"
                            type="number"
                            min="0"
                            max="100"
                            value={settings.latePenalty}
                            onChange={(e) => setSettings({
                              ...settings,
                              latePenalty: parseInt(e.target.value) || 0
                            })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-late-days">Maximum Late Days</Label>
                          <Input
                            id="max-late-days"
                            type="number"
                            min="0"
                            max="30"
                            value={settings.maxLateDays}
                            onChange={(e) => setSettings({
                              ...settings,
                              maxLateDays: parseInt(e.target.value) || 0
                            })}
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Grade Display Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Grade Display</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="rounding">Rounding Method</Label>
                      <Select 
                        value={settings.roundingMethod} 
                        onValueChange={(value: any) => setSettings({
                          ...settings,
                          roundingMethod: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Rounding</SelectItem>
                          <SelectItem value="round">Round to Nearest</SelectItem>
                          <SelectItem value="floor">Round Down</SelectItem>
                          <SelectItem value="ceil">Round Up</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="show-grades"
                        checked={settings.showStudentGrades}
                        onChange={(e) => setSettings({
                          ...settings,
                          showStudentGrades: e.target.checked
                        })}
                      />
                      <Label htmlFor="show-grades">Show grades to students</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="parent-notifications"
                        checked={settings.parentNotifications}
                        onChange={(e) => setSettings({
                          ...settings,
                          parentNotifications: e.target.checked
                        })}
                      />
                      <Label htmlFor="parent-notifications">Send parent notifications</Label>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSettings}>
              Reset Changes
            </Button>
            <Button onClick={saveSettings} disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 