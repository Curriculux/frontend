"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BookOpen, Microscope, Atom, Globe, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ChevronRightIcon, ComponentPlaceholderIcon, PlusIcon } from "@radix-ui/react-icons"
import { ploneAPI } from "@/lib/api"
import { getSecurityManager } from "@/lib/security"
import { CreateClassDialog } from "./create-class-dialog"
import { ClassDetailsModal } from "./class-details-modal"

export function ClassesView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<any | null>(null)

  // Get security context to check permissions
  const securityManager = getSecurityManager()
  const securityContext = securityManager.getSecurityContext()

  const loadClasses = async () => {
    try {
      setLoading(true)
      const classesData = await ploneAPI.getClasses()
      
      // Parse metadata from descriptions
      const classesWithMetadata = classesData.map((cls: any) => {
        const metadata = ploneAPI.parseClassMetadata(cls.description || '')
        return {
          ...cls,
          teacher: metadata.teacher || cls.teacher || 'Unassigned',
          subject: metadata.subject,
          gradeLevel: metadata.gradeLevel,
          schedule: metadata.schedule,
          // Keep original description intact for modal, add clean version for display
          originalDescription: cls.description || '',
          description: cls.description?.replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim() || ''
        }
      })
      
      setClasses(classesWithMetadata)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClasses()
  }, [])

  const handleClassCreated = () => {
    // Reload classes after creation
    loadClasses()
  }

  const handleClassClick = (classItem: any) => {
    setSelectedClass(classItem)
    setDetailsModalOpen(true)
  }

  const handleClassUpdated = () => {
    loadClasses()
  }

  const handleClassDeleted = () => {
    loadClasses()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading classes...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading classes</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // Subject to color mapping
  const getClassColor = (subject: string) => {
    const colorMap: { [key: string]: string } = {
      "Mathematics": "from-blue-400 to-indigo-600",
      "Science": "from-green-400 to-teal-600",
      "English Language Arts": "from-purple-400 to-pink-600",
      "Social Studies": "from-orange-400 to-red-600",
      "Computer Science": "from-cyan-400 to-blue-600",
      "Art": "from-pink-400 to-rose-600",
      "Music": "from-violet-400 to-purple-600",
      "Physical Education": "from-yellow-400 to-orange-600",
      "Foreign Language": "from-indigo-400 to-purple-600",
    }
    return colorMap[subject] || "from-gray-400 to-gray-600"
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Classes</h1>
          <p className="text-slate-600 mt-1">
            {classes.length > 0 
              ? `Manage your ${classes.length} active ${classes.length === 1 ? 'class' : 'classes'}`
              : "Set up your first class to get started"
            }
          </p>
        </div>
        {securityContext?.isAdmin() && (
          <Button 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Class
          </Button>
        )}
      </div>

      {/* Classes Grid */}
      {classes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem, index) => (
            <motion.div
              key={classItem['@id']}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="group"
            >
              <Card 
                className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
                onClick={() => handleClassClick(classItem)}
              >
                <div className={`h-32 bg-gradient-to-br ${getClassColor(classItem.subject)} relative`}>
                  <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                  <div className="absolute top-4 left-4 text-white">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="bg-white bg-opacity-20 text-white border-white border-opacity-30">
                      {classItem.gradeLevel || 'Grade N/A'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                        {classItem.title}
                      </h3>
                      {classItem.subject && (
                        <p className="text-sm text-slate-600 mt-1">{classItem.subject}</p>
                      )}
                      {classItem.teacher && (
                        <p className="text-sm text-slate-700 mt-1 font-medium">Teacher: {classItem.teacher}</p>
                      )}
                      {classItem.description && (
                        <p className="text-sm text-slate-500 mt-2">{classItem.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-sm text-slate-600">
                        {classItem.schedule && (
                          <p>{classItem.schedule}</p>
                        )}
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State for No Classes */}
      {classes.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Classes Yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {securityContext?.isAdmin() 
              ? "Get started by creating your first class. You can add students, create assignments, and track progress."
              : "You haven't been assigned to any classes yet. Contact your administrator to get access to classes."
            }
          </p>
          {securityContext?.isAdmin() && (
            <Button 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Class
            </Button>
          )}
        </div>
      )}

      {/* Create Class Dialog */}
      <CreateClassDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onClassCreated={handleClassCreated}
      />

      {/* Class Details Modal */}
      <ClassDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        classData={selectedClass}
        onClassUpdated={handleClassUpdated}
        onClassDeleted={handleClassDeleted}
      />
    </div>
  )
}
