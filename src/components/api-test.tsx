"use client"

import { useState, useEffect } from "react"
import { PloneAPI } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"

export function APITest() {
  const [siteInfo, setSiteInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loginTest, setLoginTest] = useState<{loading: boolean, error: string | null, success: boolean}>({
    loading: false,
    error: null,
    success: false
  })
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    const api = new PloneAPI()
    
    api.getSiteInfo()
      .then(data => {
        setSiteInfo(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const testLogin = async () => {
    setLoginTest({loading: true, error: null, success: false})
    
    try {
      const api = new PloneAPI()
      await api.login(username, password)
      setLoginTest({loading: false, error: null, success: true})
      
      // Try to get current user after login
      const user = await api.getCurrentUser()
      console.log('Current user after login:', user)
    } catch (err: any) {
      console.error('Login test error:', err)
      setLoginTest({
        loading: false, 
        error: `Login failed: ${err.message}. This usually means plone.restapi is not installed or @login endpoint is not available.`,
        success: false
      })
    }
  }

  const testWhiteboardSave = async () => {
    try {
      // Create a simple test canvas
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 300
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 400, 300)
      ctx.fillStyle = '#000000'
      ctx.font = '20px Arial'
      ctx.fillText('Test Whiteboard', 50, 150)
      
      const dataUrl = canvas.toDataURL('image/png')
      
      // Try to save it to a test class
      const api = new PloneAPI()
      await api.login(username, password)
      
      const testClassId = 'algebra' // Use existing class
      
      const result = await api.saveWhiteboard(testClassId, {
        title: `Test Whiteboard ${new Date().toLocaleTimeString()}`,
        dataUrl,
        description: 'Test whiteboard from API test'
      })
      
      console.log('✅ Whiteboard save successful!', result)
      
      // Now try to load whiteboards
      const whiteboards = await api.getWhiteboards(testClassId)
      console.log('📋 Loaded whiteboards:', whiteboards)
      
    } catch (error: any) {
      console.error('❌ Whiteboard save failed:', error)
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2">Connecting to Plone API...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            API Connection Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-red-600">{error}</p>
          <div className="bg-gray-50 p-4 rounded-lg text-xs text-gray-600">
            <p className="font-semibold mb-2">To fix this issue:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to <a href="http://localhost:8080" target="_blank" className="text-blue-600 hover:underline">http://localhost:8080</a></li>
              <li>Click "Create a new Plone site"</li>
              <li>Use "Plone" as the site ID (important!)</li>
              <li>In the "Add-ons" section, make sure "plone.restapi" is selected</li>
              <li>Create the site and refresh this page</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Plone API Connection
            <Badge variant="default" className="bg-green-600">Connected</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <span className="font-semibold">Site Title:</span> {siteInfo?.title || 'N/A'}
          </div>
          <div className="text-sm">
            <span className="font-semibold">API URL:</span> {siteInfo?.['@id'] || 'N/A'}
          </div>
          <div className="text-sm">
            <span className="font-semibold">Plone Version:</span> {siteInfo?.plone_version || 'N/A'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Authentication Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={testLogin} 
              disabled={loginTest.loading || !username || !password}
              className="flex-1"
            >
              {loginTest.loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Login...
                </>
              ) : (
                "Test Login"
              )}
            </Button>
            <Button 
              onClick={testWhiteboardSave} 
              disabled={!username || !password}
              variant="outline"
            >
              Test Whiteboard
            </Button>
          </div>

          {loginTest.success && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Login successful! JWT authentication is working.</span>
            </div>
          )}

          {loginTest.error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Authentication Failed</span>
              </div>
              <p className="text-xs text-red-600">{loginTest.error}</p>
            </div>
          )}

          <div className="text-xs text-gray-500">
            <p>This tests the @login endpoint which is required for JWT authentication.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 