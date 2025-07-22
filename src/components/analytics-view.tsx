"use client"

import { motion } from "framer-motion"
import { TrendingUp, BarChart3, PieChart, Activity } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function AnalyticsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Analytics</h1>
        <p className="text-slate-600 mt-2">Track student performance and engagement metrics</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Class Average</p>
              <p className="text-3xl font-bold">87%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-500 to-emerald-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Engagement Rate</p>
              <p className="text-3xl font-bold">94%</p>
            </div>
            <Activity className="w-8 h-8 text-green-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Completion Rate</p>
              <p className="text-3xl font-bold">89%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-orange-200" />
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Improvement</p>
              <p className="text-3xl font-bold">+12%</p>
            </div>
            <PieChart className="w-8 h-8 text-purple-200" />
          </div>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Performance Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-2">Advanced Analytics Dashboard Coming Soon</p>
            <p className="text-sm">
              Detailed insights into student performance, engagement patterns, and learning outcomes
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Badge variant="outline">Performance Trends</Badge>
              <Badge variant="outline">Engagement Metrics</Badge>
              <Badge variant="outline">Learning Analytics</Badge>
              <Badge variant="outline">Predictive Insights</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
