"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ploneAPI } from './api'
import { useRouter } from 'next/navigation'
import { getSecurityManager } from './security'

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
  securityContext: any | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [securityContext, setSecurityContext] = useState<any | null>(null)
  const router = useRouter()

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const initializeSecurityContext = async () => {
    try {
      const securityManager = getSecurityManager();
      const context = await securityManager.initializeSecurityContext();
      setSecurityContext(context);
    } catch (error) {
      console.error('Failed to initialize security context:', error);
    }
  };

  const checkAuth = async () => {
    const savedToken = localStorage.getItem('plone_token');
    if (savedToken) {
      ploneAPI.setToken(savedToken);
      try {
        const userData = await ploneAPI.getCurrentUser();
        if (userData) {
          setUser(userData);
          await initializeSecurityContext();
        } else {
          localStorage.removeItem('plone_token');
          ploneAPI.setToken(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('plone_token');
        ploneAPI.setToken(null);
      }
    }
    setLoading(false);
  };

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      
      await ploneAPI.login(username, password);
      const userData = await ploneAPI.getCurrentUser();
      
      if (userData) {
        setUser(userData);
        localStorage.setItem('plone_token', ploneAPI.getToken()!);
        await initializeSecurityContext();
        router.push('/');
      } else {
        throw new Error('Failed to get user data after login');
      }
    } catch (error) {
      console.error('Login failed:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await ploneAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setUser(null);
    setSecurityContext(null);
    localStorage.removeItem('plone_token');
    ploneAPI.setToken(null);
    
    // Redirect to login page
    router.push('/login');
  };

  return (
    <AuthContext.Provider 
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!user,
        securityContext
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