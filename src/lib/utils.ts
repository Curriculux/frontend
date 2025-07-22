import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getSubjectColor(subject: string) {
  const colors = {
    biology: 'bg-green-100 text-green-800',
    chemistry: 'bg-blue-100 text-blue-800',
    physics: 'bg-purple-100 text-purple-800',
    'environmental science': 'bg-emerald-100 text-emerald-800',
    default: 'bg-gray-100 text-gray-800',
  }
  return colors[subject.toLowerCase() as keyof typeof colors] || colors.default
}

export function getGradeLevelColor(grade: string) {
  const colors = {
    '9th': 'bg-blue-50 text-blue-700',
    '10th': 'bg-green-50 text-green-700',
    '11th': 'bg-purple-50 text-purple-700',
    '12th': 'bg-red-50 text-red-700',
    ap: 'bg-yellow-50 text-yellow-700',
    default: 'bg-gray-50 text-gray-700',
  }
  return colors[grade.toLowerCase() as keyof typeof colors] || colors.default
} 