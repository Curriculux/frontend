"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Settings, Database, Users, Shield, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { ploneAPI } from '@/lib/api'
import { toast } from 'sonner'

export function SettingsView() {
  const [loading, setLoading] = useState(false)
  const [permissionResults, setPermissionResults] = useState<{ fixed: number; errors: string[] } | null>(null)

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">
          Manage system settings and maintenance tasks
        </p>
      </div>

      {/* Student Permissions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Legacy Permission Fix
          </CardTitle>
          <CardDescription>
            One-time fix for existing students who may have permission issues. New submissions 
            automatically handle permissions, so this is only needed for troubleshooting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> Students can now submit assignments automatically - the system 
              grants permissions on-the-fly. This tool is only for fixing existing permission issues.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleFixPermissions} 
            disabled={loading}
            className="w-full sm:w-auto"
            variant="outline"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fixing Legacy Permissions...
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
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium">Permission Fix Results</span>
              </div>
              
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
                    {permissionResults.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                    {permissionResults.errors.length > 5 && (
                      <li>• ... and {permissionResults.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* System Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            System Information
          </CardTitle>
          <CardDescription>
            Current system configuration and status
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

      {/* User Management Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Administrative user management tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            User management features will be available in future updates.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
