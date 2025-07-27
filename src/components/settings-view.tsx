"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Settings, Database, Users, Shield, CheckCircle, AlertTriangle, Loader2, User, BookOpen, Bell, Eye, Lock, Palette, Clock, Mail } from 'lucide-react'
import { ploneAPI } from '@/lib/api'
import { getSecurityManager } from '@/lib/security'
import { toast } from 'sonner'
import { MeetingAuditPanel } from './meeting-audit-panel'

export function SettingsView() {
  const [loading, setLoading] = useState(false)
  const [permissionResults, setPermissionResults] = useState<{ fixed: number; errors: string[] } | null>(null)
  const [securityContext, setSecurityContext] = useState<any>(null)
  const [userSettings, setUserSettings] = useState({
    emailNotifications: true,
    assignmentReminders: true,
    gradeNotifications: true,
    timezone: 'America/New_York',
    language: 'en'
  })

  useEffect(() => {
    initializeSettings()
  }, [])

  const initializeSettings = async () => {
    try {
      const securityManager = getSecurityManager()
      const context = await securityManager.initializeSecurityContext()
      setSecurityContext(context)
      
      // Load user preferences from localStorage or API
      const savedSettings = localStorage.getItem('userSettings')
      if (savedSettings) {
        setUserSettings(JSON.parse(savedSettings))
      }
    } catch (error) {
      console.error('Error initializing settings:', error)
    }
  }

  const handleFixPermissions = async () => {
    try {
      setLoading(true)
      setPermissionResults(null)
      toast.info('Fixing student submission permissions...')
      
      const results = await ploneAPI.fixStudentSubmissionPermissions()
      setPermissionResults(results)
      
      if (results.errors.length === 0) {
        toast.success(`Successfully fixed permissions for ${results.fixed} students`)
      } else {
        toast.warning(`Fixed ${results.fixed} students with ${results.errors.length} errors`)
      }
    } catch (error) {
      console.error('Error fixing permissions:', error)
      toast.error('Failed to fix student permissions')
    } finally {
      setLoading(false)
    }
  }

  const updateUserSetting = (key: string, value: any) => {
    const newSettings = { ...userSettings, [key]: value }
    setUserSettings(newSettings)
    localStorage.setItem('userSettings', JSON.stringify(newSettings))
    toast.success('Setting updated')
  }

  const renderAdminSettings = () => (
    <>
      {/* System Administration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            System Administration
          </CardTitle>
          <CardDescription>
            Administrative tools and system maintenance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Backend Status</Label>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                Connected
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Authentication</Label>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                JWT Enabled
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Management
          </CardTitle>
          <CardDescription>
            Fix permission issues and manage user access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> Modern student submissions handle permissions automatically. 
              This tool fixes legacy permission issues.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleFixPermissions} 
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fixing Permissions...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Fix Legacy Permission Issues
              </div>
            )}
          </Button>

          {permissionResults && (
            <div className="space-y-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  <strong>Students Fixed:</strong> {permissionResults.fixed}
                </p>
              </div>

              {permissionResults.errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 font-medium mb-2">
                    Errors ({permissionResults.errors.length}):
                  </p>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    {permissionResults.errors.slice(0, 3).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                    {permissionResults.errors.length > 3 && (
                      <li>• ... and {permissionResults.errors.length - 3} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meeting Recording Audit */}
      <MeetingAuditPanel />
    </>
  )

  const renderTeacherSettings = () => (
    <>
      {/* Class Management Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Class Management
          </CardTitle>
          <CardDescription>
            Configure your teaching preferences and class settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Assignment Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when students submit assignments
              </p>
            </div>
            <Switch
              checked={userSettings.assignmentReminders}
              onCheckedChange={(checked) => updateUserSetting('assignmentReminders', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email alerts for important class events
              </p>
            </div>
            <Switch
              checked={userSettings.emailNotifications}
              onCheckedChange={(checked) => updateUserSetting('emailNotifications', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Assignment Due Time</Label>
            <Select defaultValue="23:59">
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="09:00">9:00 AM</SelectItem>
                <SelectItem value="12:00">12:00 PM</SelectItem>
                <SelectItem value="17:00">5:00 PM</SelectItem>
                <SelectItem value="23:59">11:59 PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grading Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Grading Preferences
          </CardTitle>
          <CardDescription>
            Set up your grading workflow and feedback settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Grading Scale</Label>
            <Select defaultValue="points">
              <SelectTrigger>
                <SelectValue placeholder="Select scale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="points">Points (0-100)</SelectItem>
                <SelectItem value="percentage">Percentage (0-100%)</SelectItem>
                <SelectItem value="letter">Letter Grades (A-F)</SelectItem>
                <SelectItem value="custom">Custom Scale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Feedback Template</Label>
            <Textarea 
              placeholder="Default feedback template for assignments..."
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>
    </>
  )

  const renderStudentSettings = () => (
    <>
      {/* Learning Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Learning Preferences
          </CardTitle>
          <CardDescription>
            Customize your learning experience and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Assignment Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get reminders about upcoming assignment due dates
              </p>
            </div>
            <Switch
              checked={userSettings.assignmentReminders}
              onCheckedChange={(checked) => updateUserSetting('assignmentReminders', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Grade Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when grades are posted
              </p>
            </div>
            <Switch
              checked={userSettings.gradeNotifications}
              onCheckedChange={(checked) => updateUserSetting('gradeNotifications', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Reminder Timing</Label>
            <Select defaultValue="1">
              <SelectTrigger>
                <SelectValue placeholder="When to remind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day before due</SelectItem>
                <SelectItem value="2">2 days before due</SelectItem>
                <SelectItem value="3">3 days before due</SelectItem>
                <SelectItem value="7">1 week before due</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Study Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Study Tools
          </CardTitle>
          <CardDescription>
            Tools to help you stay organized and focused
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Study Session Duration</Label>
              <Select defaultValue="25">
                <SelectTrigger>
                  <SelectValue placeholder="Duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="25">25 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Break Duration</Label>
              <Select defaultValue="5">
                <SelectTrigger>
                  <SelectValue placeholder="Break time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )

  const renderGeneralSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          General Preferences
        </CardTitle>
        <CardDescription>
          Configure your general account and display preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Time Zone</Label>
          <Select 
            value={userSettings.timezone} 
            onValueChange={(value) => updateUserSetting('timezone', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/New_York">Eastern Time</SelectItem>
              <SelectItem value="America/Chicago">Central Time</SelectItem>
              <SelectItem value="America/Denver">Mountain Time</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Email Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive important updates via email
            </p>
          </div>
          <Switch
            checked={userSettings.emailNotifications}
            onCheckedChange={(checked) => updateUserSetting('emailNotifications', checked)}
          />
        </div>
      </CardContent>
    </Card>
  )

  if (!securityContext) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const isAdmin = securityContext.isAdmin()
  const isTeacher = securityContext.isTeacher()
  const isStudent = securityContext.isStudent()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">
          {isAdmin && "Manage system settings and administrative tools"}
          {isTeacher && !isAdmin && "Configure your teaching preferences and class settings"}
          {isStudent && !isTeacher && !isAdmin && "Customize your learning experience"}
        </p>
      </div>

      {/* General Settings for Everyone */}
      {renderGeneralSettings()}

      <Separator />

      {/* Role-specific Settings */}
      {isAdmin && renderAdminSettings()}
      {isTeacher && !isAdmin && renderTeacherSettings()}
      {isStudent && !isTeacher && !isAdmin && renderStudentSettings()}

      {/* Account Security (for everyone) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Account Security
          </CardTitle>
          <CardDescription>
            Manage your account security and privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full sm:w-auto">
            Change Password
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button variant="outline" size="sm">
              Enable
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
