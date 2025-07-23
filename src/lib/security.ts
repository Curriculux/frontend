// Security framework leveraging Plone's native RBAC and permissions
import { ploneAPI } from './api'

// Plone Role Constants (using Plone's standard roles + Student)
export const PLONE_ROLES = {
  ANONYMOUS: 'Anonymous',
  AUTHENTICATED: 'Authenticated', 
  MEMBER: 'Member',
  STUDENT: 'Student',                // Custom role for students
  SITE_ADMINISTRATOR: 'Site Administrator',
  MANAGER: 'Manager',
  OWNER: 'Owner',
  EDITOR: 'Editor',
  REVIEWER: 'Reviewer',
  CONTRIBUTOR: 'Contributor',
  READER: 'Reader'
} as const

// Using Plone's built-in permissions + student-specific ones
export const PLONE_PERMISSIONS = {
  VIEW: 'View',
  ACCESS_CONTENTS: 'Access contents information',
  MODIFY_PORTAL_CONTENT: 'Modify portal content',
  ADD_PORTAL_CONTENT: 'Add portal content',
  DELETE_OBJECTS: 'Delete objects',
  LIST_FOLDER_CONTENTS: 'List folder contents',
  MANAGE_PROPERTIES: 'Manage properties',
  // Student-specific permissions (we'll map these to standard Plone permissions)
  VIEW_OWN_DATA: 'View own student data',
  SUBMIT_ASSIGNMENT: 'Submit assignments',
  VIEW_OWN_GRADES: 'View own grades'
} as const

// Data Classification Levels
export enum DataClassification {
  PUBLIC = 'public',           // Name, grade level - visible to all authenticated users
  EDUCATIONAL = 'educational', // Class assignments, progress - visible to editors/contributors/students(own data)
  RESTRICTED = 'restricted',   // Contact info, emergency contacts - visible to site administrators only
  CONFIDENTIAL = 'confidential', // Medical info, special needs - visible to managers only
  STUDENT_OWN = 'student_own'  // Student can only see their own data in this category
}

// Student Data Fields Classification
export const STUDENT_FIELD_CLASSIFICATION = {
  // Public fields (visible to all authenticated users)
  name: DataClassification.PUBLIC,
  email: DataClassification.PUBLIC,
  grade_level: DataClassification.PUBLIC,
  avatar: DataClassification.PUBLIC,

  // Educational fields (visible to editors/contributors + students can see their own)
  student_id: DataClassification.STUDENT_OWN,
  classes: DataClassification.STUDENT_OWN,
  progress: DataClassification.STUDENT_OWN,
  assignments: DataClassification.STUDENT_OWN,
  attendance: DataClassification.STUDENT_OWN,

  // Restricted fields (visible to site administrators only)
  phone: DataClassification.RESTRICTED,
  address: DataClassification.RESTRICTED,
  emergency_contact: DataClassification.RESTRICTED,
  emergency_phone: DataClassification.RESTRICTED,
  parent_email: DataClassification.RESTRICTED,
  enrollment_date: DataClassification.RESTRICTED,

  // Confidential fields (visible to managers only)
  medical_info: DataClassification.CONFIDENTIAL,
  special_needs: DataClassification.CONFIDENTIAL,
  dietary_restrictions: DataClassification.CONFIDENTIAL,
  notes: DataClassification.CONFIDENTIAL
} as const;

export interface UserPermissions {
  roles: string[];
  permissions: string[];
}

export interface SecurityContext {
  user: any;
  permissions: UserPermissions;
  canViewField: (field: keyof typeof STUDENT_FIELD_CLASSIFICATION, studentId?: string) => boolean;
  canEditField: (field: keyof typeof STUDENT_FIELD_CLASSIFICATION, studentId?: string) => boolean;
  canAccessStudent: (studentId: string, classId?: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  isStudent: () => boolean;
  isTeacher: () => boolean;
  isAdmin: () => boolean;
  canSubmitAssignment: (assignmentId: string, classId: string) => boolean;
  canViewGrades: (studentId: string) => boolean;
}

export class SecurityManager {
  private static instance: SecurityManager;
  private securityContext: SecurityContext | null = null;

