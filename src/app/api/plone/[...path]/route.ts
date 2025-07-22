import { NextRequest, NextResponse } from 'next/server'

// Modern async utility for safe response parsing
async function parseResponseSafely(response: Response): Promise<any> {
  // Handle empty responses (204 No Content, empty body, etc.)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {}
  }

  // Check if response has content
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text()
    return text || {}
  }

  // Safe JSON parsing with fallback
  try {
    const text = await response.text()
    return text.trim() ? JSON.parse(text) : {}
  } catch (error) {
    console.warn('[API Proxy] Failed to parse JSON response:', error)
    return {}
  }
}

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
    // Build headers for the Plone request
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }

    // Forward the Authorization header if present (JWT or Basic Auth)
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    } else {
      // For requests without authorization, let Plone handle them 
      // (some endpoints like @site may work without auth)
    }

    console.log(`[API Proxy] ${request.method} ${ploneUrl}`, { headers: Object.keys(headers) })

    // Modern async request construction
    const requestOptions: RequestInit = {
      method: request.method,
      headers,
    }

    // Add body for appropriate methods using modern async pattern
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      requestOptions.body = await request.text()
    }

    // Forward the request to Plone with timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

    const response = await (async () => {
      try {
        const resp = await fetch(ploneUrl, {
          ...requestOptions,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        return resp
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timeout - Plone backend took too long to respond')
        }
        throw fetchError
      }
    })()
    
    console.log(`[API Proxy] Response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Plone API error: ${response.status} - ${response.statusText}` },
        { status: response.status }
      )
    }

    // Modern async/await response handling
    const data = await parseResponseSafely(response)
    
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
    console.error('[API Proxy] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
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