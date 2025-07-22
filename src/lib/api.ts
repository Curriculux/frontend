// Use NextJS proxy to avoid CORS issues - requests go to /api/plone/* and get proxied to Plone backend
const API_BASE = process.env.NEXT_PUBLIC_PLONE_API_URL || '/api/plone';

export interface PloneClass {
  '@id': string;
  title: string;
  description: string;
  teacher: string; // Required field - teacher name or ID
  student_count?: number;
  subject?: string;
  grade_level?: string;
  schedule?: string;
  created?: string;
  modified?: string;
  id?: string;
}

export interface PloneLesson {
  '@id': string;
  title: string;
  description: string;
  subject?: string;
  grade_level?: string;
  created: string;
  modified: string;
}

export interface PloneUser {
  '@id': string;
  fullname: string;
  email: string;
  roles: string[];
}

export interface PloneStudent {
  '@id': string;
  id?: string;
  name: string;
  email: string;
  grade_level?: string;
  avatar?: string;
  created?: string;
  modified?: string;
  classId?: string;
  progress?: number;
  
  // Educational data (visible to teachers)
  student_id?: string;
  classes?: string[];
  assignments?: any[];
  attendance?: any[];
  
  // Restricted data (visible to deans only) - stored in annotations
  phone?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  parent_email?: string;
  enrollment_date?: string;
  
  // Confidential data (visible to deans + medical staff) - stored in encrypted annotations
  medical_info?: string;
  special_needs?: string;
  dietary_restrictions?: string;
  notes?: string;
}

export interface PloneContent {
  '@id': string;
  '@type': string;
  title: string;
  description: string;
  effective?: string;
  modified?: string;
  review_state?: string;
}

export interface PloneAssignment {
  '@id': string;
  id?: string;
  title: string;
  description: string;
  dueDate?: string;
  points?: number;
  classId?: string;
  created?: string;
  modified?: string;
  instructions?: string;
  attachments?: string[];
}

export class PloneAPI {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('plone_token');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const headers = new Headers({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    });

