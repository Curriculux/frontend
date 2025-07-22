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

export function ClassesView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classes, setClasses] = useState<any[]>([])

  useEffect(() => {
    const loadClasses = async () => {
      try {
        setLoading(true)
        const classesData = await ploneAPI.getClasses()
        setClasses(classesData || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load classes')
      } finally {
        setLoading(false)
      }
    }
    
    loadClasses()
  }, [])

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

  // Sample classes data for display (to be replaced with real data)
  const defaultClasses = classes.length > 0 ? classes : [
    {
      title: "Getting Started",
      description: "Create your first class to begin using Cirriculux",
      students: 0,
      progress: 0,
      color: "from-blue-400 to-indigo-600",
      icon: BookOpen,
      isPlaceholder: true,
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Classes</h1>
          <p className="text-slate-600 mt-1">
            {classes.length > 0 
              ? `Manage your ${classes.length} active classes`
              : "Set up your first class to get started"
            }
          </p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Create New Class
        </Button>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {defaultClasses.map((classItem, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="group"
          >
            <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className={`h-32 bg-gradient-to-br ${classItem.color} relative`}>
                <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                <div className="absolute top-4 left-4 text-white">
                  {/* Use default icon for all classes */}
                  <BookOpen className="w-8 h-8" />
                </div>
                {!classItem.isPlaceholder && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="bg-white bg-opacity-20 text-white border-white border-opacity-30">
                      {classItem.students} students
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                      {classItem.title}
                    </h3>
                    {classItem.description && (
                      <p className="text-sm text-slate-600 mt-1">{classItem.description}</p>
                    )}
                  </div>

                  {!classItem.isPlaceholder && (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Progress</span>
                          <span className="font-medium text-slate-900">{classItem.progress}%</span>
                        </div>
                        <Progress value={classItem.progress} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="text-sm text-slate-600">
                          <p>{classItem.nextClass || "No upcoming classes"}</p>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </>
                  )}

                  {classItem.isPlaceholder && (
                    <div className="text-center py-4">
                      <Button variant="outline" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Class
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Empty State for No Classes */}
      {classes.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Classes Yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Get started by creating your first class. You can add students, create assignments, and track progress.
          </p>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Class
          </Button>
        </div>
      )}
    </div>
  )
}