  private constructor() {}

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  async initializeSecurityContext(): Promise<SecurityContext> {
    try {
      const user = await ploneAPI.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Get user's effective permissions (combines roles + local roles)
      const permissions = await this.getUserPermissions(user);
      
      this.securityContext = {
        user,
        permissions,
        canViewField: this.createFieldAccessChecker('view', permissions, user),
        canEditField: this.createFieldAccessChecker('edit', permissions, user),
        canAccessStudent: this.createStudentAccessChecker(permissions, user),
        hasPermission: (permission: string) => permissions.permissions.includes(permission),
        hasRole: (role: string) => permissions.roles.includes(role),
        isStudent: () => {
          // Check for explicit Student role first
          if (permissions.roles.includes(PLONE_ROLES.STUDENT)) {
            return true;
          }
          // Contributors who are also Members are students in our system
          if (permissions.roles.includes(PLONE_ROLES.CONTRIBUTOR) && 
              permissions.roles.includes(PLONE_ROLES.MEMBER)) {
            return true;
          }
          // If user only has Member/Authenticated roles (no elevated permissions), treat as student
          const elevatedRoles = [
            PLONE_ROLES.EDITOR, 
            PLONE_ROLES.SITE_ADMINISTRATOR, 
            PLONE_ROLES.MANAGER, 
            PLONE_ROLES.REVIEWER,
            PLONE_ROLES.OWNER
          ];
          const hasElevatedRole = permissions.roles.some(role => elevatedRoles.includes(role as any));
          const hasBasicRole = permissions.roles.includes(PLONE_ROLES.MEMBER) || 
                              permissions.roles.includes(PLONE_ROLES.AUTHENTICATED);
          return hasBasicRole && !hasElevatedRole;
        },
        isTeacher: () => permissions.roles.includes(PLONE_ROLES.EDITOR) || permissions.roles.includes(PLONE_ROLES.CONTRIBUTOR),
        isAdmin: () => permissions.roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR) || permissions.roles.includes(PLONE_ROLES.MANAGER),
        canSubmitAssignment: this.createAssignmentSubmissionChecker(permissions, user),
        canViewGrades: this.createGradeViewChecker(permissions, user)
      };

      return this.securityContext;
    } catch (error) {
      console.error('Failed to initialize security context:', error);
      throw error;
    }
  }

  getSecurityContext(): SecurityContext | null {
    return this.securityContext;
  }

  private async getUserPermissions(user: any): Promise<UserPermissions> {
    // Extract roles from user object (from JWT or Plone API)
    const roles = user.roles || [];

    // Map roles to permissions based on Plone's standard permission system
    const permissions = this.mapRolesToPermissions(roles);

    return { roles, permissions };
  }

  private mapRolesToPermissions(roles: string[]): string[] {
    const permissions: Set<string> = new Set();

    // Manager has all permissions
    if (roles.includes(PLONE_ROLES.MANAGER)) {
      Object.values(PLONE_PERMISSIONS).forEach(perm => permissions.add(perm));
      return Array.from(permissions);
    }

    // Site Administrator has most administrative permissions
    if (roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR)) {
      permissions.add(PLONE_PERMISSIONS.VIEW);
      permissions.add(PLONE_PERMISSIONS.ACCESS_CONTENTS);
      permissions.add(PLONE_PERMISSIONS.MODIFY_PORTAL_CONTENT);
      permissions.add(PLONE_PERMISSIONS.ADD_PORTAL_CONTENT);
      permissions.add(PLONE_PERMISSIONS.DELETE_OBJECTS);
      permissions.add(PLONE_PERMISSIONS.LIST_FOLDER_CONTENTS);
      permissions.add(PLONE_PERMISSIONS.MANAGE_PROPERTIES);
    }

    // Editor can edit content (Teachers)
    if (roles.includes(PLONE_ROLES.EDITOR)) {
      permissions.add(PLONE_PERMISSIONS.VIEW);
      permissions.add(PLONE_PERMISSIONS.ACCESS_CONTENTS);
      permissions.add(PLONE_PERMISSIONS.MODIFY_PORTAL_CONTENT);
      permissions.add(PLONE_PERMISSIONS.LIST_FOLDER_CONTENTS);
    }

    // Contributor can add content (Assistant Teachers AND Students)
    if (roles.includes(PLONE_ROLES.CONTRIBUTOR)) {
      permissions.add(PLONE_PERMISSIONS.VIEW);
      permissions.add(PLONE_PERMISSIONS.ACCESS_CONTENTS);
      permissions.add(PLONE_PERMISSIONS.ADD_PORTAL_CONTENT);
      permissions.add(PLONE_PERMISSIONS.LIST_FOLDER_CONTENTS);
      
      // If they're also Members, they're students and get student permissions
      if (roles.includes(PLONE_ROLES.MEMBER)) {
        permissions.add(PLONE_PERMISSIONS.VIEW_OWN_DATA);
        permissions.add(PLONE_PERMISSIONS.SUBMIT_ASSIGNMENT);
        permissions.add(PLONE_PERMISSIONS.VIEW_OWN_GRADES);
      }
    }

