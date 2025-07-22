"use client"

import { motion } from "framer-motion"
import { FileText, Clock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, CalendarIcon } from "@radix-ui/react-icons"

export function AssignmentsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Assignments</h1>
          <p className="text-slate-600 mt-2">Create, distribute, and track student assignments</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Assignment
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Assignments</p>
              <p className="text-3xl font-bold">24</p>
            </div>
            <FileText className="w-8 h-8 text-blue-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-500 to-emerald-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Due This Week</p>
              <p className="text-3xl font-bold">8</p>
            </div>
            <CalendarIcon className="w-8 h-8 text-green-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Overdue</p>
              <p className="text-3xl font-bold">3</p>
            </div>
            <Clock className="w-8 h-8 text-orange-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Completed</p>
              <p className="text-3xl font-bold">13</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-200" />
          </div>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Assignment Management Interface</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-2">Assignment Builder Coming Soon</p>
            <p className="text-sm">
              This will include assignment creation, rubrics, due dates, and submission tracking
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Badge variant="outline">Templates</Badge>
              <Badge variant="outline">Rubrics</Badge>
              <Badge variant="outline">Auto-Grading</Badge>
              <Badge variant="outline">Plagiarism Check</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