    if (options.headers) {
      const customHeaders = new Headers(options.headers);
      customHeaders.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Try to get detailed error message from response body
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody ? ` - ${errorBody}` : '';
      } catch (e) {
        // Ignore error parsing, use default message
      }
      throw new Error(`API request failed: ${response.status} - ${response.statusText}${errorDetails}`);
    }

    return response.json();
  }

  async login(username: string, password: string): Promise<void> {
    const response = await this.makeRequest('/@login', {
      method: 'POST',
      body: JSON.stringify({ login: username, password: password }),
    });
    this.token = response.token;
    
    // Persist token in localStorage and cookie
    if (typeof window !== 'undefined' && this.token) {
      localStorage.setItem('plone_token', this.token);
      document.cookie = `plone_token=${this.token}; path=/; SameSite=Lax`;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.makeRequest('/@logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    this.token = null;
    
    // Clear token from localStorage and cookie
    if (typeof window !== 'undefined') {
      localStorage.removeItem('plone_token');
      document.cookie = 'plone_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }

  async getCurrentUser() {
    try {
      // Don't auto-login here, let the auth context handle it
      if (!this.token) {
        return null;
      }
      
      // Get basic user info from JWT token
      try {
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        const username = payload.sub;
        const fullname = payload.fullname || payload.sub;
        
        // Try to get detailed user info including roles from @users/{username} endpoint
        try {
          const userResponse = await this.makeRequest(`/@users/${username}`);
          return {
            '@id': userResponse['@id'] || `/users/${username}`,
            username: username,
            fullname: userResponse.fullname || fullname,
            email: userResponse.email || payload.email || '',
            roles: userResponse.roles || ['Authenticated'],
            id: username
          };
        } catch (userError) {
          // If user endpoint fails, create basic user object from JWT
          return {
            '@id': `/users/${username}`,
            username: username,
            fullname: fullname,
            email: payload.email || '',
            roles: ['Authenticated'],
            id: username
          };
        }
      } catch (jwtError) {
        console.log('Could not decode JWT token:', jwtError);
        return null;
      }
    } catch (error) {
      console.log('Current user endpoint not available', error);
      return null;
    }
  }

  // Token management methods
  setToken(token: string | null) {
    this.token = token;
    
    // Persist or clear token in localStorage and cookie
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('plone_token', token);
        document.cookie = `plone_token=${token}; path=/; SameSite=Lax`;
      } else {
        localStorage.removeItem('plone_token');
        document.cookie = 'plone_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  async getSiteInfo() {
    // Use the @site endpoint for site information
    return this.makeRequest('/@site');
  }

  async getClasses() {
    try {
      // Get all folders in the /classes container
      const classesContainer = await this.makeRequest('/classes');
      
      if (classesContainer.items) {
        // Transform folder items to class format
        return classesContainer.items.map((item: any) => {
          // Extract ID from @id URL (e.g., "http://...../classes/precalc" -> "precalc")
          const id = item['@id'].split('/').pop() || '';
          
          // Parse metadata from description to get teacher and other info
          const metadata = this.parseClassMetadata(item.description || '');
          
          return {
            '@id': item['@id'],
            id: id,
            title: item.title,
            description: item.description || '',
            teacher: metadata.teacher || 'Unassigned',
            subject: metadata.subject,
            grade_level: metadata.gradeLevel,
            schedule: metadata.schedule,
            created: item.created,
            modified: item.modified,
          };
        });
      }
      
      return [];
    } catch (error) {
      console.log('Error fetching classes:', error);
      return [];
    }
  }

  async createClass(classData: {
    title: string;
    description: string;
    teacher: string;
    subject?: string;
    gradeLevel?: string;
    schedule?: string;
  }) {
    try {
      // Validate required fields
      if (!classData.teacher || classData.teacher.trim() === '') {
        throw new Error('Teacher is required for creating a class');
      }
      
      // Create a folder in the classes container
      const newClass = await this.makeRequest('/classes', {
        method: 'POST',
        body: JSON.stringify({
          '@type': 'Folder',
          id: this.generateClassId(classData.title),
          title: classData.title,
          description: this.formatClassDescription(classData),
        }),
      });

      // Create subfolders for class organization
      const classPath = `/classes/${newClass.id}`;
      const subfolders = ['assignments', 'resources', 'students', 'grades'];
      
      for (const folder of subfolders) {
        await this.makeRequest(classPath, {
          method: 'POST',
          body: JSON.stringify({
            '@type': 'Folder',
            id: folder,
            title: folder.charAt(0).toUpperCase() + folder.slice(1),
            description: `${folder} for ${classData.title}`,
          }),
        });
      }

      return newClass;
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  }

  async getClass(classId: string) {
    try {
      const classData = await this.makeRequest(`/classes/${classId}`);
      
      // Parse metadata from description to get teacher and other info
      const metadata = this.parseClassMetadata(classData.description || '');
      
      return {
        ...classData,
        teacher: metadata.teacher || 'Unassigned',
        subject: metadata.subject,
        grade_level: metadata.gradeLevel,
        schedule: metadata.schedule,
      };
    } catch (error) {
      console.error('Error fetching class:', error);
      throw error;
    }
  }

  async updateClass(classId: string, updates: Partial<PloneClass>) {
    try {
      // Format the updates with proper metadata embedding
      const formattedUpdates = { ...updates };
      
      // If we're updating class metadata fields, format the description properly
      if (updates.teacher || updates.subject || updates.grade_level || updates.schedule || updates.description !== undefined) {
        formattedUpdates.description = this.formatClassDescription({
          description: updates.description || '',
          teacher: updates.teacher || '',
          subject: updates.subject || '',
          gradeLevel: updates.grade_level || '', // Note: converting grade_level to gradeLevel
          schedule: updates.schedule || '',
        });
        
        // Remove the individual metadata fields since they're now embedded in description
        delete formattedUpdates.teacher;
        delete formattedUpdates.subject;
        delete formattedUpdates.grade_level;
        delete formattedUpdates.schedule;
      }
      
      return await this.makeRequest(`/classes/${classId}`, {
        method: 'PATCH',
        body: JSON.stringify(formattedUpdates),
      });
    } catch (error) {
      console.error('Error updating class:', error);
      throw error;
    }
  }

  async deleteClass(classId: string) {
    try {
      return await this.makeRequest(`/classes/${classId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting class:', error);
      throw error;
    }
  }

  // Helper methods
  private generateClassId(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private formatClassDescription(classData: any): string {
    // Store metadata in description for now
    // Later we can use Plone's annotation storage
    const metadata = {
      teacher: classData.teacher || '',
      subject: classData.subject || '',
      gradeLevel: classData.gradeLevel || '',
      schedule: classData.schedule || '',
    };
    
    return `${classData.description}\n\n[METADATA]${JSON.stringify(metadata)}[/METADATA]`;
  }

  parseClassMetadata(description: string): any {
    const match = description.match(/\[METADATA\](.*?)\[\/METADATA\]/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  async getLessons() {
    try {
      // Search for Document or Page type content that might be lessons
      const searchData = await this.makeRequest('/@search?portal_type=Document&SearchableText=lesson');
      return searchData.items || [];
    } catch (error) {
      console.log('Lessons endpoint not available, returning empty array');
      return [];
    }
  }

  async getRecentActivity() {
    try {
      // Get recent content changes using the search API
      const searchData = await this.makeRequest('/@search?sort_on=modified&sort_order=reverse&metadata_fields=modified');
      
      // Transform to activity format
      const activities = searchData.items?.slice(0, 5).map((item: any) => ({
        user: 'System',
        action: `updated ${item.title}`,
        subject: item['@type'],
        time: new Date(item.modified).toLocaleString(),
        type: 'update',
      })) || [];
      
      return activities;
    } catch (error) {
      console.log('Recent activity not available, returning empty array');
      return [];
    }
  }

  async searchContent(query: string) {
    return this.makeRequest(`/@search?SearchableText=${encodeURIComponent(query)}`);
  }

  async getContent() {
    // Get all available content
    return this.makeRequest('/@search');
  }

  async getFolders() {
    // Get all folders
    return this.makeRequest('/@search?portal_type=Folder');
  }

  // Assignment methods
  async getAssignments(classId: string) {
    try {
      const assignmentsFolder = await this.makeRequest(`/classes/${classId}/assignments`);
      
      if (assignmentsFolder.items) {
        return assignmentsFolder.items.map((item: any) => ({
          '@id': item['@id'],
          id: item.id,
          title: item.title,
          description: item.description || '',
          created: item.created,
          modified: item.modified,
          classId: classId,
          // Parse additional metadata from description
          ...this.parseAssignmentMetadata(item.description || '')
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching assignments:', error);
      return [];
    }
  }

  async createAssignment(classId: string, assignmentData: {
    title: string;
    description: string;
    dueDate?: string;
    points?: number;
    instructions?: string;
  }) {
    try {
      const newAssignment = await this.makeRequest(`/classes/${classId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          '@type': 'Document',
          id: this.generateClassId(assignmentData.title),
          title: assignmentData.title,
          description: this.formatAssignmentDescription(assignmentData),
          text: {
            'content-type': 'text/html',
            data: assignmentData.instructions || ''
          }
        }),
      });

      return newAssignment;
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  }

  async getAssignment(classId: string, assignmentId: string) {
    try {
      const assignment = await this.makeRequest(`/classes/${classId}/assignments/${assignmentId}`);
      return {
        ...assignment,
        classId: classId,
        ...this.parseAssignmentMetadata(assignment.description || '')
      };
    } catch (error) {
      console.error('Error fetching assignment:', error);
      throw error;
    }
  }

  async updateAssignment(classId: string, assignmentId: string, updates: Partial<PloneAssignment>) {
    try {
      const updateData: any = {
        title: updates.title,
        description: this.formatAssignmentDescription(updates),
      };
      
      if (updates.instructions) {
        updateData.text = {
          'content-type': 'text/html',
          data: updates.instructions
        };
      }
      
      return await this.makeRequest(`/classes/${classId}/assignments/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
    } catch (error) {
      console.error('Error updating assignment:', error);
      throw error;
    }
  }

  async deleteAssignment(classId: string, assignmentId: string) {
    try {
      return await this.makeRequest(`/classes/${classId}/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting assignment:', error);
      throw error;
    }
  }

  // Helper methods for assignments
  private formatAssignmentDescription(assignmentData: any): string {
    const metadata = {
      dueDate: assignmentData.dueDate || '',
      points: assignmentData.points || 0,
    };
    
    const baseDescription = assignmentData.description || '';
    return `${baseDescription}\n\n[METADATA]${JSON.stringify(metadata)}[/METADATA]`;
  }

  private parseAssignmentMetadata(description: string): any {
    const match = description.match(/\[METADATA\](.*?)\[\/METADATA\]/);
    if (match) {
      try {
        const metadata = JSON.parse(match[1]);
        return {
          dueDate: metadata.dueDate,
          points: metadata.points,
          description: description.replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim()
        };
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  // Student management methods
  async getStudents(classId?: string) {
    try {
      if (classId) {
        // Get students for a specific class
        const studentsFolder = await this.makeRequest(`/classes/${classId}/students`);
        
        if (studentsFolder.items) {
                  return studentsFolder.items.map((item: any) => {
          const metadata = this.parseStudentMetadata(item.description || '');
          return {
            '@id': item['@id'],
            id: item.id,
            name: item.title,
            email: metadata.email || '',
            created: item.created,
            modified: item.modified,
            classId: classId,
            ...metadata
          };
        });
        }
      } else {
        // Get all students across all classes
        const allStudents: PloneStudent[] = [];
        const classes = await this.getClasses();
        
        for (const cls of classes) {
          const classStudents = await this.getStudents(cls.id);
          allStudents.push(...classStudents);
        }
        
        return allStudents;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  }

  async createStudent(classId: string, studentData: {
    name: string;
    email: string;
    student_id?: string;
    phone?: string;
    grade_level?: string;
    address?: string;
    emergency_contact?: string;
    emergency_phone?: string;
    parent_email?: string;
    medical_info?: string;
    special_needs?: string;
    dietary_restrictions?: string;
    notes?: string;
  }) {
    try {
      const newStudent = await this.makeRequest(`/classes/${classId}/students`, {
        method: 'POST',
        body: JSON.stringify({
          '@type': 'Document',
          id: this.generateStudentId(studentData.name),
          title: studentData.name,
          description: this.formatStudentDescription(studentData),
        }),
      });

      return {
        ...newStudent,
        classId: classId,
        ...this.parseStudentMetadata(newStudent.description || '')
      };
    } catch (error) {
      console.error('Error creating student:', error);
      throw error;
    }
  }

  async getStudent(classId: string, studentId: string) {
    try {
      const student = await this.makeRequest(`/classes/${classId}/students/${studentId}`);
      return {
        ...student,
        name: student.title,
        classId: classId,
        ...this.parseStudentMetadata(student.description || '')
      };
    } catch (error) {
      console.error('Error fetching student:', error);
      throw error;
    }
  }

  async updateStudent(classId: string, studentId: string, updates: Partial<PloneStudent>) {
    try {
      const updateData: any = {
        title: updates.name,
        description: this.formatStudentDescription(updates),
      };
      
      return await this.makeRequest(`/classes/${classId}/students/${studentId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  }

  async deleteStudent(classId: string, studentId: string) {
    try {
      return await this.makeRequest(`/classes/${classId}/students/${studentId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  }

  // Helper methods for students
  private generateStudentId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private formatStudentDescription(studentData: any): string {
    // Store all student metadata in description for now
    // TODO: Move sensitive data to secure storage when backend supports it
    const allMetadata = {
      email: studentData.email || '', // Include email in metadata
      student_id: studentData.student_id || '',
      grade_level: studentData.grade_level || '',
      progress: studentData.progress || 0,
      enrollment_date: studentData.enrollment_date || new Date().toISOString().split('T')[0],
      phone: studentData.phone || '',
      address: studentData.address || '',
      emergency_contact: studentData.emergency_contact || '',
      emergency_phone: studentData.emergency_phone || '',
      parent_email: studentData.parent_email || '',
      medical_info: studentData.medical_info || '',
      special_needs: studentData.special_needs || '',
      dietary_restrictions: studentData.dietary_restrictions || '',
      notes: studentData.notes || ''
    };
    
    const baseDescription = studentData.description || '';
    return `${baseDescription}\n\n[METADATA]${JSON.stringify(allMetadata)}[/METADATA]`;
  }

  private parseStudentMetadata(description: string): any {
    const match = description.match(/\[METADATA\](.*?)\[\/METADATA\]/);
    if (match) {
      try {
        const metadata = JSON.parse(match[1]);
        return {
          email: metadata.email,
          student_id: metadata.student_id,
          grade_level: metadata.grade_level,
          progress: metadata.progress || 0,
          enrollment_date: metadata.enrollment_date,
          phone: metadata.phone,
          address: metadata.address,
          emergency_contact: metadata.emergency_contact,
          emergency_phone: metadata.emergency_phone,
          parent_email: metadata.parent_email,
          medical_info: metadata.medical_info,
          special_needs: metadata.special_needs,
          dietary_restrictions: metadata.dietary_restrictions,
          notes: metadata.notes,
          description: description.replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim()
        };
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  // Note: Annotation-based secure storage would require custom backend endpoints
  // For now, we'll store all data in regular content fields
  async getStudentAnnotations(classId: string, studentId: string): Promise<any> {
    // Return empty object since we're not using annotations yet
    return {};
  }

  async setStudentAnnotations(classId: string, studentId: string, annotations: any): Promise<void> {
    // No-op since we're not using annotations yet
    return;
  }

  // Enhanced student methods with security
  async getStudentSecure(classId: string, studentId: string): Promise<PloneStudent | null> {
    try {
      // Get basic student data
      const student = await this.getStudent(classId, studentId);
      
      // Try to get sensitive data from annotations (requires proper permissions)
      try {
        const annotations = await this.getStudentAnnotations(classId, studentId);
        
        // Merge annotation data with basic student data
        return {
          ...student,
          ...annotations.sensitive_data,
          ...annotations.confidential_data
        };
      } catch (annotationError) {
        // User doesn't have permission to access sensitive data
        return student;
      }
    } catch (error) {
      console.error('Error fetching secure student data:', error);
      return null;
    }
  }

  async createStudentSecure(classId: string, studentData: Partial<PloneStudent>): Promise<PloneStudent> {
    try {
      // Validate required fields
      if (!studentData.name || !studentData.email) {
        throw new Error('Name and email are required fields');
      }

      // For now, store all data in the regular student record
      // TODO: Implement proper secure storage with custom backend endpoints
      const allData = {
        name: studentData.name,
        email: studentData.email,
        student_id: studentData.student_id,
        grade_level: studentData.grade_level,
        progress: studentData.progress || 0,
        enrollment_date: studentData.enrollment_date,
        phone: studentData.phone,
        address: studentData.address,
        emergency_contact: studentData.emergency_contact,
        emergency_phone: studentData.emergency_phone,
        parent_email: studentData.parent_email,
        medical_info: studentData.medical_info,
        special_needs: studentData.special_needs,
        dietary_restrictions: studentData.dietary_restrictions,
        notes: studentData.notes
      };

      // Create the student record with all data
      const newStudent = await this.createStudent(classId, allData);

      return newStudent;
    } catch (error) {
      console.error('Error creating secure student:', error);
      throw error;
    }
  }

  // Local Roles Management (Plone's way of granting permissions to specific objects)
  async getLocalRoles(objectPath: string): Promise<any> {
    try {
      const response = await this.makeRequest(`${objectPath}/@sharing`);
      return response;
    } catch (error) {
      console.error('Failed to get local roles:', error);
      return {};
    }
  }

  async setLocalRoles(objectPath: string, principal: string, roles: string[]): Promise<void> {
    try {
      await this.makeRequest(`${objectPath}/@sharing`, {
        method: 'POST',
        body: JSON.stringify({
          entries: [{
            id: principal,
            roles: roles,
            type: 'user' // or 'group'
          }]
        })
      });
    } catch (error) {
      console.error('Failed to set local roles:', error);
      throw error;
    }
  }

  // Workflow methods for content state management
  async getWorkflowState(objectPath: string): Promise<string> {
    try {
      const response = await this.makeRequest(`${objectPath}/@workflow`);
      return response.state || 'private';
    } catch (error) {
      console.error('Failed to get workflow state:', error);
      return 'private';
    }
  }

  async transitionWorkflow(objectPath: string, transition: string, comment?: string): Promise<void> {
    try {
      await this.makeRequest(`${objectPath}/@workflow/${transition}`, {
        method: 'POST',
        body: JSON.stringify({
          comment: comment || ''
        })
      });
    } catch (error) {
      console.error('Failed to transition workflow:', error);
      throw error;
    }
  }

  // Student-specific methods
  async getStudentClasses(studentId: string): Promise<PloneClass[]> {
    try {
      // TODO: Implement proper enrollment checking
      // For now, return all classes as if student is enrolled
      const allClasses = await this.getClasses();
      return allClasses;
    } catch (error) {
      console.error('Error fetching student classes:', error);
      return [];
    }
  }

  // User Management Methods (for admins)
  async createUser(userData: {
    username: string;
    fullname: string;
    email: string;
    password: string;
    roles?: string[];
    properties?: any;
  }): Promise<any> {
    try {
      // Debug: Log current authentication state
      console.log('Creating user - Auth state:', {
        hasToken: !!this.token,
        userData: {
          username: userData.username,
          fullname: userData.fullname,
          email: userData.email,
          roles: userData.roles
        }
      })

      // Check if we're authenticated
      if (!this.token) {
        throw new Error('Not authenticated - no token available')
      }

      // Debug: First test if we can access the /@users endpoint at all
      try {
        console.log('Testing /@users endpoint access...')
        const usersTest = await this.makeRequest('/@users')
        console.log('/@users endpoint accessible, got response with', usersTest.users?.length || 0, 'users')
      } catch (testError) {
        console.error('Cannot access /@users endpoint:', testError)
        throw new Error(`Cannot access user management endpoint: ${testError}`)
      }

      // Create user through Plone's @users endpoint
      const payload: any = {
        username: userData.username,
        fullname: userData.fullname,
        email: userData.email,
        password: userData.password
      };
      
      // Add roles only if provided
      if (userData.roles && userData.roles.length > 0) {
        payload.roles = userData.roles;
      }
      
      console.log('Creating user with payload:', JSON.stringify(payload, null, 2));
      
      const newUser = await this.makeRequest('/@users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      
      // Enhanced error reporting
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error(`Authentication failed: ${error.message}. You may need Manager role (not just Site Administrator) to create users.`);
        } else if (error.message.includes('403')) {
          throw new Error(`Permission denied: ${error.message}. You may not have sufficient privileges to create users.`);
        } else if (error.message.includes('404')) {
          throw new Error(`Endpoint not found: ${error.message}. Please ensure plone.restapi is installed in your Plone site.`);
        }
      }
      
      throw error;
    }
  }

  async createStudentAccount(studentData: {
    username: string;
    fullname: string;
    email: string;
    password?: string;
    student_id?: string;
    grade_level?: string;
    classes?: string[];
    // Additional fields for comprehensive student data
    phone?: string;
    address?: string;
    emergency_contact?: string;
    emergency_phone?: string;
    parent_email?: string;
    medical_info?: string;
    special_needs?: string;
    dietary_restrictions?: string;
    notes?: string;
  }): Promise<any> {
    try {
      console.warn('Creating student record only - user account creation requires Plone backend configuration');
      
      // Generate password for reference (but won't create actual account)
      const password = studentData.password || this.generateTempPassword();

      // For now, create student records only (without actual user accounts)
      // This allows the app to work while we configure the Plone backend properly
      const createdRecords = [];
      
      if (studentData.classes && studentData.classes.length > 0) {
        for (const classId of studentData.classes) {
          try {
            const studentRecord = await this.createStudent(classId, {
              name: studentData.fullname,
              email: studentData.email,
              student_id: studentData.student_id,
              grade_level: studentData.grade_level,
              phone: studentData.phone,
              address: studentData.address,
              emergency_contact: studentData.emergency_contact,
              emergency_phone: studentData.emergency_phone,
              parent_email: studentData.parent_email,
              medical_info: studentData.medical_info,
              special_needs: studentData.special_needs,
              dietary_restrictions: studentData.dietary_restrictions,
              notes: studentData.notes
            });
            createdRecords.push({
              classId,
              studentRecord
            });
          } catch (classError) {
            console.warn(`Failed to create student record in class ${classId}:`, classError);
          }
        }
      } else {
        // If no classes specified, create in a default class (if available)
        const classes = await this.getClasses();
        if (classes.length > 0) {
          const defaultClass = classes[0];
          const studentRecord = await this.createStudent(defaultClass.id, {
            name: studentData.fullname,
            email: studentData.email,
            student_id: studentData.student_id,
            grade_level: studentData.grade_level,
            phone: studentData.phone,
            address: studentData.address,
            emergency_contact: studentData.emergency_contact,
            emergency_phone: studentData.emergency_phone,
            parent_email: studentData.parent_email,
            medical_info: studentData.medical_info,
            special_needs: studentData.special_needs,
            dietary_restrictions: studentData.dietary_restrictions,
            notes: studentData.notes
          });
          createdRecords.push({
            classId: defaultClass.id,
            studentRecord
          });
        }
      }

      return {
        username: studentData.username,
        fullname: studentData.fullname,
        email: studentData.email,
        temporaryPassword: password,
        enrolledClasses: studentData.classes || [],
        createdRecords,
        note: 'Student record created. User account creation requires Plone backend configuration with plone.restapi and proper permissions.'
      };
    } catch (error) {
      console.error('Error creating student record:', error);
      throw error;
    }
  }

  async getAllUsers(): Promise<any[]> {
    try {
      const response = await this.makeRequest('/@users');
      return response.users || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async getUserById(userId: string): Promise<any> {
    try {
      return await this.makeRequest(`/@users/${userId}`);
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, updates: {
    fullname?: string;
    email?: string;
    roles?: string[];
    properties?: any;
  }): Promise<any> {
    try {
      return await this.makeRequest(`/@users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.makeRequest(`/@users/${userId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  async resetUserPassword(userId: string, newPassword?: string): Promise<string> {
    try {
      const password = newPassword || this.generateTempPassword();
      
      await this.makeRequest(`/@users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          new_password: password
        }),
      });

      return password;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  // Bulk student import
  async bulkCreateStudents(studentsData: Array<{
    username: string;
    fullname: string;
    email: string;
    student_id?: string;
    grade_level?: string;
    classes?: string[];
  }>): Promise<{
    successful: any[];
    failed: Array<{ student: any; error: string }>;
  }> {
    const results = {
      successful: [] as any[],
      failed: [] as Array<{ student: any; error: string }>
    };

    for (const studentData of studentsData) {
      try {
        const newStudent = await this.createStudentAccount(studentData);
        results.successful.push(newStudent);
      } catch (error) {
        results.failed.push({
          student: studentData,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  // Class enrollment management
  async enrollStudentInClass(studentUsername: string, classId: string): Promise<void> {
    try {
      // Get student user data
      const student = await this.getUserById(studentUsername);
      
      // Create student record in the class
      await this.createStudent(classId, {
        name: student.fullname,
        email: student.email,
        student_id: student.properties?.student_id,
        grade_level: student.properties?.grade_level
      });

      // Grant local roles
      await this.setLocalRoles(`/classes/${classId}`, studentUsername, ['Reader']);
      
    } catch (error) {
      console.error('Error enrolling student in class:', error);
      throw error;
    }
  }

  async unenrollStudentFromClass(studentUsername: string, classId: string): Promise<void> {
    try {
      // Remove student record from class (if it exists as a separate document)
      // This would depend on how student enrollment is tracked
      
      // Remove local roles
      await this.setLocalRoles(`/classes/${classId}`, studentUsername, []);
      
    } catch (error) {
      console.error('Error unenrolling student from class:', error);
      throw error;
    }
  }

  // Helper methods
  private generateTempPassword(): string {
    // Generate a temporary password for new student accounts
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private generateUsername(fullname: string, existingUsers?: string[]): string {
    // Generate username from full name
    const baseName = fullname
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 10);
    
    if (!existingUsers || !existingUsers.includes(baseName)) {
      return baseName;
    }

    // Add number suffix if username exists
    let counter = 1;
    let username = `${baseName}${counter}`;
    while (existingUsers.includes(username)) {
      counter++;
      username = `${baseName}${counter}`;
    }
    return username;
  }

  async getStudentAssignments(studentId: string, classId?: string): Promise<any[]> {
    try {
      if (classId) {
        // Get assignments for a specific class
        const assignments = await this.getAssignments(classId);
        
        // Add submission status for each assignment
                 return Promise.all(assignments.map(async (assignment: PloneAssignment) => {
          const submission = await this.getSubmission(classId, assignment.id!, studentId);
          return {
            ...assignment,
            submission,
            status: this.getAssignmentStatus(assignment, submission)
          };
        }));
      } else {
        // Get all assignments across all classes
        const classes = await this.getStudentClasses(studentId);
        const allAssignments: any[] = [];
        
        for (const cls of classes) {
          const classAssignments = await this.getStudentAssignments(studentId, cls.id);
          allAssignments.push(...classAssignments);
        }
        
        return allAssignments;
      }
    } catch (error) {
      console.error('Error fetching student assignments:', error);
      return [];
    }
  }

  async submitAssignment(classId: string, assignmentId: string, submission: {
    studentId: string;
    content?: string;
    files?: File[];
    submittedAt?: string;
  }): Promise<any> {
    try {
      // Create submission document
      const submissionData = {
        '@type': 'Document',
        id: `${assignmentId}-${submission.studentId}-${Date.now()}`,
        title: `Submission by ${submission.studentId}`,
        description: this.formatSubmissionDescription(submission),
        text: {
          'content-type': 'text/html',
          data: submission.content || ''
        }
      };

      const newSubmission = await this.makeRequest(`/classes/${classId}/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        body: JSON.stringify(submissionData),
      });

      // TODO: Handle file uploads
      if (submission.files && submission.files.length > 0) {
        console.log('File uploads not yet implemented');
      }

      return newSubmission;
    } catch (error) {
      console.error('Error submitting assignment:', error);
      throw error;
    }
  }

  async getSubmission(classId: string, assignmentId: string, studentId: string): Promise<any> {
    try {
      // Look for existing submission
      const submissionsFolder = await this.makeRequest(`/classes/${classId}/assignments/${assignmentId}/submissions`);
      
      if (submissionsFolder.items) {
        // Find submission by student
        const submission = submissionsFolder.items.find((item: any) => 
          item.title.includes(studentId) || item.id.includes(studentId)
        );
        
        if (submission) {
          return {
            ...submission,
            ...this.parseSubmissionMetadata(submission.description || '')
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching submission:', error);
      return null;
    }
  }

  async getStudentGrades(studentId: string, classId?: string): Promise<any[]> {
    try {
      const assignments = await this.getStudentAssignments(studentId, classId);
      
      return assignments
        .filter(assignment => assignment.submission && assignment.submission.grade !== undefined)
        .map(assignment => ({
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          classId: assignment.classId,
          grade: assignment.submission.grade,
          maxPoints: assignment.points || 100,
          submittedAt: assignment.submission.submittedAt,
          gradedAt: assignment.submission.gradedAt,
          feedback: assignment.submission.feedback
        }));
    } catch (error) {
      console.error('Error fetching student grades:', error);
      return [];
    }
  }

  async updateSubmissionGrade(classId: string, assignmentId: string, submissionId: string, gradeData: {
    grade: number;
    feedback?: string;
    gradedAt?: string;
  }): Promise<any> {
    try {
      const updateData = {
        description: this.formatSubmissionDescription({
          ...gradeData,
          gradedAt: gradeData.gradedAt || new Date().toISOString()
        })
      };

      return await this.makeRequest(`/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
    } catch (error) {
      console.error('Error updating submission grade:', error);
      throw error;
    }
  }

  // Helper methods for student functionality
  private formatSubmissionDescription(submissionData: any): string {
    const metadata = {
      studentId: submissionData.studentId || '',
      submittedAt: submissionData.submittedAt || new Date().toISOString(),
      grade: submissionData.grade,
      feedback: submissionData.feedback || '',
      gradedAt: submissionData.gradedAt
    };
    
    const baseDescription = submissionData.description || '';
    return `${baseDescription}\n\n[SUBMISSION_METADATA]${JSON.stringify(metadata)}[/SUBMISSION_METADATA]`;
  }

  private parseSubmissionMetadata(description: string): any {
    const match = description.match(/\[SUBMISSION_METADATA\](.*?)\[\/SUBMISSION_METADATA\]/);
    if (match) {
      try {
        const metadata = JSON.parse(match[1]);
        return {
          studentId: metadata.studentId,
          submittedAt: metadata.submittedAt,
          grade: metadata.grade,
          feedback: metadata.feedback,
          gradedAt: metadata.gradedAt,
          description: description.replace(/\[SUBMISSION_METADATA\].*?\[\/SUBMISSION_METADATA\]/, '').trim()
        };
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  private getAssignmentStatus(assignment: any, submission: any): 'pending' | 'submitted' | 'graded' | 'overdue' {
    if (submission) {
      if (submission.grade !== undefined) {
        return 'graded';
      }
      return 'submitted';
    }
    
    if (assignment.dueDate && new Date(assignment.dueDate) < new Date()) {
      return 'overdue';
    }
    
    return 'pending';
  }
}

// Singleton instance
export const ploneAPI = new PloneAPI(); 