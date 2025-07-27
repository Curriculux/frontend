// Enhanced Gradebook API for Cirriculux
// Uses composition with the existing PloneAPI instance and S3 for storage

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
import { s3Service } from './s3';

export class GradebookAPI {
  
  // =====================
  // Grade Categories Management
  // =====================
  
  async getGradebookSettings(classId: string): Promise<GradebookSettings> {
    try {
      // Try to get gradebook settings from S3 first
      if (s3Service.isConfigured()) {
        try {
          const settings = await s3Service.downloadGradebookData(classId, 'settings');
          console.log('Retrieved gradebook settings from S3:', settings);
          return settings;
        } catch (s3Error) {
          console.log('No gradebook settings found in S3, checking localStorage fallback...');
        }
      }

      // Fallback to localStorage for existing data
      const storageKey = `gradebook-settings-${classId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const settings = JSON.parse(stored);
        
        // Migrate from localStorage to S3 if S3 is configured
        if (s3Service.isConfigured()) {
          console.log('Migrating gradebook settings from localStorage to S3...');
          await this.saveGradebookSettings(settings);
          localStorage.removeItem(storageKey); // Clean up old storage
        }
        
        return settings;
      }
      
      // Return default settings if none exist
      return this.getDefaultGradebookSettings(classId);
    } catch (error) {
      console.error('Error getting gradebook settings:', error);
      return this.getDefaultGradebookSettings(classId);
    }
  }
  
  async saveGradebookSettings(settings: GradebookSettings): Promise<GradebookSettings> {
    try {
      // Save to S3 if configured
      if (s3Service.isConfigured()) {
        await s3Service.uploadGradebookData(settings.classId, 'settings', settings);
        console.log('Gradebook settings saved to S3');
        return settings;
      }
      
      // Fallback to localStorage
      const storageKey = `gradebook-settings-${settings.classId}`;
      localStorage.setItem(storageKey, JSON.stringify(settings));
      console.log('Gradebook settings saved to localStorage (S3 not configured)');
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
  // Enhanced Grade Storage and Retrieval
  // =====================

  async saveEnhancedGrade(grade: EnhancedGrade): Promise<EnhancedGrade> {
    try {
      // Find the actual submission first
      console.log('Finding submission for grade:', grade);
      const submission = await ploneAPI.getSubmission(grade.classId, grade.assignmentId, grade.studentId);
      
      if (submission) {
        console.log('Found submission:', submission.id);
        
        // Check if this is an S3-only submission (ID ends with -s3)
        if (submission.id.endsWith('-s3')) {
          console.log('S3-only submission detected, skipping Plone update');
          // For S3-only submissions, we don't need to update Plone since the submission only exists in S3
        } else {
          // Update the basic grade in Plone for Plone submissions
          try {
            await ploneAPI.updateSubmissionGrade(
              grade.classId,
              grade.assignmentId,
              submission.id,
              {
                grade: grade.points,
                feedback: grade.feedback,
                gradedAt: grade.gradedAt
              }
            );
            console.log('Successfully updated submission grade in Plone');
          } catch (error) {
            console.warn('Failed to update submission in Plone, but continuing with enhanced grade storage:', error);
          }
        }
      } else {
        console.warn(`No submission found for student ${grade.studentId} in assignment ${grade.assignmentId}`);
        // Continue with S3 storage even if Plone update fails
      }

      // Save enhanced grade data to S3 if configured
      if (s3Service.isConfigured()) {
        // Include submission info in the enhanced grade for reference
        const enhancedGradeWithSubmission = {
          ...grade,
          submissionId: submission?.id,
          submissionType: submission?.id?.endsWith('-s3') ? 's3' : 'plone',
          lastUpdated: new Date().toISOString()
        };
        
        const fileName = `grade-${grade.studentId}-${grade.assignmentId}.json`;
        await s3Service.uploadGradebookData(grade.classId, 'grades', enhancedGradeWithSubmission, fileName);
        console.log('Enhanced grade saved to S3:', grade.id);
      } else {
        // Fallback to localStorage
        const enhancedGradeWithSubmission = {
          ...grade,
          submissionId: submission?.id,
          submissionType: submission?.id?.endsWith('-s3') ? 's3' : 'plone',
          lastUpdated: new Date().toISOString()
        };
        
        const storageKey = `enhanced-grade-${grade.classId}-${grade.id}`;
        localStorage.setItem(storageKey, JSON.stringify(enhancedGradeWithSubmission));
        console.log('Enhanced grade saved to localStorage (S3 not configured)');
      }

      return grade;
    } catch (error) {
      console.error('Error saving enhanced grade:', error);
      throw error;
    }
  }

  async getEnhancedGrade(classId: string, assignmentId: string, studentId: string): Promise<EnhancedGrade | null> {
    try {
      // Try to get enhanced grade from S3 first
      if (s3Service.isConfigured()) {
        try {
          const fileName = `grade-${studentId}-${assignmentId}.json`;
          const enhancedGrade = await s3Service.downloadGradebookData(classId, 'grades', fileName);
          if (enhancedGrade) {
            return enhancedGrade;
          }
          // If enhancedGrade is null (file doesn't exist), continue to Plone fallback
        } catch (s3Error: any) {
          // Only log actual errors, not NoSuchKey which is handled by the S3 service
          if (!s3Error.message?.includes('NoSuchKey')) {
            console.log('Error retrieving enhanced grade from S3, checking Plone...', s3Error);
          }
        }
      }

      // Get existing basic grade from Plone
      console.log('Checking Plone submission for:', { classId, assignmentId, studentId });
      const submission = await ploneAPI.getSubmission(classId, assignmentId, studentId);
      console.log('Found submission:', submission);
      if (!submission || submission.grade === undefined) {
        console.log('No submission or grade found for:', { classId, assignmentId, studentId });
        return null;
      }
      
      // Convert to enhanced grade format
      const settings = await this.getGradebookSettings(classId);
      const defaultCategory = settings.categories[0] || { id: 'general' };
      
      const enhancedGrade: EnhancedGrade = {
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

      // Save this enhanced grade for future use
      await this.saveEnhancedGrade(enhancedGrade);

      return enhancedGrade;
    } catch (error) {
      console.error('Error getting enhanced grade:', error);
      return null;
    }
  }

  async getStudentGrades(studentId: string, classId: string): Promise<EnhancedGrade[]> {
    try {
      console.log('Getting student grades for:', studentId, 'in class:', classId);
      const grades: EnhancedGrade[] = [];

      // Get assignments for this class
      const assignments = await ploneAPI.getAssignments(classId);
      console.log('Found assignments for student grades:', assignments.length);
      
      // Get enhanced grade for each assignment
      for (const assignment of assignments) {
        console.log('Checking assignment:', assignment.id, 'for student:', studentId);
        const grade = await this.getEnhancedGrade(classId, assignment.id, studentId);
        if (grade) {
          console.log('Found grade:', grade);
          grades.push(grade);
        } else {
          console.log('No grade found for assignment:', assignment.id, 'student:', studentId);
        }
      }

      console.log('Total grades found for student:', studentId, ':', grades.length);
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
      console.log('=== Getting gradebook data for class:', classId);
      const students = await ploneAPI.getStudents(classId);
      const assignments = await ploneAPI.getAssignments(classId);
      const settings = await this.getGradebookSettings(classId);
      
      console.log('Loaded students:', students);
      console.log('Loaded assignments:', assignments);
      
      const gradebookEntries: GradebookEntry[] = [];
      
      for (const student of students) {
        // Try multiple student ID formats to find the right one
        const possibleStudentIds = [
          student.id,
          student.username, 
          student.title?.toLowerCase().replace(/\s+/g, ''),
          student.title,
          student.email?.split('@')[0] // Email prefix as fallback
        ].filter(Boolean);
        
        console.log('Processing student:', student, 'Possible IDs:', possibleStudentIds);
        
        let studentId = possibleStudentIds[0];
        if (!studentId) {
          console.warn('No valid student ID found for student:', student);
          continue;
        }

        // Try to get grades with different student ID formats
        let grades: EnhancedGrade[] = [];
        let foundValidId = false;
        
        for (const testId of possibleStudentIds) {
          try {
            const testGrades = await this.getStudentGrades(testId, classId);
            if (testGrades.length > 0) {
              grades = testGrades;
              studentId = testId;
              foundValidId = true;
              console.log('Found grades for student ID:', testId, 'Grades:', testGrades);
              break;
            }
          } catch (error) {
            console.log('No grades found for student ID:', testId);
          }
        }
        
                 if (!foundValidId) {
           console.log('No grades found for any student ID format, checking submissions directly...');
           // Try to find submissions using different student ID formats
           for (const assignment of assignments) {
             for (const testId of possibleStudentIds) {
               try {
                 const submission = await ploneAPI.getSubmission(classId, assignment.id, testId);
                 if (submission && submission.grade !== undefined) {
                   console.log('Found submission with student ID:', testId, 'Assignment:', assignment.id);
                   studentId = testId; // Use the ID that works
                   foundValidId = true;
                   // Refresh grades with the correct student ID
                   grades = await this.getStudentGrades(testId, classId);
                   break;
                 }
               } catch (error) {
                 // Continue trying other IDs
               }
             }
             if (foundValidId) break;
           }
         }
         
         // Create assignment map
         const assignmentMap: { [assignmentId: string]: EnhancedGrade | null } = {};
         assignments.forEach((assignment: any) => {
           const grade = grades.find(g => g.assignmentId === assignment.id);
           assignmentMap[assignment.id] = grade || null;
         });
         
         // Calculate category grades
         console.log('Calculating category grades for student:', studentId, 'Categories:', settings.categories);
         const categoryMap: { [categoryId: string]: CategoryGrade } = {};
         for (const category of settings.categories) {
           // Filter grades by categoryId (grades have categoryId from the gradebook data)
           const categoryGrades = grades.filter(g => g.categoryId === category.id);
           
           // Find which assignments are in this category based on the grades
           const categoryAssignmentIds = new Set(categoryGrades.map(g => g.assignmentId));
           const categoryAssignments = assignments.filter((a: any) => categoryAssignmentIds.has(a.id));
           
           // If there are no graded assignments but we have assignments without grades,
           // and there's only one category, assume all assignments belong to it
           let finalCategoryAssignments = categoryAssignments;
           if (categoryAssignments.length === 0 && settings.categories.length === 1) {
             finalCategoryAssignments = assignments;
           }
           
           console.log(`Category ${category.name}:`, {
             categoryAssignments: finalCategoryAssignments.length,
             categoryGrades: categoryGrades.length,
             assignments: finalCategoryAssignments.map((a: any) => ({ id: a.id, title: a.title })),
             grades: categoryGrades.map((g: any) => ({ assignmentId: g.assignmentId, percentage: g.percentage, categoryId: g.categoryId }))
           });
           
           let categoryPercentage = 0;
           if (categoryGrades.length > 0) {
             const totalPercentage = categoryGrades.reduce((sum, grade) => sum + grade.percentage, 0);
             categoryPercentage = totalPercentage / categoryGrades.length;
           }
           
           categoryMap[category.id] = {
             categoryId: category.id,
             categoryName: category.name,
             weight: category.weight,
             totalPoints: categoryGrades.reduce((sum, grade) => sum + grade.maxPoints, 0),
             earnedPoints: categoryGrades.reduce((sum, grade) => sum + grade.points, 0),
             percentage: categoryPercentage,
             assignmentCount: settings.categories.length === 1 ? assignments.length : finalCategoryAssignments.length,
             gradedAssignments: categoryGrades.length,
             droppedGrades: [],
             trend: 'stable' as const,
             recentAverage: categoryPercentage
           };
         }
         
         // Calculate simple overall grade from existing grades
         let overallGrade = 0;
         let overallLetter = 'F';
         if (grades.length > 0) {
           const totalPercentage = grades.reduce((sum, grade) => sum + grade.percentage, 0);
           overallGrade = totalPercentage / grades.length;
           // Simple letter grade calculation
           if (overallGrade >= 90) overallLetter = 'A';
           else if (overallGrade >= 80) overallLetter = 'B';
           else if (overallGrade >= 70) overallLetter = 'C';
           else if (overallGrade >= 60) overallLetter = 'D';
           else overallLetter = 'F';
         }
         
         const entry = {
           studentId,
           studentName: student.title || student.username || studentId,
           assignments: assignmentMap,
           categoryGrades: categoryMap,
           overallGrade,
           overallLetter,
           trend: 'stable' as const,
           missingAssignments: assignments
             .filter((a: any) => !grades.find(g => g.assignmentId === a.id))
             .map((a: any) => a.id)
         };
         
         console.log('Created gradebook entry:', entry);
         gradebookEntries.push(entry);
      }
      
      console.log('Final gradebook entries:', gradebookEntries);
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
  // Rubric Management
  // =====================

  async saveAssignmentRubric(classId: string, rubric: AssignmentRubric): Promise<AssignmentRubric> {
    try {
      if (s3Service.isConfigured()) {
        const fileName = `rubric-${rubric.id}.json`;
        await s3Service.uploadGradebookData(classId, 'rubrics', rubric, fileName);
        console.log('Assignment rubric saved to S3:', rubric.id);
      } else {
        // Fallback to localStorage
        const storageKey = `rubric-${classId}-${rubric.id}`;
        localStorage.setItem(storageKey, JSON.stringify(rubric));
        console.log('Assignment rubric saved to localStorage (S3 not configured)');
      }
      return rubric;
    } catch (error) {
      console.error('Error saving assignment rubric:', error);
      throw error;
    }
  }

  async getRubricForAssignment(classId: string, assignmentId: string): Promise<AssignmentRubric | null> {
    try {
      // Get all rubrics for this class and find one for the assignment
      const allRubrics = await this.listClassRubrics(classId);
      return allRubrics.find(rubric => rubric.assignmentId === assignmentId) || null;
    } catch (error) {
      console.error('Error getting rubric for assignment:', error);
      return null;
    }
  }

  async getAssignmentRubric(classId: string, rubricId: string): Promise<AssignmentRubric | null> {
    try {
      if (s3Service.isConfigured()) {
        try {
          const fileName = `rubric-${rubricId}.json`;
          return await s3Service.downloadGradebookData(classId, 'rubrics', fileName);
        } catch (s3Error) {
          console.log('Rubric not found in S3');
        }
      }

      // Fallback to localStorage
      const storageKey = `rubric-${classId}-${rubricId}`;
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error getting assignment rubric:', error);
      return null;
    }
  }

  async listClassRubrics(classId: string): Promise<AssignmentRubric[]> {
    try {
      const rubrics: AssignmentRubric[] = [];

      if (s3Service.isConfigured()) {
        const files = await s3Service.listGradebookFiles(classId, 'rubrics');
        for (const file of files) {
          try {
            const rubric = await s3Service.downloadGradebookData(classId, 'rubrics', file.fileName);
            if (rubric) {
              rubrics.push(rubric);
            }
          } catch (error) {
            console.warn(`Failed to load rubric ${file.fileName}:`, error);
          }
        }
      } else {
        // Fallback to localStorage scan
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`rubric-${classId}-`)) {
            try {
              const rubric = JSON.parse(localStorage.getItem(key)!);
              rubrics.push(rubric);
            } catch (error) {
              console.warn(`Failed to parse rubric from localStorage: ${key}`, error);
            }
          }
        }
      }

      return rubrics;
    } catch (error) {
      console.error('Error listing class rubrics:', error);
      return [];
    }
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