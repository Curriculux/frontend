"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calculator, BookOpen } from "lucide-react"
import { EnhancedGradebookView } from "./enhanced-gradebook-view"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface GradebookIntegrationProps {
  classId: string
  className?: string
  // Can be used as a modal or standalone component
  asModal?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GradebookIntegration({
  classId,
  className,
  asModal = false,
  open = false,
  onOpenChange
}: GradebookIntegrationProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const gradebookContent = (
    <EnhancedGradebookView 
      classId={classId} 
      className={className} 
    />
  )

  // If used as a modal
  if (asModal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Enhanced Gradebook
            </DialogTitle>
            <DialogDescription>
              Manage grades with weighted categories and advanced analytics for {className}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {gradebookContent}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // If used as a standalone component
  return (
    <div className="w-full">
      {gradebookContent}
    </div>
  )
}

// Button component to open gradebook modal
export function GradebookButton({ 
  classId, 
  className,
  variant = "outline",
  size = "sm"
}: {
  classId: string
  className?: string
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        onClick={() => setOpen(true)}
      >
        <Calculator className="w-4 h-4 mr-2" />
        Enhanced Gradebook
        <span className="ml-2 px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded-md">New</span>
      </Button>
      
      <GradebookIntegration
        classId={classId}
        className={className}
        asModal={true}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
} 