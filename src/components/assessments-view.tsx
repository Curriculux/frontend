"use client"

import { motion } from "framer-motion"
import { Award, Target, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PlusIcon } from "@radix-ui/react-icons"

export function AssessmentsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Assessments</h1>
          <p className="text-slate-600 mt-2">Create quizzes, tests, and track student performance</p>
        </div>
        <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Assessment
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Total Assessments</p>
              <p className="text-3xl font-bold">18</p>
            </div>
            <Award className="w-8 h-8 text-purple-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Active Quizzes</p>
              <p className="text-3xl font-bold">5</p>
            </div>
            <Target className="w-8 h-8 text-blue-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-500 to-emerald-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Avg Score</p>
              <p className="text-3xl font-bold">87%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Participation</p>
              <p className="text-3xl font-bold">94%</p>
            </div>
            <Users className="w-8 h-8 text-orange-200" />
          </div>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Assessment Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <Award className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-2">Quiz & Test Builder Coming Soon</p>
            <p className="text-sm">Advanced assessment tools with multiple question types and analytics</p>
            <div className="mt-6 flex justify-center gap-4">
              <Badge variant="outline">Multiple Choice</Badge>
              <Badge variant="outline">Short Answer</Badge>
              <Badge variant="outline">Essay Questions</Badge>
              <Badge variant="outline">Auto-Grading</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
