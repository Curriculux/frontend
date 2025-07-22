// Standardized grade levels for consistent use across the application
export const GRADE_LEVELS = [
  // Elementary (K-5)
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  
  // Middle School (6-8)
  "6th Grade",
  "7th Grade",
  "8th Grade",
  
  // High School (9-12)
  "9th Grade",
  "10th Grade", 
  "11th Grade",
  "12th Grade"
] as const

// Alternative high school naming for some schools
export const HIGH_SCHOOL_LEVELS = [
  "Freshman",    // 9th Grade
  "Sophomore",   // 10th Grade
  "Junior",      // 11th Grade
  "Senior"       // 12th Grade
] as const

// Subject areas for classes
export const SUBJECTS = [
  "Mathematics",
  "Science",
  "English Language Arts",
  "Social Studies",
  "Computer Science",
  "Art",
  "Music",
  "Physical Education",
  "Foreign Language",
  "Other"
] as const

// Grade level color mapping for UI consistency
export const GRADE_LEVEL_COLORS: Record<string, string> = {
  "Kindergarten": "bg-pink-50 text-pink-700",
  "1st Grade": "bg-red-50 text-red-700",
  "2nd Grade": "bg-orange-50 text-orange-700",
  "3rd Grade": "bg-yellow-50 text-yellow-700",
  "4th Grade": "bg-green-50 text-green-700",
  "5th Grade": "bg-blue-50 text-blue-700",
  "6th Grade": "bg-indigo-50 text-indigo-700",
  "7th Grade": "bg-purple-50 text-purple-700",
  "8th Grade": "bg-violet-50 text-violet-700",
  "9th Grade": "bg-blue-100 text-blue-800",
  "10th Grade": "bg-green-100 text-green-800",
  "11th Grade": "bg-purple-100 text-purple-800",
  "12th Grade": "bg-red-100 text-red-800",
  "Freshman": "bg-blue-100 text-blue-800",
  "Sophomore": "bg-green-100 text-green-800",
  "Junior": "bg-purple-100 text-purple-800",
  "Senior": "bg-red-100 text-red-800"
}

// Subject color mapping for UI consistency
export const SUBJECT_COLORS: Record<string, string> = {
  "Mathematics": "bg-blue-100 text-blue-800",
  "Science": "bg-green-100 text-green-800",
  "English Language Arts": "bg-purple-100 text-purple-800",
  "Social Studies": "bg-orange-100 text-orange-800",
  "Computer Science": "bg-cyan-100 text-cyan-800",
  "Art": "bg-pink-100 text-pink-800",
  "Music": "bg-violet-100 text-violet-800",
  "Physical Education": "bg-yellow-100 text-yellow-800",
  "Foreign Language": "bg-indigo-100 text-indigo-800",
  "Other": "bg-gray-100 text-gray-800"
} 