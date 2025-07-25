// Enhanced Gradebook Types for Cirriculux
// Based on K12_TEACHER_FEATURES.md implementation plan

export interface WeightedCategory {
  id: string;
  name: string; // "Homework", "Tests", "Projects", "Participation"
  weight: number; // Percentage (0-100)
  dropLowest: number; // Number of lowest scores to drop
  color: string; // UI color coding
  icon: string; // Category icon
  description?: string;
  isExtraCredit?: boolean;
}

export interface GradebookSettings {
  classId: string;
  categories: WeightedCategory[];
  gradingScale: GradingScale;
  allowLateSubmissions: boolean;
  latePenalty: number; // Percentage penalty per day
  maxLateDays: number;
  roundingMethod: 'none' | 'round' | 'floor' | 'ceil';
  showStudentGrades: boolean;
  parentNotifications: boolean;
}

export interface GradingScale {
  id: string;
  name: string; // "Standard", "IB", "AP", etc.
  ranges: GradeRange[];
}

export interface GradeRange {
  min: number; // Minimum percentage
  max: number; // Maximum percentage
  letter: string; // "A", "B+", etc.
  gpa: number; // GPA points
  color: string; // Display color
}

export interface EnhancedGrade {
  id: string;
  studentId: string;
  assignmentId: string;
  classId: string;
  categoryId: string;
  
  // Basic grade info
  points: number; // Points earned
  maxPoints: number; // Total possible points
  percentage: number; // Calculated percentage
  letter?: string; // Letter grade
  
  // Enhanced grading data
  rubricScores?: RubricScore[];
  feedback?: string;
  isLate?: boolean;
  lateDays?: number;
  isExtraCredit?: boolean;
  gradedBy: string; // Teacher ID
  gradedAt: string;
  
  // Flags and metadata
  isDropped?: boolean; // If this grade is dropped from category
  isExcused?: boolean;
  notes?: string;
}

export interface CategoryGrade {
  categoryId: string;
  categoryName: string;
  weight: number;
  
  // Grade calculations
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  letter?: string;
  
  // Category-specific data
  assignmentCount: number;
  gradedAssignments: number;
  droppedGrades: EnhancedGrade[];
  
  // Trend analysis
  trend: 'improving' | 'declining' | 'stable';
  recentAverage: number; // Last 3 assignments average
}

export interface StudentGradeSummary {
  studentId: string;
  studentName: string;
  classId: string;
  
  // Overall calculations
  overallGrade: number; // Weighted final grade
  overallLetter?: string;
  gpa?: number;
  
  // Category breakdowns
  categoryGrades: CategoryGrade[];
  
  // Progress tracking
  totalAssignments: number;
  completedAssignments: number;
  lateAssignments: number;
  missingAssignments: number;
  
  // Analytics
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
  parentLastNotified?: string;
}

// Rubric System Types
export interface RubricCriteria {
  id: string;
  name: string;
  description: string;
  weight: number; // Relative importance (1-10)
  levels: RubricLevel[];
  standardsAlignment?: string[]; // Common Core, NGSS, etc.
}

export interface RubricLevel {
  score: number; // 1-4 for mastery levels
  label: string; // "Exceeds", "Meets", "Approaching", "Below"
  description: string;
  points: number; // Actual point value
}

export interface AssignmentRubric {
  id: string;
  title: string;
  description?: string;
  criteria: RubricCriteria[];
  totalPoints: number; // Sum of all criteria max points
  masteryThreshold: number; // Minimum score for "proficient"
  createdBy: string;
  createdAt: string;
  isTemplate: boolean; // Can be reused across assignments
}

export interface RubricScore {
  criteriaId: string;
  level: number; // Selected level (1-4)
  points: number; // Points for this criteria
  feedback?: string; // Criteria-specific feedback
}

export interface RubricGrade {
  id: string;
  assignmentId: string;
  studentId: string;
  rubricId: string;
  scores: RubricScore[];
  totalPoints: number;
  percentage: number;
  masteryLevel: MasteryLevel;
  overallFeedback?: string;
  gradedBy: string;
  gradedAt: string;
}

// Mastery Tracking
export enum MasteryLevel {
  BEGINNING = 1,
  DEVELOPING = 2,
  PROFICIENT = 3,
  ADVANCED = 4
}

export interface MasteryProgress {
  studentId: string;
  standardId: string;
  currentLevel: MasteryLevel;
  attempts: MasteryAttempt[];
  trend: 'improving' | 'declining' | 'stable';
  lastAssessed: string;
  targetLevel: MasteryLevel;
}

export interface MasteryAttempt {
  id: string;
  assignmentId: string;
  assessmentDate: string;
  level: MasteryLevel;
  evidence?: string; // Description of evidence
  rubricScores?: RubricScore[];
}

export interface StandardAlignment {
  standardId: string;
  standardText: string;
  framework: 'Common Core' | 'NGSS' | 'State Standards' | 'Local Standards';
  alignmentStrength: 'primary' | 'secondary' | 'supporting';
  grade?: string;
  subject?: string;
}

// Gradebook View Types
export interface GradebookEntry {
  studentId: string;
  studentName: string;
  assignments: { [assignmentId: string]: EnhancedGrade | null };
  categoryGrades: { [categoryId: string]: CategoryGrade };
  overallGrade: number;
  overallLetter?: string;
  trend: 'improving' | 'declining' | 'stable';
  missingAssignments: string[]; // Assignment IDs
  alerts?: GradebookAlert[];
}

export interface GradebookAlert {
  type: 'missing' | 'late' | 'failing' | 'improvement' | 'concern';
  message: string;
  assignmentId?: string;
  severity: 'low' | 'medium' | 'high';
  dateCreated: string;
}

// Reporting Types
export interface ProgressReport {
  studentId: string;
  classId: string;
  reportingPeriod: string;
  overallGrade: number;
  categoryBreakdown: CategoryGrade[];
  masteryProgress: MasteryProgress[];
  teacherComments?: string;
  recommendations?: string[];
  parentResponse?: string;
  generatedAt: string;
  generatedBy: string;
}

export interface GradebookAnalytics {
  classId: string;
  totalStudents: number;
  
  // Grade distribution
  gradeDistribution: { [letter: string]: number };
  averageGrade: number;
  medianGrade: number;
  
  // Assignment analytics
  assignmentStats: {
    assignmentId: string;
    title: string;
    average: number;
    submissionRate: number;
    onTimeRate: number;
  }[];
  
  // Category performance
  categoryPerformance: {
    categoryId: string;
    categoryName: string;
    classAverage: number;
    strugglingStudents: number; // Count below 70%
  }[];
  
  // Trends
  trendData: {
    period: string; // Week/Month
    average: number;
    submissionRate: number;
  }[];
  
  // Alerts and concerns
  atRiskStudents: string[]; // Student IDs
  missingAssignmentAlerts: {
    studentId: string;
    assignmentIds: string[];
  }[];
}

// Bulk Operations
export interface BulkGradeOperation {
  type: 'assign' | 'curve' | 'drop' | 'excuse';
  assignmentId?: string;
  studentIds: string[];
  value?: number; // Grade value or curve amount
  reason?: string;
  appliedBy: string;
  appliedAt: string;
}

export interface GradeCurve {
  type: 'flat' | 'percentage' | 'bell';
  amount: number; // Points or percentage to add
  maxGrade?: number; // Cap at this grade
  affectedStudents: string[];
  reason: string;
} 