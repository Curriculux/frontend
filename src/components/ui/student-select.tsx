"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Check, ChevronsUpDown, User, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

import { ploneAPI } from "@/lib/api"

interface Student {
  '@id': string
  username: string
  fullname: string
  email: string
  roles: string[]
}

interface StudentSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  refreshTrigger?: number // Used to trigger a refresh of the student list
}

export function StudentSelect({ 
  value, 
  onValueChange, 
  placeholder = "Search for a student...",
  disabled = false,
  className,
  refreshTrigger
}: StudentSelectProps) {
  const [open, setOpen] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true)
      const users = await ploneAPI.getAllUsers()
      
      // Filter for users who have student roles (Contributor + Member, but not teaching roles)
      const studentUsers = users.filter((user: any) => {
        if (!user.roles) return false;
        
        // Students typically have Contributor + Member roles
        const hasContributor = user.roles.includes('Contributor')
        const hasMember = user.roles.includes('Member')
        
        // Exclude users with teaching/admin roles
        const hasTeachingRole = user.roles.some((role: string) => 
          ['Editor', 'Site Administrator', 'Manager'].includes(role)
        );
        
        // Must have student roles but not teaching roles
        return (hasContributor && hasMember) && !hasTeachingRole;
      })
      
      // Sort students by fullname for better UX
      const sortedStudents = studentUsers.sort((a: any, b: any) => 
        a.fullname.localeCompare(b.fullname)
      )
      
      setStudents(sortedStudents)
    } catch (error) {
      console.error('Error loading students:', error)
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && students.length === 0) {
      loadStudents()
    }
    
    // Focus the scroll container when opened for better mouse wheel support
    if (open && scrollContainerRef.current) {
      setTimeout(() => {
        scrollContainerRef.current?.focus()
      }, 100)
    }
  }, [open, students.length, loadStudents])

  // Trigger reload when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadStudents()
    }
  }, [refreshTrigger, loadStudents])

  // Filter students based on search
  const filteredStudents = students.filter(student => 
    student.fullname.toLowerCase().includes(searchValue.toLowerCase()) ||
    student.email.toLowerCase().includes(searchValue.toLowerCase()) ||
    student.username.toLowerCase().includes(searchValue.toLowerCase())
  )

  const selectedStudent = students.find(student => student.username === value)

  const getRoleDisplay = (roles: string[]) => {
    if (roles.includes('Contributor') && roles.includes('Member')) {
      return 'Student'
    }
    return roles.join(', ')
  }

  const getRoleBadgeColor = (roles: string[]) => {
    if (roles.includes('Contributor') && roles.includes('Member')) {
      return 'bg-blue-100 text-blue-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedStudent ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{selectedStudent.fullname}</span>
              <Badge 
                variant="secondary" 
                className={cn("text-xs ml-auto", getRoleBadgeColor(selectedStudent.roles))}
              >
                {getRoleDisplay(selectedStudent.roles)}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search students..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchValue("")}
              className="h-auto p-1 ml-1"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <div 
          ref={scrollContainerRef}
          className="max-h-[300px] overflow-y-auto"
          tabIndex={-1}
        >
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Loading students...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {searchValue ? "No students found matching your search." : "No students available."}
            </div>
          ) : (
            <div className="p-1 space-y-1">
              {filteredStudents.map((student) => (
                <button
                  key={student['@id']}
                  onClick={() => {
                    onValueChange(student.username)
                    setOpen(false)
                    setSearchValue("")
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors text-left"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{student.fullname}</span>
                        <Badge 
                          variant="secondary" 
                          className={cn("text-xs", getRoleBadgeColor(student.roles))}
                        >
                          {getRoleDisplay(student.roles)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {student.email}
                      </span>
                    </div>
                  </div>
                  {student.username === value && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
} 