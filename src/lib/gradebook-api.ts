// Enhanced Gradebook API for Cirriculux
// Uses composition with the existing PloneAPI instance

import { 
  WeightedCategory, 
  GradebookSettings, 
  EnhancedGrade, 
  StudentGradeSummary, 
  CategoryGrade,
  AssignmentRubric,
  RubricGrade,
  GradebookEntry,
  GradebookAnalytics,
  BulkGradeOperation,
  GradeCurve,
  GradingScale,
  ProgressReport,
  MasteryProgress
} from '@/types/gradebook';
import { ploneAPI } from './api';

export class GradebookAPI {
  
  // =====================
  // Grade Categories Management
  // =====================
  
  async getGradebookSettings(classId: string): Promise<GradebookSettings> {
    try {
      // Try to get gradebook settings stored in class description or metadata
      // For now, fallback to localStorage until we implement proper backend storage
      const storageKey = `gradebook-settings-${classId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Return default settings if none exist
      return this.getDefaultGradebookSettings(classId);
    } catch (error) {
      return this.getDefaultGradebookSettings(classId);
    }
  }
  
  async saveGradebookSettings(settings: GradebookSettings): Promise<GradebookSettings> {
    try {
      // For now, save to localStorage until backend implementation
      const storageKey = `gradebook-settings-${settings.classId}`;
      localStorage.setItem(storageKey, JSON.stringify(settings));
      return settings;
    } catch (error) {
      console.error('Error saving gradebook settings:', error);
      throw error;
    }
  }
  
  async createGradeCategory(classId: string, category: Omit<WeightedCategory, 'id'>): Promise<WeightedCategory> {
    const newCategory = {
      ...category,
      id: this.generateId(category.name)
    };
    
    // Get current settings and add the new category
    const settings = await this.getGradebookSettings(classId);
    settings.categories.push(newCategory);
    await this.saveGradebookSettings(settings);
    
    return newCategory;
  }
  
  async updateGradeCategory(classId: string, category: WeightedCategory): Promise<WeightedCategory> {
    const settings = await this.getGradebookSettings(classId);
    const index = settings.categories.findIndex(c => c.id === category.id);
    if (index !== -1) {
      settings.categories[index] = category;
      await this.saveGradebookSettings(settings);
    }
    return category;
  }
  
  async deleteGradeCategory(classId: string, categoryId: string): Promise<void> {
    const settings = await this.getGradebookSettings(classId);
    settings.categories = settings.categories.filter(c => c.id !== categoryId);
    await this.saveGradebookSettings(settings);
  }
  
  // =====================
  // Enhanced Grade Management
  // =====================
  
  async getEnhancedGrade(classId: string, assignmentId: string, studentId: string): Promise<EnhancedGrade | null> {
    try {
      // Get existing basic grade from Plone
      const submission = await ploneAPI.getSubmission(classId, assignmentId, studentId);
      if (!submission || submission.grade === undefined) {
        return null;
      }
      
      // Convert to enhanced grade format
      const settings = await this.getGradebookSettings(classId);
      const defaultCategory = settings.categories[0] || { id: 'general' };
      
      return {
        id: this.generateGradeId(assignmentId, studentId),
        studentId,
        assignmentId,
        classId,
        categoryId: defaultCategory.id, // TODO: Get from assignment metadata
        points: submission.grade,
        maxPoints: 100, // TODO: Get from assignment
        percentage: submission.grade,
        feedback: submission.feedback,
        isLate: false, // TODO: Calculate from due date
        gradedBy: 'teacher', // TODO: Get from submission
        gradedAt: submission.gradedAt || submission.created
      };
    } catch (error) {
      console.error('Error getting enhanced grade:', error);
      return null;
    }
  }
  
  async saveEnhancedGrade(grade: Omit<EnhancedGrade, 'id'>): Promise<EnhancedGrade> {
    const gradeData = {
      ...grade,
      id: this.generateGradeId(grade.assignmentId, grade.studentId)
    };
    
    try {
      // Save basic grade using existing Plone API
      await ploneAPI.updateSubmissionGrade(
        grade.classId,
        grade.assignmentId,
        grade.studentId,
        {
          grade: grade.points,
          feedback: grade.feedback,
          gradedAt: grade.gradedAt
        }
      );
      
      // TODO: Save enhanced metadata when backend supports it
      
      return gradeData;
    } catch (error) {
      console.error('Error saving enhanced grade:', error);
      throw error;
    }
  }
  
  async getStudentGrades(studentId: string, classId: string): Promise<EnhancedGrade[]> {
    try {
      // Get all assignments for the class
      const assignments = await ploneAPI.getAssignments(classId);
      const grades: EnhancedGrade[] = [];
      
      for (const assignment of assignments) {
        const grade = await this.getEnhancedGrade(classId, assignment.id, studentId);
        if (grade) {
          grades.push(grade);
        }
      }
      
      return grades;
    } catch (error) {
      console.error('Error getting student grades:', error);
      return [];
    }
  }
  
  async getClassGrades(classId: string): Promise<EnhancedGrade[]> {
    try {
      const students = await ploneAPI.getStudents(classId);
      const allGrades: EnhancedGrade[] = [];
      
      for (const student of students) {
        const studentId = student.id || student.username || student.title?.toLowerCase().replace(/\s+/g, '');
        if (studentId) {
          const grades = await this.getStudentGrades(studentId, classId);
          allGrades.push(...grades);
        }
      }
      
      return allGrades;
    } catch (error) {
      console.error('Error getting class grades:', error);
      return [];
    }
  }
  
  async bulkUpdateGrades(classId: string, operation: BulkGradeOperation): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    // TODO: Implement bulk operations
    console.log('Bulk operation requested:', operation);
    
    return results;
  }
  
  async applyCurveToAssignment(classId: string, assignmentId: string, curve: GradeCurve): Promise<void> {
    // TODO: Implement grade curves
    console.log('Curve requested for assignment:', assignmentId, curve);
  }
  
  // =====================
  // Grade Calculations
  // =====================
  
  async calculateStudentGradeSummary(studentId: string, classId: string): Promise<StudentGradeSummary> {
    try {
      const grades = await this.getStudentGrades(studentId, classId);
      const settings = await this.getGradebookSettings(classId);
      
      // Calculate category grades
      const categoryGrades: CategoryGrade[] = [];
      
      for (const category of settings.categories) {
        const categoryGradeData = await this.calculateCategoryGrade(studentId, classId, category.id, grades);
        categoryGrades.push(categoryGradeData);
      }
      
      // Calculate overall grade using weighted categories
      const overallGrade = this.calculateWeightedGrade(grades, settings.categories);
      
      // Get student name
      const students = await ploneAPI.getStudents(classId);
      const student = students.find((s: any) => 
        s.id === studentId || s.username === studentId || 
        s.title?.toLowerCase().replace(/\s+/g, '') === studentId
      );
      
      const assignments = await ploneAPI.getAssignments(classId);
      const completedAssignments = grades.length;
      const lateAssignments = grades.filter(g => g.isLate).length;
      const missingAssignments = assignments.length - completedAssignments;
      
      return {
        studentId,
        studentName: student?.title || student?.username || studentId,
        classId,
        overallGrade,
        overallLetter: this.getLetterGrade(overallGrade, settings.gradingScale),
        categoryGrades,
        totalAssignments: assignments.length,
        completedAssignments,
        lateAssignments,
        missingAssignments,
        trend: this.calculateTrend(grades),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error calculating student grade summary:', error);
      throw error;
    }
  }
  
  async calculateCategoryGrade(studentId: string, classId: string, categoryId: string, grades?: EnhancedGrade[]): Promise<CategoryGrade> {
    if (!grades) {
      grades = await this.getStudentGrades(studentId, classId);
    }
    
    const settings = await this.getGradebookSettings(classId);
    const category = settings.categories.find(c => c.id === categoryId);
    
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }
    
    const categoryGrades = grades.filter(g => g.categoryId === categoryId);
    
    // Sort by percentage for drop lowest logic
    const sortedGrades = [...categoryGrades].sort((a, b) => a.percentage - b.percentage);
    const gradesToCount = sortedGrades.slice(category.dropLowest);
    const droppedGrades = sortedGrades.slice(0, category.dropLowest);
    
    const totalPoints = gradesToCount.reduce((sum, g) => sum + g.points, 0);
    const maxPoints = gradesToCount.reduce((sum, g) => sum + g.maxPoints, 0);
    const percentage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
    
    // Calculate recent average for trend
    const recentGrades = sortedGrades.slice(-3);
    const recentAverage = recentGrades.length > 0 
      ? recentGrades.reduce((sum, g) => sum + g.percentage, 0) / recentGrades.length 
      : 0;
    
    return {
      categoryId,
      categoryName: category.name,
      weight: category.weight,
      totalPoints: maxPoints,
      earnedPoints: totalPoints,
      percentage,
      letter: this.getLetterGrade(percentage, settings.gradingScale),
      assignmentCount: categoryGrades.length,
      gradedAssignments: gradesToCount.length,
      droppedGrades,
      trend: this.calculateTrend(recentGrades),
      recentAverage
    };
  }
  
  async recalculateClassGrades(classId: string): Promise<void> {
    // Grades are calculated on-demand, so this is mostly a no-op
    console.log('Recalculating grades for class:', classId);
  }
  
  // =====================
  // Gradebook View
  // =====================
  
  async getGradebookData(classId: string): Promise<GradebookEntry[]> {
    try {
      const students = await ploneAPI.getStudents(classId);
      const assignments = await ploneAPI.getAssignments(classId);
      const settings = await this.getGradebookSettings(classId);
      
      const gradebookEntries: GradebookEntry[] = [];
      
      for (const student of students) {
        const studentId = student.id || student.username || student.title?.toLowerCase().replace(/\s+/g, '');
        if (!studentId) continue;
        
        const grades = await this.getStudentGrades(studentId, classId);
        const summary = await this.calculateStudentGradeSummary(studentId, classId);
        
                 // Create assignment map
         const assignmentMap: { [assignmentId: string]: EnhancedGrade | null } = {};
         assignments.forEach((assignment: any) => {
           const grade = grades.find(g => g.assignmentId === assignment.id);
           assignmentMap[assignment.id] = grade || null;
         });
        
        // Create category grades map
        const categoryMap: { [categoryId: string]: CategoryGrade } = {};
        summary.categoryGrades.forEach(catGrade => {
          categoryMap[catGrade.categoryId] = catGrade;
        });
        
        gradebookEntries.push({
          studentId,
          studentName: student.title || student.username || studentId,
          assignments: assignmentMap,
          categoryGrades: categoryMap,
          overallGrade: summary.overallGrade,
          overallLetter: summary.overallLetter,
          trend: summary.trend,
                     missingAssignments: assignments
             .filter((a: any) => !grades.find(g => g.assignmentId === a.id))
             .map((a: any) => a.id)
        });
      }
      
      return gradebookEntries;
    } catch (error) {
      console.error('Error getting gradebook data:', error);
      return [];
    }
  }
  
  async getGradebookAnalytics(classId: string): Promise<GradebookAnalytics> {
    try {
      const entries = await this.getGradebookData(classId);
      const assignments = await ploneAPI.getAssignments(classId);
      
      // Calculate grade distribution
      const gradeDistribution: { [letter: string]: number } = {};
      entries.forEach(entry => {
        const letter = entry.overallLetter || 'F';
        gradeDistribution[letter] = (gradeDistribution[letter] || 0) + 1;
      });
      
      // Calculate class average
      const totalGrades = entries.filter(e => e.overallGrade > 0);
      const averageGrade = totalGrades.length > 0 
        ? totalGrades.reduce((sum, e) => sum + e.overallGrade, 0) / totalGrades.length 
        : 0;
      
      // Calculate median
      const sortedGrades = totalGrades.map(e => e.overallGrade).sort((a, b) => a - b);
      const medianGrade = sortedGrades.length > 0 
        ? sortedGrades[Math.floor(sortedGrades.length / 2)] 
        : 0;
      
      return {
        classId,
        totalStudents: entries.length,
        gradeDistribution,
        averageGrade,
        medianGrade,
        assignmentStats: [], // TODO: Calculate assignment statistics
        categoryPerformance: [], // TODO: Calculate category performance
        trendData: [], // TODO: Calculate trend data
        atRiskStudents: entries.filter(e => e.overallGrade < 60).map(e => e.studentId),
        missingAssignmentAlerts: entries
          .filter(e => e.missingAssignments.length > 0)
          .map(e => ({
            studentId: e.studentId,
            assignmentIds: e.missingAssignments
          }))
      };
    } catch (error) {
      console.error('Error getting gradebook analytics:', error);
      throw error;
    }
  }
  
  // =====================
  // Assignment Category Assignment
  // =====================
  
  async assignAssignmentToCategory(classId: string, assignmentId: string, categoryId: string): Promise<void> {
    // TODO: Store assignment category metadata
    console.log('Assigning assignment to category:', assignmentId, categoryId);
  }
  
  async getAssignmentsByCategory(classId: string, categoryId: string): Promise<any[]> {
    const assignments = await ploneAPI.getAssignments(classId);
    // TODO: Filter by category when metadata is available
    return assignments;
  }
  
  // =====================
  // Utility Methods
  // =====================
  
  private getDefaultGradebookSettings(classId: string): GradebookSettings {
    return {
      classId,
      categories: [
        {
          id: 'homework',
          name: 'Homework',
          weight: 25,
          dropLowest: 1,
          color: '#3B82F6',
          icon: 'BookOpen'
        },
        {
          id: 'tests',
          name: 'Tests & Quizzes',
          weight: 50,
          dropLowest: 0,
          color: '#EF4444',
          icon: 'FileText'
        },
        {
          id: 'projects',
          name: 'Projects',
          weight: 20,
          dropLowest: 0,
          color: '#10B981',
          icon: 'FolderOpen'
        },
        {
          id: 'participation',
          name: 'Participation',
          weight: 5,
          dropLowest: 0,
          color: '#8B5CF6',
          icon: 'Users'
        }
      ],
      gradingScale: {
        id: 'standard',
        name: 'Standard Scale',
        ranges: [
          { min: 90, max: 100, letter: 'A', gpa: 4.0, color: '#10B981' },
          { min: 80, max: 89, letter: 'B', gpa: 3.0, color: '#3B82F6' },
          { min: 70, max: 79, letter: 'C', gpa: 2.0, color: '#F59E0B' },
          { min: 60, max: 69, letter: 'D', gpa: 1.0, color: '#F97316' },
          { min: 0, max: 59, letter: 'F', gpa: 0.0, color: '#EF4444' }
        ]
      },
      allowLateSubmissions: true,
      latePenalty: 10,
      maxLateDays: 7,
      roundingMethod: 'round',
      showStudentGrades: true,
      parentNotifications: true
    };
  }
  
  private getDefaultGradingScale(): GradingScale {
    return {
      id: 'standard',
      name: 'Standard Scale',
      ranges: [
        { min: 90, max: 100, letter: 'A', gpa: 4.0, color: '#10B981' },
        { min: 80, max: 89, letter: 'B', gpa: 3.0, color: '#3B82F6' },
        { min: 70, max: 79, letter: 'C', gpa: 2.0, color: '#F59E0B' },
        { min: 60, max: 69, letter: 'D', gpa: 1.0, color: '#F97316' },
        { min: 0, max: 59, letter: 'F', gpa: 0.0, color: '#EF4444' }
      ]
    };
  }

  private generateGradeId(assignmentId: string, studentId: string): string {
    return `grade-${assignmentId}-${studentId}-${Date.now()}`;
  }
  
  private generateId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  
  private getLetterGrade(percentage: number, gradingScale: any): string {
    const range = gradingScale.ranges.find((r: any) => percentage >= r.min && percentage <= r.max);
    return range?.letter || 'F';
  }
  
  // =====================
  // Grade Calculation Logic
  // =====================
  
  calculateWeightedGrade(grades: EnhancedGrade[], categories: WeightedCategory[]): number {
    const categoryTotals: { [categoryId: string]: { points: number; maxPoints: number; weight: number } } = {};
    
    // Initialize category totals
    categories.forEach(category => {
      categoryTotals[category.id] = {
        points: 0,
        maxPoints: 0,
        weight: category.weight
      };
    });
    
    // Group grades by category
    const gradesByCategory: { [categoryId: string]: EnhancedGrade[] } = {};
    grades.forEach(grade => {
      if (!gradesByCategory[grade.categoryId]) {
        gradesByCategory[grade.categoryId] = [];
      }
      gradesByCategory[grade.categoryId].push(grade);
    });
    
    // Calculate category averages with drop lowest logic
    Object.entries(gradesByCategory).forEach(([categoryId, categoryGrades]) => {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;
      
      // Sort grades by percentage (lowest first) for drop lowest
      const sortedGrades = [...categoryGrades].sort((a, b) => a.percentage - b.percentage);
      
      // Drop the lowest grades if configured
      const gradesToCount = sortedGrades.slice(category.dropLowest);
      
      // Calculate totals for this category
      const categoryPoints = gradesToCount.reduce((sum, grade) => sum + grade.points, 0);
      const categoryMaxPoints = gradesToCount.reduce((sum, grade) => sum + grade.maxPoints, 0);
      
      categoryTotals[categoryId].points = categoryPoints;
      categoryTotals[categoryId].maxPoints = categoryMaxPoints;
    });
    
    // Calculate weighted final grade
    let totalWeightedPoints = 0;
    let totalWeight = 0;
    
    Object.values(categoryTotals).forEach(categoryTotal => {
      if (categoryTotal.maxPoints > 0) {
        const categoryPercentage = (categoryTotal.points / categoryTotal.maxPoints) * 100;
        totalWeightedPoints += categoryPercentage * (categoryTotal.weight / 100);
        totalWeight += categoryTotal.weight;
      }
    });
    
    // Normalize if total weight is not 100%
    return totalWeight > 0 ? (totalWeightedPoints * 100) / totalWeight : 0;
  }
  
  calculateTrend(recentGrades: EnhancedGrade[]): 'improving' | 'declining' | 'stable' {
    if (recentGrades.length < 3) return 'stable';
    
    // Sort by date
    const sorted = [...recentGrades].sort((a, b) => 
      new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime()
    );
    
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    
    const firstAverage = firstHalf.reduce((sum, g) => sum + g.percentage, 0) / firstHalf.length;
    const secondAverage = secondHalf.reduce((sum, g) => sum + g.percentage, 0) / secondHalf.length;
    
    const difference = secondAverage - firstAverage;
    
    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }
}

// Export singleton instance
export const gradebookAPI = new GradebookAPI(); 