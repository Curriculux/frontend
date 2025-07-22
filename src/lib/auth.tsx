"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ploneAPI } from './api'
import { useRouter } from 'next/navigation'

interface User {
  '@id': string
  username: string
  fullname: string
  email: string
  roles: string[]
}

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      setLoading(true)
      
      // Only access localStorage on client side
      if (typeof window === 'undefined') {
        setLoading(false)
        return
      }
      
      const token = localStorage.getItem('plone_token')
      
      if (token) {
        ploneAPI.setToken(token)
        const userData = await ploneAPI.getCurrentUser()
        if (userData) {
          setUser(userData)
          // Also set cookie for SSR
          document.cookie = `plone_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}` // 7 days
        } else {
          // Token might be invalid
          localStorage.removeItem('plone_token')
          document.cookie = 'plone_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
          ploneAPI.setToken(null)
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('plone_token')
        document.cookie = 'plone_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      }
      ploneAPI.setToken(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    try {
      setError(null)
      setLoading(true)
      
      // Call Plone login endpoint
      const response = await ploneAPI.login(username, password)
      
      // Store token in localStorage and cookie
      const token = ploneAPI.getToken()
      if (token && typeof window !== 'undefined') {
        localStorage.setItem('plone_token', token)
        document.cookie = `plone_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}` // 7 days
      }
      
      // Get user data
      const userData = await ploneAPI.getCurrentUser()
      setUser(userData)
      
      // Redirect to dashboard or to the redirect URL
      const params = new URLSearchParams(window.location.search)
      const redirect = params.get('redirect') || '/'
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('plone_token')
      document.cookie = 'plone_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
    ploneAPI.setToken(null)
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider 
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 