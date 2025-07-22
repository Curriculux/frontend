"use client"

import { motion } from "framer-motion"
import { Bell, Shield, Palette } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GearIcon, PersonIcon } from "@radix-ui/react-icons"

export function SettingsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-600 mt-2">Configure your platform preferences and account settings</p>
      </div>

      {/* Settings Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-0 cursor-pointer hover:scale-105 transition-transform">
          <div className="text-center">
            <PersonIcon className="w-8 h-8 mx-auto mb-3 text-blue-200" />
            <p className="font-semibold">Profile</p>
            <p className="text-xs text-blue-100 mt-1">Personal information</p>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-500 to-emerald-500 text-white border-0 cursor-pointer hover:scale-105 transition-transform">
          <div className="text-center">
            <Bell className="w-8 h-8 mx-auto mb-3 text-green-200" />
            <p className="font-semibold">Notifications</p>
            <p className="text-xs text-green-100 mt-1">Alert preferences</p>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white border-0 cursor-pointer hover:scale-105 transition-transform">
          <div className="text-center">
            <Shield className="w-8 h-8 mx-auto mb-3 text-orange-200" />
            <p className="font-semibold">Privacy</p>
            <p className="text-xs text-orange-100 mt-1">Security settings</p>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0 cursor-pointer hover:scale-105 transition-transform">
          <div className="text-center">
            <Palette className="w-8 h-8 mx-auto mb-3 text-purple-200" />
            <p className="font-semibold">Appearance</p>
            <p className="text-xs text-purple-100 mt-1">Theme & display</p>
          </div>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Platform Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <GearIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-2">Settings Panel Coming Soon</p>
            <p className="text-sm">Comprehensive configuration options for personalizing your teaching experience</p>
            <div className="mt-6 flex justify-center gap-4">
              <Badge variant="outline">User Preferences</Badge>
              <Badge variant="outline">Class Settings</Badge>
              <Badge variant="outline">Integration Options</Badge>
              <Badge variant="outline">Export Tools</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
