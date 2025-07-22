import { toast as sonnerToast } from "sonner"

export const toast = (options: {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}) => {
  const message = options.title || options.description || "Notification"
  
  if (options.variant === "destructive") {
    sonnerToast.error(message, {
      description: options.title ? options.description : undefined,
    })
  } else {
    sonnerToast.success(message, {
      description: options.title ? options.description : undefined,
    })
  }
}

export const useToast = () => {
  return { toast }
} 