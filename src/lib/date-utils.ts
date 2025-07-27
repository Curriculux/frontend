import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * Get the user's timezone preference from settings, fallback to browser timezone
 */
export function getUserTimezone(): string {
  try {
    const savedSettings = localStorage.getItem('userSettings')
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      if (settings.timezone) {
        return settings.timezone
      }
    }
  } catch (error) {
    console.warn('Failed to get user timezone from settings:', error)
  }
  
  // Fallback to browser timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Format a date in the user's preferred timezone
 */
export function formatDateInUserTimezone(
  date: string | Date,
  formatStr: string = 'PPP'
): string {
  const timezone = getUserTimezone()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  try {
    return formatInTimeZone(dateObj, timezone, formatStr)
  } catch (error) {
    console.warn('Failed to format date in timezone:', error)
    // Fallback to regular format
    return format(dateObj, formatStr)
  }
}

/**
 * Format a time in the user's preferred timezone
 */
export function formatTimeInUserTimezone(
  date: string | Date,
  formatStr: string = 'h:mm a'
): string {
  const timezone = getUserTimezone()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  try {
    return formatInTimeZone(dateObj, timezone, formatStr)
  } catch (error) {
    console.warn('Failed to format time in timezone:', error)
    // Fallback to regular format
    return format(dateObj, formatStr)
  }
}

/**
 * Format a date and time in the user's preferred timezone
 */
export function formatDateTimeInUserTimezone(
  date: string | Date,
  dateFormat: string = 'PPP',
  timeFormat: string = 'h:mm a'
): string {
  const timezone = getUserTimezone()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  try {
    const datePart = formatInTimeZone(dateObj, timezone, dateFormat)
    const timePart = formatInTimeZone(dateObj, timezone, timeFormat)
    return `${datePart} at ${timePart}`
  } catch (error) {
    console.warn('Failed to format datetime in timezone:', error)
    // Fallback to regular format
    return `${format(dateObj, dateFormat)} at ${format(dateObj, timeFormat)}`
  }
}

/**
 * Format relative time (e.g., "2 hours ago") - doesn't need timezone adjustment
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = typeof date === 'string' ? new Date(date) : date
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
  
  return formatDateInUserTimezone(then, 'PPP')
}

/**
 * Get a locale-aware date string in user's timezone
 */
export function formatLocaleDate(date: string | Date): string {
  const timezone = getUserTimezone()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  try {
    return dateObj.toLocaleDateString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    console.warn('Failed to format locale date:', error)
    return dateObj.toLocaleDateString()
  }
}

/**
 * Get a locale-aware datetime string in user's timezone
 */
export function formatLocaleDateTime(date: string | Date): string {
  const timezone = getUserTimezone()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  try {
    return dateObj.toLocaleDateString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.warn('Failed to format locale datetime:', error)
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
} 