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

interface Teacher {
  '@id': string
  username: string
  fullname: string
  email: string
  roles: string[]
}

interface TeacherSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  allowCreateNew?: boolean
  onCreateNew?: () => void
  refreshTrigger?: number // Used to trigger a refresh of the teacher list
}

export function TeacherSelect({ 
  value, 
  onValueChange, 
  placeholder = "Search for a teacher...",
  disabled = false,
  className,
  allowCreateNew = false,
  onCreateNew,
  refreshTrigger
}: TeacherSelectProps) {
  const [open, setOpen] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true)
      const users = await ploneAPI.getAllUsers()
      
      // Filter for users who have teaching roles (Editor, Site Administrator, Manager)
      // Note: Contributor alone is now for students, not teachers
      const teachingRoles = ['Editor', 'Site Administrator', 'Manager']
      const teacherUsers = users.filter((user: any) => {
        if (!user.roles) return false;
        
        // Must have at least one teaching role
        const hasTeachingRole = user.roles.some((role: string) => teachingRoles.includes(role));
        
        // If they only have Contributor+Member, they're a student, not a teacher
        const isStudentOnly = user.roles.includes('Contributor') && 
                             user.roles.includes('Member') && 
                             !user.roles.some((role: string) => ['Editor', 'Site Administrator', 'Manager'].includes(role));
        
        return hasTeachingRole && !isStudentOnly;
      })
      
      // Sort teachers by fullname for better UX
      const sortedTeachers = teacherUsers.sort((a: any, b: any) => 
        a.fullname.localeCompare(b.fullname)
      )
      
      setTeachers(sortedTeachers)
    } catch (error) {
      console.error('Error loading teachers:', error)
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && teachers.length === 0) {
      loadTeachers()
    }
    
    // Focus the scroll container when opened for better mouse wheel support
    if (open && scrollContainerRef.current) {
      setTimeout(() => {
        scrollContainerRef.current?.focus()
      }, 100)
    }
  }, [open, teachers.length, loadTeachers])

  // Refresh teachers when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadTeachers()
    }
  }, [refreshTrigger, loadTeachers])

  const filteredTeachers = teachers.filter(teacher =>
    teacher.fullname.toLowerCase().includes(searchValue.toLowerCase()) ||
    teacher.username.toLowerCase().includes(searchValue.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchValue.toLowerCase())
  )

  const selectedTeacher = teachers.find(teacher => 
    teacher.fullname === value || teacher.username === value
  )

  const getRoleDisplay = (roles: string[]) => {
    if (roles.includes('Manager') || roles.includes('Site Administrator')) {
      return 'Admin'
    } else if (roles.includes('Editor')) {
      return 'Teacher'
    } else if (roles.includes('Contributor')) {
      return 'Assistant'
    }
    return 'Staff'
  }

  const getRoleBadgeColor = (roles: string[]) => {
    if (roles.includes('Manager') || roles.includes('Site Administrator')) {
      return 'bg-purple-100 text-purple-700'
    } else if (roles.includes('Editor')) {
      return 'bg-blue-100 text-blue-700'
    } else if (roles.includes('Contributor')) {
      return 'bg-green-100 text-green-700'
    }
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedTeacher ? (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{selectedTeacher.fullname}</span>
                <Badge 
                  variant="secondary" 
                  className={cn("text-xs flex-shrink-0", getRoleBadgeColor(selectedTeacher.roles))}
                >
                  {getRoleDisplay(selectedTeacher.roles)}
                </Badge>
              </div>
              {!disabled && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onValueChange("")
                  }}
                  className="ml-2 p-1 rounded-sm opacity-70 hover:opacity-100 hover:bg-accent cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      onValueChange("")
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-full p-0 z-[100]" 
        align="start" 
        side="bottom" 
        sideOffset={4}
        avoidCollisions={true}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          setTimeout(() => {
            scrollContainerRef.current?.focus()
          }, 0)
        }}
      >
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>
        <div 
          ref={scrollContainerRef}
          className="max-h-[200px] overflow-y-scroll overscroll-contain scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
          tabIndex={0}
          onWheel={(e) => {
            // Ensure wheel events work properly
            e.stopPropagation()
            const target = e.currentTarget
            const { scrollTop, scrollHeight, clientHeight } = target
            
            // Allow natural scrolling within bounds
            if (
              (e.deltaY > 0 && scrollTop < scrollHeight - clientHeight) ||
              (e.deltaY < 0 && scrollTop > 0)
            ) {
              // Let the browser handle the scroll naturally
              return
            }
            
            // Prevent scroll from bubbling up when at boundaries
            if (
              (e.deltaY > 0 && scrollTop >= scrollHeight - clientHeight) ||
              (e.deltaY < 0 && scrollTop <= 0)
            ) {
              e.preventDefault()
            }
          }}
        >
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Loading teachers...
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {searchValue ? "No teachers found matching your search." : "No teachers available."}
            </div>
          ) : (
            <div className="p-1 space-y-1">
              {filteredTeachers.map((teacher) => (
                <button
                  key={teacher['@id']}
                  onClick={() => {
                    onValueChange(teacher.fullname)
                    setOpen(false)
                    setSearchValue("")
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors text-left"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{teacher.fullname}</span>
                        <Badge 
                          variant="secondary" 
                          className={cn("text-xs", getRoleBadgeColor(teacher.roles))}
                        >
                          {getRoleDisplay(teacher.roles)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {teacher.email}
                      </span>
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4 flex-shrink-0",
                      (teacher.fullname === value || teacher.username === value) 
                        ? "opacity-100" 
                        : "opacity-0"
                    )}
                  />
                </button>
              ))}
              
              {allowCreateNew && onCreateNew && (
                <>
                  {filteredTeachers.length > 0 && (
                    <div className="border-t border-border my-1" />
                  )}
                  <button
                    onClick={() => {
                      onCreateNew()
                      setOpen(false)
                      setSearchValue("")
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors text-left text-muted-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">Create new teacher account</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
} 