import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { GRADE_LEVEL_COLORS } from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate contrasting text color
export function getContrastTextColor(backgroundColor: string): string {
  // Simple heuristic - return dark text for light backgrounds, light text for dark backgrounds
  const lightBackgrounds = ['white', 'light', 'yellow', 'cyan', 'lime', 'pink']
  const isLight = lightBackgrounds.some(color => backgroundColor.includes(color))
  return isLight ? 'text-gray-900' : 'text-white'
}

// Format bytes to human readable
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Re-export date utilities for backward compatibility
export { 
  formatRelativeTime,
  formatDateInUserTimezone,
  formatTimeInUserTimezone,
  formatDateTimeInUserTimezone,
  formatLocaleDate,
  formatLocaleDateTime,
  getUserTimezone
} from './date-utils'

export function getGradeLevelColor(grade: string) {
  return GRADE_LEVEL_COLORS[grade] || 'bg-gray-50 text-gray-700'
} 