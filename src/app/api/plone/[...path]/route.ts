import { NextRequest, NextResponse } from 'next/server'

// Function to rewrite URLs in the response data
function rewriteUrls(data: any, baseUrl: string): any {
  if (typeof data === 'string') {
    // Replace any references to the Plone backend with our proxy
    return data.replace(/http:\/\/127\.0\.0\.1:8080\/Plone/g, `${baseUrl}/api/plone`)
  }
  
  if (Array.isArray(data)) {
    return data.map(item => rewriteUrls(item, baseUrl))
  }
  
  if (data && typeof data === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(data)) {
      result[key] = rewriteUrls(value, baseUrl)
    }
    return result
  }
  
  return data
}

async function handleRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const ploneUrl = `http://127.0.0.1:8080/Plone/${path.join('/')}`
  
  try {
    // Forward the request to Plone with basic auth
    const response = await fetch(ploneUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
      },
      ...(request.method !== 'GET' && request.method !== 'HEAD' && {
        body: await request.text()
      })
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Plone API error: ${response.status} - ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Get the base URL from the request
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    
    // Rewrite URLs in the response to use our proxy
    const rewrittenData = rewriteUrls(data, baseUrl)
    
    // Return the response with CORS headers
    return NextResponse.json(rewrittenData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  } catch (error) {
    console.error('[API Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Plone backend' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    )
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context)
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context)
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  // Handle preflight requests
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
} 