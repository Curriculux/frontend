"use client"

import { useState, useEffect } from "react"
import { PloneAPI } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

export function APITest() {
  const [siteInfo, setSiteInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2">Connecting to Plone API...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-md border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">API Connection Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-gray-600 mt-2">
            Make sure you have created a Plone site at http://localhost:8080/Plone
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Plone API Status
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
  )
} 