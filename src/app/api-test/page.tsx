import { APITest } from "@/components/api-test"

export default function APITestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Plone API Connection Test</h1>
          <p className="text-slate-600">
            This page tests the connection between NextJS and the Plone backend.
          </p>
        </div>
        
        <APITest />
        
        <div className="text-sm text-slate-500">
          <p>Steps to connect:</p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Go to <a href="http://localhost:8080" target="_blank" className="text-blue-600 hover:underline">http://localhost:8080</a></li>
            <li>Click "Create a new Plone site"</li>
            <li>Use "Plone" as the site ID (important!)</li>
            <li>Fill in the form and create the site</li>
            <li>Refresh this page to see the connection status</li>
          </ol>
        </div>
      </div>
    </div>
  )
} 