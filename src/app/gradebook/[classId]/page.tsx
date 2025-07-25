'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { EnhancedGradebookView } from '@/components/enhanced-gradebook-view'
import { GradeCategoriesDialog } from '@/components/grade-categories-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ArrowLeft, 
  Settings, 
  Download, 
  Upload, 
  Filter,
  Calculator,
  Users,
  BookOpen
} from 'lucide-react'
import { ploneAPI } from '@/lib/api'
import { gradebookAPI } from '@/lib/gradebook-api'

export default function GradebookPage() {
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string
  
  const [classData, setClassData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (classId) {
      loadClassData()
    }
  }, [classId])

  const loadClassData = async () => {
    try {
      setLoading(true)
      const classes = await ploneAPI.getClasses()
      const currentClass = classes.find((c: any) => c.id === classId)
      setClassData(currentClass)
    } catch (error) {
      console.error('Error loading class data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Class Not Found</h1>
          <p className="text-gray-600 mb-4">The requested class could not be found.</p>
          <Button onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <div className="h-8 w-px bg-gray-300" />
            
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  {classData.title} - Gradebook
                </h1>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Manage grades and track student progress
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Categories
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <EnhancedGradebookView 
          classId={classId}
          className={classData.title}
          fullScreen={true}
        />
      </div>

      {/* Settings Dialog */}
      <GradeCategoriesDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        classId={classId}
        className={classData.title}
        onSettingsSaved={() => {
          // Refresh gradebook data
          window.location.reload()
        }}
      />
    </div>
  )
} 