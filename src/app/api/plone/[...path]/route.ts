import { NextRequest, NextResponse } from 'next/server';

const PLONE_API_BASE = process.env.PLONE_API_BASE || 'http://127.0.0.1:8080/Plone';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Build the Plone API URL
    let ploneUrl = `${PLONE_API_BASE}/${path.join('/')}`;
    
    // Add query parameters if any
    if (searchParams.toString()) {
      ploneUrl += `?${searchParams.toString()}`;
    }

    console.log('Proxying GET request to Plone:', ploneUrl);

    // Get the authorization token from the request headers (client-side token)
    const authHeader = request.headers.get('authorization');
    
    // Also check cookies for the token as fallback
    const cookieHeader = request.headers.get('cookie');
    let tokenFromCookie = null;
    if (cookieHeader) {
      const tokenMatch = cookieHeader.match(/plone_token=([^;]+)/);
      if (tokenMatch) {
        tokenFromCookie = tokenMatch[1];
      }
    }
    
    const headers: HeadersInit = {
      'Accept': request.headers.get('Accept') || 'application/json',
      'Content-Type': 'application/json',
    };

    // Use the client's authorization header first, fallback to cookie token
    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log('Using authorization header from client');
    } else if (tokenFromCookie) {
      headers['Authorization'] = `Bearer ${tokenFromCookie}`;
      console.log('Using token from cookie');
    } else {
      console.log('No authentication token found in request');
    }

    // Forward other cookies as well for additional authentication
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(ploneUrl, {
      method: 'GET',
      headers,
    });

    console.log('Plone response status:', response.status);

    if (!response.ok) {
      console.error('Plone request failed:', response.status, response.statusText);
      
      if (response.status === 401) {
        return new NextResponse('Authentication required', { status: 401 });
      } else if (response.status === 403) {
        return new NextResponse('Access denied', { status: 403 });
      } else if (response.status === 404) {
        return new NextResponse('Not found', { status: 404 });
      } else {
        return new NextResponse('Plone request failed', { status: response.status });
      }
    }

    // Check if this is a file download based on the path and content type
    const contentType = response.headers.get('content-type') || '';
    const isFileDownload = path.some(segment => segment.includes('@@download')) || 
                          !contentType.includes('application/json') && 
                          !contentType.includes('text/html');

    if (isFileDownload) {
      // For file downloads, stream the response
      const responseHeaders: HeadersInit = {
        'Content-Type': contentType,
      };

      // Forward relevant headers for file downloads
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        responseHeaders['Content-Length'] = contentLength;
      }

      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        responseHeaders['Content-Disposition'] = contentDisposition;
      }

      const lastModified = response.headers.get('last-modified');
      if (lastModified) {
        responseHeaders['Last-Modified'] = lastModified;
      }

      const etag = response.headers.get('etag');
      if (etag) {
        responseHeaders['ETag'] = etag;
      }

      // Add CORS headers for file access
      responseHeaders['Access-Control-Allow-Origin'] = '*';
      responseHeaders['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
      responseHeaders['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';

      console.log('Serving file download with headers:', responseHeaders);

      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } else {
      // For JSON responses, parse and return
      const data = await response.json();
      return NextResponse.json(data);
    }

  } catch (error) {
    console.error('Error in Plone proxy:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = await params;
    const body = await request.text();
    
    // Build the Plone API URL
    const ploneUrl = `${PLONE_API_BASE}/${path.join('/')}`;

    console.log('Proxying POST request to Plone:', ploneUrl);

    // Get the authorization token from the request headers (client-side token)
    const authHeader = request.headers.get('authorization');
    
    // Also check cookies for the token as fallback
    const cookieHeader = request.headers.get('cookie');
    let tokenFromCookie = null;
    if (cookieHeader) {
      const tokenMatch = cookieHeader.match(/plone_token=([^;]+)/);
      if (tokenMatch) {
        tokenFromCookie = tokenMatch[1];
      }
    }
    
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json',
    };

    // Use the client's authorization header first, fallback to cookie token
    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else if (tokenFromCookie) {
      headers['Authorization'] = `Bearer ${tokenFromCookie}`;
    }

    // Forward other cookies as well for additional authentication
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(ploneUrl, {
      method: 'POST',
      headers,
      body: body,
    });

    console.log('Plone POST response status:', response.status);

    if (!response.ok) {
      console.error('Plone POST request failed:', response.status, response.statusText);
      return new NextResponse('Plone request failed', { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in Plone POST proxy:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = await params;
    const body = await request.text();
    
    // Build the Plone API URL
    const ploneUrl = `${PLONE_API_BASE}/${path.join('/')}`;

    console.log('Proxying PATCH request to Plone:', ploneUrl);

    // Get the authorization token from the request headers (client-side token)
    const authHeader = request.headers.get('authorization');
    
    // Also check cookies for the token as fallback
    const cookieHeader = request.headers.get('cookie');
    let tokenFromCookie = null;
    if (cookieHeader) {
      const tokenMatch = cookieHeader.match(/plone_token=([^;]+)/);
      if (tokenMatch) {
        tokenFromCookie = tokenMatch[1];
      }
    }
    
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Use the client's authorization header first, fallback to cookie token
    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else if (tokenFromCookie) {
      headers['Authorization'] = `Bearer ${tokenFromCookie}`;
    }

    // Forward other cookies as well for additional authentication
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(ploneUrl, {
      method: 'PATCH',
      headers,
      body: body,
    });

    console.log('Plone PATCH response status:', response.status);

    if (!response.ok) {
      console.error('Plone PATCH request failed:', response.status, response.statusText);
      return new NextResponse('Plone request failed', { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in Plone PATCH proxy:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = await params;
    
    // Build the Plone API URL
    const ploneUrl = `${PLONE_API_BASE}/${path.join('/')}`;

    console.log('Proxying DELETE request to Plone:', ploneUrl);

    // Get the authorization token from the request headers (client-side token)
    const authHeader = request.headers.get('authorization');
    
    // Also check cookies for the token as fallback
    const cookieHeader = request.headers.get('cookie');
    let tokenFromCookie = null;
    if (cookieHeader) {
      const tokenMatch = cookieHeader.match(/plone_token=([^;]+)/);
      if (tokenMatch) {
        tokenFromCookie = tokenMatch[1];
      }
    }
    
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    // Use the client's authorization header first, fallback to cookie token
    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else if (tokenFromCookie) {
      headers['Authorization'] = `Bearer ${tokenFromCookie}`;
    }

    // Forward other cookies as well for additional authentication
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(ploneUrl, {
      method: 'DELETE',
      headers,
    });

    console.log('Plone DELETE response status:', response.status);
    console.log('Plone DELETE response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error('Plone DELETE request failed:', response.status, response.statusText);
      
      // Try to get error details from response body
      try {
        const errorText = await response.text();
        console.error('Plone DELETE error details:', errorText);
        return new NextResponse(errorText || 'Plone request failed', { status: response.status });
      } catch (e) {
        return new NextResponse('Plone request failed', { status: response.status });
      }
    }

    // Check if Plone returned any content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // Plone returned JSON, forward it
      try {
        const data = await response.json();
        return NextResponse.json(data);
      } catch (e) {
        console.warn('Failed to parse Plone JSON response');
      }
    }

    // Return 204 No Content for successful deletion
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Error in Plone DELETE proxy:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
}