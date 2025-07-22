import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of public routes that don't require authentication
const publicRoutes = ['/login', '/api/plone', '/api-test']

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Check if the path is public
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route))
  
  // Get the token from cookies (we'll set this after login)
  const token = request.cookies.get('plone_token')?.value
  
  // If the route is protected and there's no token, redirect to login
  if (!isPublicRoute && !token) {
    const loginUrl = new URL('/login', request.url)
    // Add the original URL as a redirect parameter
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }
  
  // If user is authenticated and trying to access login, redirect to home
  if (token && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
} 