    // Student has limited permissions
    if (roles.includes(PLONE_ROLES.STUDENT)) {
      permissions.add(PLONE_PERMISSIONS.VIEW);
      permissions.add(PLONE_PERMISSIONS.ACCESS_CONTENTS);
      permissions.add(PLONE_PERMISSIONS.VIEW_OWN_DATA);
      permissions.add(PLONE_PERMISSIONS.SUBMIT_ASSIGNMENT);
      permissions.add(PLONE_PERMISSIONS.VIEW_OWN_GRADES);
    }

    // Reader can view content
    if (roles.includes(PLONE_ROLES.READER)) {
      permissions.add(PLONE_PERMISSIONS.VIEW);
      permissions.add(PLONE_PERMISSIONS.ACCESS_CONTENTS);
    }

    // Member has basic authenticated permissions
    if (roles.includes(PLONE_ROLES.MEMBER) || roles.includes(PLONE_ROLES.AUTHENTICATED)) {
      permissions.add(PLONE_PERMISSIONS.VIEW);
      permissions.add(PLONE_PERMISSIONS.ACCESS_CONTENTS);
    }

    return Array.from(permissions);
  }

  private createFieldAccessChecker(accessType: 'view' | 'edit', permissions: UserPermissions, user: any) {
    return (field: keyof typeof STUDENT_FIELD_CLASSIFICATION, studentId?: string): boolean => {
      const classification = STUDENT_FIELD_CLASSIFICATION[field];
      const { roles } = permissions;

      // Manager can access everything
      if (roles.includes(PLONE_ROLES.MANAGER)) {
        return true;
      }

      switch (classification) {
        case DataClassification.PUBLIC:
          // Public fields visible to all authenticated users
          return roles.includes(PLONE_ROLES.AUTHENTICATED) || 
                 roles.includes(PLONE_ROLES.MEMBER) ||
                 roles.length > 0;

        case DataClassification.STUDENT_OWN:
          // Students can view/edit their own data, educators can view/edit any
          if (roles.includes(PLONE_ROLES.STUDENT)) {
            // Students can only access their own data
            return studentId === user.id || studentId === user.username;
          }
          // Educators can access any student data
          return roles.includes(PLONE_ROLES.EDITOR) ||
                 roles.includes(PLONE_ROLES.CONTRIBUTOR) ||
                 roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR) ||
                 roles.includes(PLONE_ROLES.MANAGER);

        case DataClassification.RESTRICTED:
          // Restricted fields visible to site administrators and up
          return roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR) ||
                 roles.includes(PLONE_ROLES.MANAGER);

        case DataClassification.CONFIDENTIAL:
          // Confidential fields visible to managers only
          return roles.includes(PLONE_ROLES.MANAGER);

        default:
          return false;
      }
    };
  }

  private createStudentAccessChecker(permissions: UserPermissions, user: any) {
    return (studentId: string, classId?: string): boolean => {
      const { roles } = permissions;

      // Manager and Site Administrator can access all students
      if (roles.includes(PLONE_ROLES.MANAGER) || roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR)) {
        return true;
      }

      // Editors and Contributors can access students if they have view permissions
      if (roles.includes(PLONE_ROLES.EDITOR) || roles.includes(PLONE_ROLES.CONTRIBUTOR)) {
        return true;
      }

      // Students can only access their own data
      if (roles.includes(PLONE_ROLES.STUDENT)) {
        return studentId === user.id || studentId === user.username;
      }

      return false;
    };
  }

  private createAssignmentSubmissionChecker(permissions: UserPermissions, user: any) {
    return (assignmentId: string, classId: string): boolean => {
      const { roles } = permissions;
      
      // Students can submit assignments to classes they're enrolled in
      if (roles.includes(PLONE_ROLES.STUDENT)) {
        // TODO: Check if student is enrolled in the class
        // For now, allow all students to submit
        return true;
      }

      // Teachers and admins can submit on behalf of students (for testing)
      return roles.includes(PLONE_ROLES.EDITOR) ||
             roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR) ||
             roles.includes(PLONE_ROLES.MANAGER);
    };
  }

  private createGradeViewChecker(permissions: UserPermissions, user: any) {
    return (studentId: string): boolean => {
      const { roles } = permissions;

      // Students can only view their own grades
      if (roles.includes(PLONE_ROLES.STUDENT)) {
        return studentId === user.id || studentId === user.username;
      }

      // Teachers and admins can view any student's grades
      return roles.includes(PLONE_ROLES.EDITOR) ||
             roles.includes(PLONE_ROLES.CONTRIBUTOR) ||
             roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR) ||
             roles.includes(PLONE_ROLES.MANAGER);
    };
  }

  // Helper method to filter student data based on user permissions
  filterStudentData(studentData: any, context?: { classId?: string }): any {
    if (!this.securityContext) {
      throw new Error('Security context not initialized');
    }

    const filteredData: any = {};

    Object.keys(studentData).forEach(field => {
      if (field in STUDENT_FIELD_CLASSIFICATION) {
        const fieldKey = field as keyof typeof STUDENT_FIELD_CLASSIFICATION;
        if (this.securityContext!.canViewField(fieldKey, studentData.id)) {
          filteredData[field] = studentData[field];
        }
      } else {
        // Allow non-classified fields (like @id, @type, etc.)
        filteredData[field] = studentData[field];
      }
    });

    return filteredData;
  }

  // Helper method to get available actions for a student
  getAvailableActions(studentId: string, classId?: string): string[] {
    if (!this.securityContext) {
      return [];
    }

    const actions: string[] = [];
    const { roles } = this.securityContext.permissions;

    if (this.securityContext.hasPermission(PLONE_PERMISSIONS.VIEW)) {
      actions.push('view');
    }

    if (this.securityContext.hasPermission(PLONE_PERMISSIONS.MODIFY_PORTAL_CONTENT)) {
      actions.push('edit');
    }

    if (this.securityContext.hasPermission(PLONE_PERMISSIONS.DELETE_OBJECTS)) {
      actions.push('delete');
    }

    // Educational actions for educators
    if (roles.includes(PLONE_ROLES.EDITOR) || 
        roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR) || 
        roles.includes(PLONE_ROLES.MANAGER)) {
      actions.push('view-grades', 'edit-grades');
    }

    // Student-specific actions
    if (roles.includes(PLONE_ROLES.STUDENT) && 
        (studentId === this.securityContext.user.id || studentId === this.securityContext.user.username)) {
      actions.push('view-own-grades', 'submit-assignment');
    }

    return actions;
  }

  // Get a user-friendly role display
  getUserRoleDisplay(): string {
    if (!this.securityContext) {
      return 'Unknown';
    }

    const { roles } = this.securityContext.permissions;

    if (roles.includes(PLONE_ROLES.MANAGER)) {
      return 'Manager';
    }
    if (roles.includes(PLONE_ROLES.SITE_ADMINISTRATOR)) {
      return 'Site Administrator';
    }
    if (roles.includes(PLONE_ROLES.EDITOR)) {
      return 'Teacher';
    }
    if (roles.includes(PLONE_ROLES.CONTRIBUTOR)) {
      return 'Assistant Teacher';
    }
    if (roles.includes(PLONE_ROLES.STUDENT)) {
      return 'Student';
    }
    if (roles.includes(PLONE_ROLES.READER)) {
      return 'Reader';
    }
    
    // Use the same logic as isStudent() to determine if this is a student
    if (this.securityContext.isStudent()) {
      return 'Student';
    }

    if (roles.includes(PLONE_ROLES.MEMBER)) {
      return 'Member';
    }

    return 'Authenticated User';
  }

  // Get user type for routing decisions
  getUserType(): 'student' | 'teacher' | 'admin' | 'unknown' {
    if (!this.securityContext) {
      return 'unknown';
    }

    if (this.securityContext.isAdmin()) {
      return 'admin';
    }
    if (this.securityContext.isTeacher()) {
      return 'teacher';
    }
    if (this.securityContext.isStudent()) {
      return 'student';
    }

    return 'unknown';
  }
}

// Convenience function to get security manager instance
export const getSecurityManager = () => SecurityManager.getInstance();

// React hook for security context
export const useSecurityContext = () => {
  const securityManager = getSecurityManager();
  return securityManager.getSecurityContext();
} 