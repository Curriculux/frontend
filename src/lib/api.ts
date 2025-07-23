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

export interface PloneEvent {
  '@id': string;
  id?: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  type: 'meeting' | 'conference' | 'class' | 'deadline' | 'other';
  location?: string;
  isOnline?: boolean;
  meetingUrl?: string;
  attendees?: string[];
  createdBy: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  reminder?: number;
  priority: 'low' | 'medium' | 'high';
  status: 'scheduled' | 'confirmed' | 'cancelled';
  classId?: string;
  assignmentId?: string;
  created?: string;
  modified?: string;
}

export interface PloneMeeting {
  '@id': string;
  id: string;
  title: string;
  description: string;
  startTime: string;
  duration: number; // minutes
  meetingType: 'class' | 'office-hours' | 'meeting' | 'conference';
  classId?: string;
  status: 'scheduled' | 'in-progress' | 'ended' | 'cancelled';
  autoRecord: boolean;
  joinUrl: string;
  zoomMeetingId?: string; // For Zoom integration
  zoomMeetingUrl?: string; // Direct Zoom link
  meetingPlatform: 'zoom' | 'internal' | 'external'; // Platform type
  recordingId?: string;
  attendees?: string[];
  createdBy: string;
  created: string;
  modified: string;
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
      // For students or users without permission to list all classes, 
      // return empty array instead of throwing error
      if (error instanceof Error && error.message.includes('401')) {
        console.log('User does not have permission to list all classes (expected for students)');
        return [];
      }
      
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

  // Meeting Management (extends existing class pattern)
  async createMeeting(meetingData: {
    title: string;
    description?: string;
    startTime: string;
    duration?: number;
    meetingType?: 'class' | 'office-hours' | 'meeting' | 'conference';
    classId?: string;
    autoRecord?: boolean;
  }): Promise<PloneMeeting> {
    try {
      // Validate required fields
      if (!meetingData.title || meetingData.title.trim() === '') {
        throw new Error('Meeting title is required');
      }

      const meetingId = this.generateMeetingId(meetingData.title, meetingData.startTime);
      
      // Create meeting folder using same pattern as createClass
      const meetingFolder = meetingData.classId ? 
        `/classes/${meetingData.classId}/meetings` : 
        '/meetings';
      
      // Ensure meetings folder exists
      await this.ensureMeetingsFolder(meetingFolder);

      const newMeeting = await this.makeRequest(meetingFolder, {
        method: 'POST',
        body: JSON.stringify({
          '@type': 'Folder',
          id: meetingId,
          title: meetingData.title,
          description: this.formatMeetingDescription(meetingData),
        }),
      });

      // Create subfolders for meeting organization
      const meetingPath = `${meetingFolder}/${meetingId}`;
      const subfolders = ['recordings', 'chat', 'participants'];
      
      for (const folder of subfolders) {
        await this.makeRequest(meetingPath, {
          method: 'POST',
          body: JSON.stringify({
            '@type': 'Folder',
            id: folder,
            title: folder.charAt(0).toUpperCase() + folder.slice(1),
            description: `${folder} for ${meetingData.title}`,
          }),
        });
      }

      // Return meeting data
      const meeting: PloneMeeting = {
        '@id': newMeeting['@id'],
        id: meetingId,
        title: meetingData.title,
        description: meetingData.description || '',
        startTime: meetingData.startTime,
        duration: meetingData.duration || 60,
        meetingType: meetingData.meetingType || 'meeting',
        classId: meetingData.classId,
        status: 'scheduled',
        autoRecord: meetingData.autoRecord || false,
        joinUrl: `${newMeeting['@id']}/join`,
        meetingPlatform: 'internal', // Default to internal, can be changed to 'zoom'
        attendees: [],
        createdBy: 'current-user', // TODO: Get from auth context
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };

      return meeting;
    } catch (error) {
      console.error('Error creating meeting:', error);
      throw error;
    }
  }

  async getMeetings(classId?: string): Promise<PloneMeeting[]> {
    try {
      const meetingsPath = classId ? `/classes/${classId}/meetings` : '/meetings';
      const meetingsContainer = await this.makeRequest(meetingsPath);
      
      if (meetingsContainer.items) {
        return meetingsContainer.items.map((item: any) => {
          const id = item['@id'].split('/').pop() || '';
          const metadata = this.parseMeetingMetadata(item.description || '');
          
          return {
            '@id': item['@id'],
            id: id,
            title: item.title,
            description: item.description || '',
            startTime: metadata.startTime || '',
            duration: metadata.duration || 60,
            meetingType: metadata.meetingType || 'meeting',
            classId: classId,
            status: metadata.status || 'scheduled',
            autoRecord: metadata.autoRecord || false,
            joinUrl: `${item['@id']}/join`,
            zoomMeetingId: metadata.zoomMeetingId,
            zoomMeetingUrl: metadata.zoomMeetingUrl,
            meetingPlatform: metadata.meetingPlatform || 'internal',
            recordingId: metadata.recordingId,
            attendees: metadata.attendees || [],
            createdBy: metadata.createdBy || '',
            created: item.created,
            modified: item.modified,
          };
        });
      }
      
      return [];
    } catch (error) {
      console.log('Error fetching meetings:', error);
      return [];
    }
  }

  async getMeeting(meetingId: string, classId?: string): Promise<PloneMeeting> {
    try {
      const meetingPath = classId ? 
        `/classes/${classId}/meetings/${meetingId}` : 
        `/meetings/${meetingId}`;
      
      const meetingData = await this.makeRequest(meetingPath);
      const metadata = this.parseMeetingMetadata(meetingData.description || '');
      
      return {
        '@id': meetingData['@id'],
        id: meetingId,
        title: meetingData.title,
        description: meetingData.description || '',
        startTime: metadata.startTime || '',
        duration: metadata.duration || 60,
        meetingType: metadata.meetingType || 'meeting',
        classId: classId,
        status: metadata.status || 'scheduled',
        autoRecord: metadata.autoRecord || false,
        joinUrl: `${meetingData['@id']}/join`,
        zoomMeetingId: metadata.zoomMeetingId,
        zoomMeetingUrl: metadata.zoomMeetingUrl,
        meetingPlatform: metadata.meetingPlatform || 'internal',
        recordingId: metadata.recordingId,
        attendees: metadata.attendees || [],
        createdBy: metadata.createdBy || '',
        created: meetingData.created,
        modified: meetingData.modified,
      };
    } catch (error) {
      console.error('Error fetching meeting:', error);
      throw error;
    }
  }

  async joinMeeting(meetingId: string, classId?: string) {
    try {
      const meetingPath = classId ? 
        `/classes/${classId}/meetings/${meetingId}` : 
        `/meetings/${meetingId}`;
      
      // TODO: Add actual join logic here
      return {
        meetingId,
        joinUrl: `${meetingPath}/join`,
        canRecord: true, // Check permissions
        canModerate: true, // Check permissions
        status: 'joining'
      };
    } catch (error) {
      console.error('Error joining meeting:', error);
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

  // Meeting helper methods (copy class patterns)
  private generateMeetingId(title: string, startTime: string): string {
    const baseId = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Add date/time to make unique
    const date = new Date(startTime);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return `${baseId}-${dateStr}`;
  }

  private formatMeetingDescription(meetingData: any): string {
    // Store metadata in description (same pattern as classes)
    const metadata = {
      startTime: meetingData.startTime || '',
      duration: meetingData.duration || 60,
      meetingType: meetingData.meetingType || 'meeting',
      autoRecord: meetingData.autoRecord || false,
      classId: meetingData.classId || '',
      status: 'scheduled',
      createdBy: 'current-user', // TODO: Get from auth context
      attendees: [],
    };
    
    return `${meetingData.description || ''}\n\n[METADATA]${JSON.stringify(metadata)}[/METADATA]`;
  }

  private parseMeetingMetadata(description: string): any {
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

  private async ensureMeetingsFolder(meetingFolder: string): Promise<void> {
    try {
      // Try to get the meetings folder
      await this.makeRequest(meetingFolder);
    } catch (error) {
      // If it doesn't exist, create it
      try {
        const parentPath = meetingFolder.substring(0, meetingFolder.lastIndexOf('/'));
        await this.makeRequest(parentPath, {
          method: 'POST',
          body: JSON.stringify({
            '@type': 'Folder',
            id: 'meetings',
            title: 'Meetings',
            description: 'Virtual class meetings and recordings',
          }),
        });
      } catch (createError) {
        console.error('Error creating meetings folder:', createError);
      }
    }
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
        console.log(`Found ${assignmentsFolder.items.length} assignment items for class ${classId}`);
        
        return assignmentsFolder.items.map((item: any, index: number) => {
          // Extract ID from either the id field or from the @id URL
          let assignmentId = item.id;
          if (!assignmentId && item['@id']) {
            // Extract ID from URL like "http://...../classes/precalc/assignments/lab-1" -> "lab-1"
            assignmentId = item['@id'].split('/').pop();
            console.log(`Assignment ${index}: Extracted ID '${assignmentId}' from @id URL: ${item['@id']}`);
          } else if (assignmentId) {
            console.log(`Assignment ${index}: Using provided ID '${assignmentId}'`);
          } else {
            console.warn(`Assignment ${index}: No ID available. Item:`, {
              '@id': item['@id'],
              title: item.title,
              available_fields: Object.keys(item)
            });
          }
          
          return {
            '@id': item['@id'],
            id: assignmentId,
            title: item.title,
            description: item.description || '',
            created: item.created,
            modified: item.modified,
            classId: classId,
            // Parse additional metadata from description
            ...this.parseAssignmentMetadata(item.description || '')
          };
        });
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

      // Automatically create submissions folder if it doesn't exist
      // This ensures students can submit immediately after assignment creation
      try {
        const submissionsPath = `/classes/${classId}/submissions`;
        await this.makeRequest(submissionsPath);
        console.log('Submissions folder already exists');
      } catch (error) {
        // Submissions folder doesn't exist, create it
        console.log('Creating submissions folder for new assignment...');
        try {
          await this.makeRequest(`/classes/${classId}`, {
            method: 'POST',
            body: JSON.stringify({
              '@type': 'Folder',
              id: 'submissions',
              title: 'Assignment Submissions',
              description: 'Student assignment submissions for this class'
            }),
          });
          console.log('Submissions folder created successfully - students can now submit!');
        } catch (createError) {
          console.warn('Could not create submissions folder:', createError);
          // Don't fail assignment creation if submissions folder creation fails
        }
      }

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

  async deleteStudentCompletely(studentData: {
    username?: string;
    classId: string;
    studentId: string;
    deleteUserAccount?: boolean;
  }): Promise<{ recordsDeleted: string[], userAccountDeleted: boolean, errors: string[] }> {
    const results = {
      recordsDeleted: [] as string[],
      userAccountDeleted: false,
      errors: [] as string[]
    };

    try {
      // 1. Delete student record from the specified class
      try {
        await this.deleteStudent(studentData.classId, studentData.studentId);
        results.recordsDeleted.push(`Class: ${studentData.classId}`);
      } catch (error) {
        results.errors.push(`Failed to delete from class ${studentData.classId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // 2. If username provided, try to delete from other classes and user account
      if (studentData.username) {
        // Find all other classes this student might be in
        try {
          const allClasses = await this.getClasses();
          for (const cls of allClasses) {
            if (cls.id !== studentData.classId) {
              try {
                const classStudents = await this.getStudents(cls.id);
                const foundStudent = classStudents.find((s: any) => s.name === studentData.username || s.email?.includes(studentData.username));
                if (foundStudent) {
                  await this.deleteStudent(cls.id, foundStudent.id);
                  results.recordsDeleted.push(`Class: ${cls.id}`);
                }
              } catch (classError) {
                // Ignore errors for classes where student doesn't exist
              }
            }
          }
        } catch (error) {
          results.errors.push(`Error checking other classes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // 3. Delete user account if requested and we have permissions
        if (studentData.deleteUserAccount) {
          try {
            await this.deleteUser(studentData.username);
            results.userAccountDeleted = true;
          } catch (userError) {
            results.errors.push(`Failed to delete user account: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
          }
        }

        // 4. Remove local roles
        try {
          for (const classId of results.recordsDeleted.map(r => r.replace('Class: ', ''))) {
            await this.setLocalRoles(`/classes/${classId}`, studentData.username, []);
          }
        } catch (roleError) {
          results.errors.push(`Failed to remove permissions: ${roleError instanceof Error ? roleError.message : 'Unknown error'}`);
        }
      }

      return results;
    } catch (error) {
      console.error('Error in complete student deletion:', error);
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
      // Convert roles array to object format expected by Plone
      // e.g., ['Reader', 'Editor'] becomes {'Reader': true, 'Editor': true}
      const rolesObj: { [key: string]: boolean } = {};
      roles.forEach(role => {
        rolesObj[role] = true;
      });

      await this.makeRequest(`${objectPath}/@sharing`, {
        method: 'POST',
        body: JSON.stringify({
          entries: [{
            id: principal,
            roles: rolesObj,
            type: 'user' // or 'group'
          }]
        })
      });
    } catch (error) {
      console.error('Failed to set local roles:', error);
      throw error;
    }
  }

  // Grant student permissions for assignment submission
  async grantStudentSubmissionPermissions(classId: string, username: string): Promise<void> {
    try {
      console.log(`Granting submission permissions for student ${username} in class ${classId}`);
      
      // Ensure submissions folder exists first
      const submissionsPath = `/classes/${classId}/submissions`;
      try {
        await this.makeRequest(submissionsPath);
        console.log('Submissions folder exists');
      } catch (error) {
        // Create submissions folder if it doesn't exist
        console.log('Creating submissions folder...');
        await this.makeRequest(`/classes/${classId}`, {
          method: 'POST',
          body: JSON.stringify({
            '@type': 'Folder',
            id: 'submissions',
            title: 'Assignment Submissions',
            description: 'Student assignment submissions for this class'
          }),
        });
        console.log('Submissions folder created');
      }

      // Grant student Contributor role on submissions folder so they can create submissions
      await this.setLocalRoles(submissionsPath, username, ['Contributor']);
      console.log(`Granted Contributor role to ${username} on ${submissionsPath}`);
      
      // Also grant Reader role on the class itself so they can access assignments
      await this.setLocalRoles(`/classes/${classId}`, username, ['Reader']);
      console.log(`Granted Reader role to ${username} on /classes/${classId}`);

    } catch (error) {
      console.error(`Failed to grant submission permissions for student ${username} in class ${classId}:`, error);
      throw error;
    }
  }

  // Fix permissions for existing students (bulk operation)
  async fixStudentSubmissionPermissions(classId?: string): Promise<{ fixed: number; errors: string[] }> {
    try {
      const results = { fixed: 0, errors: [] as string[] };
      
      if (classId) {
        // Fix permissions for students in a specific class
        const students = await this.getStudents(classId);
        console.log(`Fixing submission permissions for ${students.length} students in class ${classId}`);
        
        for (const student of students) {
          try {
            // Try to extract username from student data
            const username = student.email?.split('@')[0] || student.name?.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (username) {
              await this.grantStudentSubmissionPermissions(classId, username);
              results.fixed++;
            } else {
              results.errors.push(`Could not determine username for student: ${student.name}`);
            }
          } catch (error) {
            results.errors.push(`Failed to fix permissions for ${student.name}: ${error}`);
          }
        }
      } else {
        // Fix permissions for all students across all classes
        const classes = await this.getClasses();
        console.log(`Fixing submission permissions across ${classes.length} classes`);
        
        for (const cls of classes) {
          try {
            const classResults = await this.fixStudentSubmissionPermissions(cls.id);
            results.fixed += classResults.fixed;
            results.errors.push(...classResults.errors);
          } catch (error) {
            results.errors.push(`Failed to process class ${cls.id}: ${error}`);
          }
        }
      }
      
      console.log(`Permission fix complete: ${results.fixed} students fixed, ${results.errors.length} errors`);
      return results;
    } catch (error) {
      console.error('Error fixing student submission permissions:', error);
      throw error;
    }
  }

  // Update existing student accounts to use Contributor role instead of Student role
  async updateStudentRolesToContributor(): Promise<{ updated: number; errors: string[] }> {
    try {
      const results = { updated: 0, errors: [] as string[] };
      
      // Get all users
      const users = await this.getAllUsers();
      console.log(`Checking ${users.length} users for Student role...`);
      
      for (const user of users) {
        try {
          // Check if user has Student role
          if (user.roles && user.roles.includes('Student')) {
            console.log(`Updating ${user.username} from Student to Contributor role...`);
            
            // Remove Student role and add Contributor role
            const newRoles = user.roles.filter((role: string) => role !== 'Student');
            if (!newRoles.includes('Contributor')) {
              newRoles.push('Contributor');
            }
            
            // Update user roles
            await this.updateUser(user.username, { roles: newRoles });
            results.updated++;
            console.log(`Successfully updated ${user.username} roles:`, newRoles);
          }
        } catch (error) {
          results.errors.push(`Failed to update user ${user.username}: ${error}`);
        }
      }
      
      console.log(`Role update complete: ${results.updated} students updated, ${results.errors.length} errors`);
      return results;
    } catch (error) {
      console.error('Error updating student roles:', error);
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
  async getStudentClasses(studentUsername: string): Promise<PloneClass[]> {
    try {
      const enrolledClasses: PloneClass[] = [];
      
      // For students, we should try the search approach first as they typically 
      // don't have permission to list all classes
      console.log(`Finding classes for student: ${studentUsername}`);
      
      // Primary approach: Search for the student's own records across the system
      try {
        const searchResponse = await this.makeRequest(`/@search?path=/classes&portal_type=Document&SearchableText=${studentUsername}`, {
          method: 'GET',
        });
        
        if (searchResponse && searchResponse.items) {
          // Look for student records and extract class information
          const classIds = new Set<string>();
          
          searchResponse.items.forEach((item: any) => {
            if (item['@id'] && item['@id'].includes('/classes/') && item['@id'].includes('/students/')) {
              const pathParts = item['@id'].split('/');
              const classesIndex = pathParts.indexOf('classes');
              if (classesIndex >= 0 && classesIndex + 1 < pathParts.length) {
                const classId = pathParts[classesIndex + 1];
                classIds.add(classId);
              }
            }
          });
          
          // For each found class, try to get class details
          for (const classId of classIds) {
            try {
              const classDetail = await this.makeRequest(`/classes/${classId}`, {
                method: 'GET',
              });
              
              if (classDetail) {
                enrolledClasses.push({
                  '@id': classDetail['@id'] || `/classes/${classDetail.id}`,
                  id: classDetail.id,
                  title: classDetail.title,
                  description: classDetail.description,
                  teacher: classDetail.teacher || 'Unknown',
                  created: classDetail.created,
                  modified: classDetail.modified
                });
              }
            } catch (classDetailError) {
              console.warn(`Cannot get details for class ${classId}:`, classDetailError);
            }
          }
          
          console.log(`Found ${enrolledClasses.length} enrolled classes for ${studentUsername}:`, enrolledClasses);
          return enrolledClasses;
        }
      } catch (searchError) {
        console.log('Search approach failed, trying direct class access:', searchError);
      }
      
      // Fallback approach: Try to access classes folder directly (for users with higher permissions)
      try {
        const classesResponse = await this.makeRequest('/classes', {
          method: 'GET',
        });
        
        if (classesResponse && classesResponse.items) {
          // User can see classes folder, iterate through classes
          for (const classItem of classesResponse.items) {
            try {
              // Try to access this specific class
              const classDetail = await this.makeRequest(`/classes/${classItem.id}`, {
                method: 'GET',
              });
              
              if (classDetail) {
                // Try to check if student is enrolled by accessing students folder
                try {
                  const studentsResponse = await this.makeRequest(`/classes/${classItem.id}/students`, {
                    method: 'GET',
                  });
                  
                  if (studentsResponse && studentsResponse.items) {
                    const isEnrolled = studentsResponse.items.some((student: any) => {
                      const studentNameNormalized = student.title?.toLowerCase().replace(/[^a-z0-9]/g, '');
                      const studentIdNormalized = student.id?.toLowerCase();
                      
                      console.log(`Checking enrollment for ${studentUsername} in class ${classItem.id}:`, {
                        studentRecord: student,
                        studentNameNormalized,
                        studentIdNormalized,
                        matches: {
                          byId: studentIdNormalized === studentUsername,
                          byTitle: studentNameNormalized === studentUsername,
                          byIdContains: studentIdNormalized?.includes(studentUsername)
                        }
                      });
                      
                      return studentIdNormalized === studentUsername || 
                             studentNameNormalized === studentUsername ||
                             studentIdNormalized?.includes(studentUsername);
                    });
                    
                    if (isEnrolled) {
                      enrolledClasses.push({
                        '@id': classDetail['@id'] || `/classes/${classDetail.id}`,
                        id: classDetail.id,
                        title: classDetail.title,
                        description: classDetail.description,
                        teacher: classDetail.teacher || 'Unknown',
                        created: classDetail.created,
                        modified: classDetail.modified
                      });
                    }
                  }
                } catch (studentsError) {
                  console.warn(`Cannot access students in class ${classItem.id}:`, studentsError);
                }
              }
            } catch (classError) {
              console.warn(`Cannot access class ${classItem.id}:`, classError);
            }
          }
        }
      } catch (classesError) {
        console.log('Direct class access not available (expected for students):', classesError instanceof Error ? classesError.message : String(classesError));
      }
      
      console.log(`Found ${enrolledClasses.length} enrolled classes for ${studentUsername}:`, enrolledClasses);
      return enrolledClasses;
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

      // Validate user data before sending to Plone
      if (!userData.username || userData.username.length < 3) {
        throw new Error('Username must be at least 3 characters long')
      }
      
      if (!/^[a-zA-Z0-9._-]+$/.test(userData.username)) {
        throw new Error('Username can only contain letters, numbers, dots, hyphens, and underscores')
      }
      
      if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
        throw new Error('Valid email address is required')
      }
      
      if (!userData.password || userData.password.length < 8) {
        throw new Error('Your password must contain at least 8 characters.')
      }

      // Debug: First test if we can access the /@users endpoint at all
      try {
        console.log('Testing /@users endpoint access...')
        const usersTest = await this.makeRequest('/@users')
        console.log('/@users endpoint accessible, got response with', usersTest.users?.length || 0, 'users')
        
        // Also test what methods are allowed
        console.log('Testing POST method acceptance...')
        // Check if the endpoint accepts POST by examining response headers or trying a dry run
      } catch (testError) {
        console.error('Cannot access /@users endpoint:', testError)
        throw new Error(`Cannot access user management endpoint: ${testError}`)
      }

      // Create user through Plone's @users endpoint
      // Try different payload formats to work around Plone validation issues
      const payload: any = {
        username: userData.username,
        fullname: userData.fullname,
        email: userData.email,
        password: userData.password
      };
      
      // Add roles only if provided - some Plone setups require explicit roles
      if (userData.roles && userData.roles.length > 0) {
        payload.roles = userData.roles;
      } else {
        // Always include Member role as default
        payload.roles = ['Member'];
      }
      
      console.log('Creating user with payload:', JSON.stringify(payload, null, 2));
      
      try {
        const newUser = await this.makeRequest('/@users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        return newUser;
      } catch (requestError) {
        console.error('Detailed request error:', requestError);
        
        // Try to get more specific error information
        if (requestError instanceof Error && requestError.message.includes('400')) {
          // Try a simpler payload to see if it's a field issue
          console.log('Retrying with minimal payload...');
          const minimalPayload = {
            username: userData.username,
            email: userData.email,
            password: userData.password,
            roles: ['Member']
          };
          
          try {
            const newUser = await this.makeRequest('/@users', {
              method: 'POST',
              body: JSON.stringify(minimalPayload),
            });
            console.log('Success with minimal payload');
            return newUser;
          } catch (minimalError) {
            console.error('Even minimal payload failed:', minimalError);
            
            // Try one more approach - maybe the issue is with the Content-Type
            console.log('Trying with explicit Content-Type header...');
            try {
              const newUser = await this.makeRequest('/@users', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify(minimalPayload),
              });
              console.log('Success with explicit headers');
              return newUser;
            } catch (headerError) {
              console.error('Failed even with explicit headers:', headerError);
              throw new Error(`All user creation attempts failed. Last error: ${headerError}. This may indicate a Plone backend configuration issue.`);
            }
          }
        }
        
                 throw requestError;
       }
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
        } else if (error.message.includes('400')) {
          throw new Error(`Invalid user data: ${error.message}. Check username format, email validity, and password requirements.`);
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
      // Generate password if not provided
      const password = studentData.password || this.generateTempPassword();

      let userAccount = null;

      // Create the actual Plone user account - REQUIRED for student creation
      try {
        userAccount = await this.createUser({
          username: studentData.username,
          fullname: studentData.fullname,
          email: studentData.email,
          password: password,
          roles: ['Member', 'Contributor'] // Give students Contributor role so they can create submissions
          // Note: Removing properties as they may cause 400 errors in some Plone setups
        });
        console.log('Successfully created Plone user account for student:', studentData.username);
      } catch (userError) {
        console.error('Failed to create Plone user account - aborting student creation:', userError);
        throw new Error(`Cannot create student without user account: ${String(userError)}`);
      }

      // Create student records in classes regardless of user account creation success
      const createdRecords = [];
      
      console.log('Creating student records for classes:', studentData.classes);
      
      if (studentData.classes && studentData.classes.length > 0) {
        console.log('Processing specified classes:', studentData.classes);
        for (const classId of studentData.classes) {
          try {
            console.log(`Creating student record in class: ${classId}`);
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
            console.log(`Successfully created student record in class ${classId}:`, studentRecord);
            createdRecords.push({
              classId,
              studentRecord
            });

            // If user account was created successfully, grant class access
            if (userAccount) {
              try {
                // Grant basic class access
                await this.setLocalRoles(`/classes/${classId}`, studentData.username, ['Reader']);
                // Grant assignment submission permissions
                await this.grantStudentSubmissionPermissions(classId, studentData.username);
                console.log(`Successfully granted all permissions to student ${studentData.username} in class ${classId}`);
              } catch (roleError) {
                console.warn(`Failed to set permissions for student ${studentData.username} in class ${classId}:`, roleError);
              }
            }
          } catch (classError) {
            console.warn(`Failed to create student record in class ${classId}:`, classError);
          }
        }
      } else {
        console.log('No classes specified, using default class logic');
        // If no classes specified, create in a default class (if available)
        const classes = await this.getClasses();
        if (classes.length > 0) {
          const defaultClass = classes[0];
          console.log(`Creating student record in default class: ${defaultClass.id}`);
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

          // If user account was created successfully, grant class access
          if (userAccount) {
            try {
              // Grant basic class access
              await this.setLocalRoles(`/classes/${defaultClass.id}`, studentData.username, ['Reader']);
              // Grant assignment submission permissions
              await this.grantStudentSubmissionPermissions(defaultClass.id, studentData.username);
              console.log(`Successfully granted all permissions to student ${studentData.username} in class ${defaultClass.id}`);
            } catch (roleError) {
              console.warn(`Failed to set permissions for student ${studentData.username} in class ${defaultClass.id}:`, roleError);
            }
          }
        }
      }

      return {
        username: studentData.username,
        fullname: studentData.fullname,
        email: studentData.email,
        temporaryPassword: password,
        enrolledClasses: studentData.classes || [],
        createdRecords,
        userAccount: userAccount,
        canLogin: true, // Always true since we only get here if user creation succeeded
        note: 'Student account created successfully. Student can now log in with the provided credentials.'
      };
    } catch (error) {
      console.error('Error creating student account:', error);
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

  // Password validation method that uses Plone's actual validation
  async validatePassword(password: string, username?: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      if (!password) {
        return { isValid: true }; // Empty password is okay for auto-generation
      }

      // Try to use Plone's registration tool validation endpoint if available
      try {
        const response = await this.makeRequest('/portal_registration/testPasswordValidity', {
          method: 'POST',
          body: JSON.stringify({
            password: password
          }),
        });
        
        // If we get a successful response, check the result
        if (response && response.valid === false && response.error) {
          return { isValid: false, error: response.error };
        }
        
        return { isValid: true };
      } catch (registrationError) {
        // If the registration tool endpoint doesn't exist, try a different approach
        console.log('Registration tool validation not available, trying user creation test');
        
        // Fallback: Try creating with obviously non-existent username to test password validation
        const testUserData = {
          username: 'plone_password_test_' + Date.now() + '_' + Math.random().toString(36),
          fullname: 'Password Test User',
          email: 'passwordtest' + Date.now() + '@nonexistent-domain-for-testing.invalid',
          password: password,
          roles: ['Member']
        };

        try {
          await this.makeRequest('/@users', {
            method: 'POST',
            body: JSON.stringify(testUserData),
          });
          
          // If user creation succeeded, password is valid - clean up
          try {
            await this.makeRequest(`/@users/${testUserData.username}`, {
              method: 'DELETE',
            });
          } catch (deleteError) {
            console.warn('Could not delete test user:', deleteError);
          }
          
          return { isValid: true };
        } catch (error) {
          if (error instanceof Error) {
            const errorMessage = error.message;
            
            // Extract actual user-friendly error message from nested API response
            let cleanError = errorMessage;
            
            // Try to parse the nested error structure
            try {
              // Look for patterns like: {"error":{"error":{"message":"Your password must contain...","type":"..."}}}
              const messageMatch = errorMessage.match(/"message":"([^"]+)"/);
              if (messageMatch && messageMatch[1]) {
                cleanError = messageMatch[1];
              } else {
                // Fallback: look for "Your password" or similar patterns
                const passwordErrorMatch = errorMessage.match(/Your password[^"]*[.!]/);
                if (passwordErrorMatch) {
                  cleanError = passwordErrorMatch[0];
                }
              }
            } catch (parseError) {
              console.warn('Could not parse error message:', parseError);
            }
            
            // Check for password-specific validation errors
            if (cleanError.toLowerCase().includes('password')) {
              return { isValid: false, error: cleanError };
            }
            
            // If it's a username/email conflict, password is likely valid
            if (errorMessage.toLowerCase().includes('username') || 
                errorMessage.toLowerCase().includes('email') ||
                errorMessage.toLowerCase().includes('already in use')) {
              return { isValid: true };
            }
            
            // For other errors, assume it's a password issue if we can't determine otherwise
            return { isValid: false, error: 'Password validation failed: ' + errorMessage };
          }
          
          return { isValid: false, error: 'Unknown validation error' };
        }
      }
    } catch (error) {
      console.error('Error validating password:', error);
      // Fallback to basic client-side validation
      if (password.length < 8) {
        return { isValid: false, error: 'Your password must contain at least 8 characters.' };
      }
      return { isValid: true }; // Assume valid if we can't validate
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

  // Calendar Event Management Methods
  async getEvents(): Promise<PloneEvent[]> {
    try {
      // Get all events from the events container
      const eventsContainer = await this.makeRequest('/events');
      
      if (eventsContainer.items) {
        return eventsContainer.items.map((item: any) => {
          const metadata = this.parseEventMetadata(item.description || '');
          return {
            '@id': item['@id'],
            id: item.id,
            title: item.title,
            description: item.description || '',
            created: item.created,
            modified: item.modified,
            ...metadata
          };
        });
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async createEvent(eventData: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    type: PloneEvent['type'];
    location?: string;
    isOnline?: boolean;
    meetingUrl?: string;
    attendees?: string[];
    priority: PloneEvent['priority'];
    status: PloneEvent['status'];
    reminder?: number;
    classId?: string;
    assignmentId?: string;
  }): Promise<PloneEvent> {
    try {
      // Ensure events container exists
      await this.ensureEventsContainer();

      const newEvent = await this.makeRequest('/events', {
        method: 'POST',
        body: JSON.stringify({
          '@type': 'Document',
          id: this.generateEventId(eventData.title),
          title: eventData.title,
          description: this.formatEventDescription(eventData),
        }),
      });

      return {
        ...newEvent,
        ...this.parseEventMetadata(newEvent.description || '')
      };
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async getEvent(eventId: string): Promise<PloneEvent> {
    try {
      const event = await this.makeRequest(`/events/${eventId}`);
      return {
        ...event,
        ...this.parseEventMetadata(event.description || '')
      };
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, updates: Partial<PloneEvent>): Promise<PloneEvent> {
    try {
      const updateData = {
        title: updates.title,
        description: this.formatEventDescription(updates),
      };
      
      return await this.makeRequest(`/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.makeRequest(`/events/${eventId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<PloneEvent[]> {
    try {
      const allEvents = await this.getEvents();
      
      return allEvents.filter(event => {
        const eventStart = new Date(event.startDate);
        const rangeStart = new Date(startDate);
        const rangeEnd = new Date(endDate);
        
        return eventStart >= rangeStart && eventStart <= rangeEnd;
      });
    } catch (error) {
      console.error('Error fetching events by date range:', error);
      return [];
    }
  }

  async getEventsByType(type: PloneEvent['type']): Promise<PloneEvent[]> {
    try {
      const allEvents = await this.getEvents();
      return allEvents.filter(event => event.type === type);
    } catch (error) {
      console.error('Error fetching events by type:', error);
      return [];
    }
  }

  // Helper methods for events
  private async ensureEventsContainer(): Promise<void> {
    try {
      // Try to get the events container
      await this.makeRequest('/events');
    } catch (error) {
      // If it doesn't exist, create it
      try {
        await this.makeRequest('/', {
          method: 'POST',
          body: JSON.stringify({
            '@type': 'Folder',
            id: 'events',
            title: 'Events',
            description: 'Calendar events and scheduling',
          }),
        });
      } catch (createError) {
        console.warn('Could not create events container:', createError);
      }
    }
  }

  private generateEventId(title: string): string {
    const timestamp = Date.now();
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 20);
    return `${cleanTitle}-${timestamp}`;
  }

  private formatEventDescription(eventData: any): string {
    const metadata = {
      startDate: eventData.startDate || '',
      endDate: eventData.endDate || '',
      type: eventData.type || 'other',
      location: eventData.location || '',
      isOnline: eventData.isOnline || false,
      meetingUrl: eventData.meetingUrl || '',
      attendees: eventData.attendees || [],
      priority: eventData.priority || 'medium',
      status: eventData.status || 'scheduled',
      reminder: eventData.reminder || 15,
      classId: eventData.classId || '',
      assignmentId: eventData.assignmentId || '',
      createdBy: eventData.createdBy || 'unknown',
    };
    
    const baseDescription = eventData.description || '';
    return `${baseDescription}\n\n[EVENT_METADATA]${JSON.stringify(metadata)}[/EVENT_METADATA]`;
  }

  private parseEventMetadata(description: string): any {
    const match = description.match(/\[EVENT_METADATA\](.*?)\[\/EVENT_METADATA\]/);
    if (match) {
      try {
        const metadata = JSON.parse(match[1]);
        return {
          startDate: metadata.startDate,
          endDate: metadata.endDate,
          type: metadata.type,
          location: metadata.location,
          isOnline: metadata.isOnline,
          meetingUrl: metadata.meetingUrl,
          attendees: metadata.attendees,
          priority: metadata.priority,
          status: metadata.status,
          reminder: metadata.reminder,
          classId: metadata.classId,
          assignmentId: metadata.assignmentId,
          createdBy: metadata.createdBy,
          description: description.replace(/\[EVENT_METADATA\].*?\[\/EVENT_METADATA\]/, '').trim()
        };
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  async getStudentAssignments(studentId: string, classId?: string): Promise<any[]> {
    try {
      if (classId) {
        // Get assignments for a specific class
        const assignments = await this.getAssignments(classId);
        
        // Add submission status for each assignment
        return Promise.all(assignments.map(async (assignment: PloneAssignment) => {
          // Validate assignment ID before trying to fetch submission
          if (!assignment.id) {
            console.warn('Assignment missing ID, skipping submission fetch:', assignment);
            return {
              ...assignment,
              submission: null,
              status: 'pending'
            };
          }
          
          try {
            const submission = await this.getSubmission(classId, assignment.id, studentId);
            return {
              ...assignment,
              submission,
              status: this.getAssignmentStatus(assignment, submission)
            };
          } catch (submissionError) {
            // If we can't fetch submission data, assume no submission exists
            // Don't log 404 errors for missing submissions - this is expected
            if (!(submissionError instanceof Error && submissionError.message.includes('404'))) {
              console.warn(`Could not fetch submission for assignment ${assignment.id}:`, submissionError);
            }
            return {
              ...assignment,
              submission: null,
              status: this.getAssignmentStatus(assignment, null)
            };
          }
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
      // Validate required parameters
      if (!classId || !assignmentId || !submission.studentId) {
        throw new Error('Missing required parameters for assignment submission');
      }
      
      if (assignmentId === 'undefined' || assignmentId === 'null' || assignmentId === 'unknown') {
        throw new Error('Invalid assignment ID. Cannot submit assignment without a valid identifier.');
      }
      
      console.log('Submitting assignment:', { classId, assignmentId, studentId: submission.studentId });
      
      const submissionId = `${assignmentId}-${submission.studentId}-${Date.now()}`;
      const submissionsPath = `/classes/${classId}/submissions`;
      
      // Check if submissions folder exists
      try {
        await this.makeRequest(submissionsPath);
      } catch (error) {
        // If submissions folder doesn't exist, try to create it
        console.log('Submissions folder not found, attempting to create...');
        try {
          await this.makeRequest(`/classes/${classId}`, {
            method: 'POST',
            body: JSON.stringify({
              '@type': 'Folder',
              id: 'submissions',
              title: 'Assignment Submissions',
              description: 'Student assignment submissions for this class'
            }),
          });
          console.log('Submissions folder created successfully');
        } catch (createError) {
          throw new Error('Unable to submit assignment. The submissions system is not properly set up for this class.');
        }
      }
      
      // Create the submission document
      const submissionData = {
        '@type': 'Document',
        id: submissionId,
        title: `${assignmentId} - ${submission.studentId}`,
        description: this.formatSubmissionDescription({
          studentId: submission.studentId,
          assignmentId: assignmentId,
          submittedAt: submission.submittedAt || new Date().toISOString(),
          content: submission.content || ''
        }),
        text: {
          'content-type': 'text/html',
          data: submission.content || 'File submission - see attachments'
        }
      };

      console.log('Creating submission:', submissionData);

      try {
        const submissionDocument = await this.makeRequest(submissionsPath, {
          method: 'POST',
          body: JSON.stringify(submissionData),
        });

        console.log('Assignment submitted successfully:', submissionDocument);

        return {
          ...submissionDocument,
          submissionId,
          assignmentId,
          submittedAt: submission.submittedAt || new Date().toISOString(),
          studentId: submission.studentId
        };
      } catch (submissionError) {
        // If we get a 401 error, the student doesn't have permission to create submissions
        if (submissionError instanceof Error && submissionError.message.includes('401')) {
          console.log('Permission denied for submission, attempting to auto-fix permissions...');
          
          try {
            // Auto-grant submission permissions for this student
            await this.grantStudentSubmissionPermissions(classId, submission.studentId);
            console.log('Successfully granted permissions, retrying submission...');
            
            // Retry the submission
            const submissionDocument = await this.makeRequest(submissionsPath, {
              method: 'POST',
              body: JSON.stringify(submissionData),
            });

            console.log('Assignment submitted successfully after permission fix:', submissionDocument);
            
            return {
              ...submissionDocument,
              submissionId,
              assignmentId,
              submittedAt: submission.submittedAt || new Date().toISOString(),
              studentId: submission.studentId
            };
          } catch (retryError) {
            console.error('Failed to fix permissions or retry submission:', retryError);
            throw new Error('Unable to submit assignment. Please contact your teacher if this problem persists.');
          }
        } else {
          // Re-throw other errors
          throw submissionError;
        }
      }
    } catch (error) {
      console.error('Error submitting assignment:', error);
      throw error;
    }
  }

  async uploadSubmissionFiles(classId: string, assignmentId: string, submissionId: string, files: File[]): Promise<any[]> {
    try {
      const attachmentsPath = `/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}`;
      
      // Create attachments folder
      await this.makeRequest(attachmentsPath, {
        method: 'POST',
        body: JSON.stringify({
          '@type': 'Folder',
          id: 'attachments',
          title: 'File Attachments',
          description: 'Files submitted with this assignment'
        }),
      });

      const uploadedFiles = [];
      
      for (const file of files) {
        try {
          // Create file object in Plone
          const fileData = new FormData();
          fileData.append('file', file);
          fileData.append('@type', 'File');
          fileData.append('title', file.name);
          fileData.append('id', this.generateSafeId(file.name));

          const uploadedFile = await fetch(`${API_BASE}${attachmentsPath}/attachments`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
            },
            body: fileData,
          });

          if (uploadedFile.ok) {
            const fileResult = await uploadedFile.json();
            uploadedFiles.push(fileResult);
          }
        } catch (fileError) {
          console.error(`Error uploading file ${file.name}:`, fileError);
        }
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Error uploading submission files:', error);
      throw error;
    }
  }

  async setSubmissionPermissions(classId: string, assignmentId: string, submissionId: string, studentId: string): Promise<void> {
    try {
      const submissionPath = `/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}`;
      
      // Give student read access to their own submission
      await this.setLocalRoles(submissionPath, studentId, ['Reader']);
      
      // Teachers get full access (inherited from class permissions)
      // This assumes teachers have Editor/Manager roles on the class
    } catch (error) {
      console.error('Error setting submission permissions:', error);
    }
  }

  async getSubmission(classId: string, assignmentId: string, studentId: string): Promise<any> {
    try {
      // Validate inputs
      if (!classId || !assignmentId || !studentId) {
        console.warn('getSubmission called with invalid parameters:', { classId, assignmentId, studentId });
        return null;
      }
      
      if (assignmentId === 'undefined' || assignmentId === 'null') {
        console.warn('getSubmission called with invalid assignmentId:', assignmentId);
        return null;
      }
      
      // For now, since submissions are stored in the class folder, 
      // we'll just return null to indicate no submission exists yet
      // This prevents 404 errors when checking for existing submissions
      console.log(`Checking for submission: assignment=${assignmentId}, student=${studentId}`);
      
      // In a real implementation, we would search for submission documents
      // in the class folder that match the assignmentId and studentId
      // For now, return null to indicate no submission exists
      return null;
      
      // Original complex implementation commented out for reference:
      /*
      const submissionsPath = `/classes/${classId}/assignments/${assignmentId}/submissions`;
      const submissionsFolder = await this.makeRequest(submissionsPath);
      
      if (submissionsFolder.items) {
        // Find submission folder by student ID
        const submissionFolder = submissionsFolder.items.find((item: any) => 
          item.id.startsWith(studentId) || item.title.includes(studentId)
        );
        
        if (submissionFolder) {
          // Get submission content and attachments
          const submissionDetails = await this.makeRequest(submissionFolder['@id']);
          
          let submissionContent = null;
          let attachments = [];
          let feedback = null;

          if (submissionDetails.items) {
            for (const item of submissionDetails.items) {
              if (item.id === 'submission') {
                submissionContent = await this.makeRequest(item['@id']);
              } else if (item.id === 'attachments') {
                const attachmentsFolder = await this.makeRequest(item['@id']);
                attachments = attachmentsFolder.items || [];
              } else if (item.id === 'feedback') {
                const feedbackFolder = await this.makeRequest(item['@id']);
                feedback = feedbackFolder.items || [];
              }
            }
          }

          return {
            ...submissionFolder,
            content: submissionContent,
            attachments,
            feedback,
            ...this.parseSubmissionMetadata(submissionContent?.description || '')
          };
        }
      }
      
      return null;
      */
    } catch (error) {
      console.error('Error fetching submission:', error);
      return null;
    }
  }

  async addSubmissionFeedback(classId: string, assignmentId: string, submissionId: string, feedback: {
    comments: string;
    grade?: number;
    rubricData?: any;
    teacherId: string;
  }): Promise<any> {
    try {
      const submissionPath = `/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}`;
      
      // Create feedback folder if it doesn't exist
      try {
        await this.makeRequest(`${submissionPath}/feedback`);
      } catch (error) {
        await this.makeRequest(submissionPath, {
          method: 'POST',
          body: JSON.stringify({
            '@type': 'Folder',
            id: 'feedback',
            title: 'Teacher Feedback',
            description: 'Feedback and grading for this submission'
          }),
        });
      }

      // Add comments document
      const commentsDoc = await this.makeRequest(`${submissionPath}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          '@type': 'Document',
          id: `comments-${Date.now()}`,
          title: 'Teacher Comments',
          description: this.formatFeedbackDescription(feedback),
          text: {
            'content-type': 'text/html',
            data: feedback.comments
          }
        }),
      });

      // Update submission with grade if provided
      if (feedback.grade !== undefined) {
        await this.updateSubmissionGrade(classId, assignmentId, submissionId, {
          grade: feedback.grade,
          feedback: feedback.comments,
          gradedAt: new Date().toISOString()
        });
      }

      return commentsDoc;
    } catch (error) {
      console.error('Error adding submission feedback:', error);
      throw error;
    }
  }

  private formatFeedbackDescription(feedback: any): string {
    const metadata = {
      teacherId: feedback.teacherId,
      grade: feedback.grade,
      gradedAt: new Date().toISOString(),
      rubricData: feedback.rubricData
    };
    
    return `Teacher feedback\n\n[FEEDBACK_METADATA]${JSON.stringify(metadata)}[/FEEDBACK_METADATA]`;
  }

  private generateSafeId(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
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

  // Advanced submission management methods

  async getSubmissionHistory(classId: string, assignmentId: string, studentId: string): Promise<any[]> {
    try {
      const submissionsPath = `/classes/${classId}/assignments/${assignmentId}/submissions`;
      const submissionsFolder = await this.makeRequest(submissionsPath);
      
      if (submissionsFolder.items) {
        // Find all submissions by this student (for versioning)
        const studentSubmissions = submissionsFolder.items.filter((item: any) => 
          item.id.startsWith(studentId)
        );
        
        // Sort by creation date
        return studentSubmissions.sort((a: any, b: any) => 
          new Date(b.created).getTime() - new Date(a.created).getTime()
        );
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching submission history:', error);
      return [];
    }
  }

  async createSubmissionVersion(classId: string, assignmentId: string, studentId: string, newContent: {
    content?: string;
    files?: File[];
    versionNote?: string;
  }): Promise<any> {
    try {
      // Create a new versioned submission
      const versionId = `${studentId}-v${Date.now()}`;
      
      return await this.submitAssignment(classId, assignmentId, {
        studentId: versionId, // Use versioned ID
        content: newContent.content,
        files: newContent.files,
        submittedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating submission version:', error);
      throw error;
    }
  }

  async getAllSubmissionsForAssignment(classId: string, assignmentId: string): Promise<any[]> {
    try {
      const submissionsPath = `/classes/${classId}/assignments/${assignmentId}/submissions`;
      const submissionsFolder = await this.makeRequest(submissionsPath);
      
      if (submissionsFolder.items) {
        const submissions = [];
        
        for (const submissionFolder of submissionsFolder.items) {
          // Get detailed submission data
          const submissionDetails = await this.makeRequest(submissionFolder['@id']);
          
          let submissionContent = null;
          let attachments = [];
          let feedback = [];

          if (submissionDetails.items) {
            for (const item of submissionDetails.items) {
              if (item.id === 'submission') {
                submissionContent = await this.makeRequest(item['@id']);
              } else if (item.id === 'attachments') {
                const attachmentsFolder = await this.makeRequest(item['@id']);
                attachments = attachmentsFolder.items || [];
              } else if (item.id === 'feedback') {
                const feedbackFolder = await this.makeRequest(item['@id']);
                feedback = feedbackFolder.items || [];
              }
            }
          }

          submissions.push({
            ...submissionFolder,
            content: submissionContent,
            attachments,
            feedback,
            studentId: this.extractStudentIdFromSubmission(submissionFolder.id),
            ...this.parseSubmissionMetadata(submissionContent?.description || '')
          });
        }
        
        return submissions;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching all submissions:', error);
      return [];
    }
  }

  async bulkGradeSubmissions(classId: string, assignmentId: string, grades: Array<{
    studentId: string;
    grade: number;
    feedback?: string;
    teacherId: string;
  }>): Promise<any[]> {
    const results = [];
    
    for (const gradeData of grades) {
      try {
        // Find the submission
        const submission = await this.getSubmission(classId, assignmentId, gradeData.studentId);
        
        if (submission) {
          await this.addSubmissionFeedback(classId, assignmentId, submission.id, {
            comments: gradeData.feedback || '',
            grade: gradeData.grade,
            teacherId: gradeData.teacherId
          });
          
          results.push({
            studentId: gradeData.studentId,
            success: true,
            grade: gradeData.grade
          });
        } else {
          results.push({
            studentId: gradeData.studentId,
            success: false,
            error: 'Submission not found'
          });
        }
      } catch (error) {
        results.push({
          studentId: gradeData.studentId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  async downloadSubmissionAsZip(classId: string, assignmentId: string, studentId?: string): Promise<Blob> {
    try {
      const endpoint = studentId 
        ? `/classes/${classId}/assignments/${assignmentId}/submissions/download?student=${studentId}`
        : `/classes/${classId}/assignments/${assignmentId}/submissions/download`;
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to download submissions');
      }
      
      return response.blob();
    } catch (error) {
      console.error('Error downloading submissions:', error);
      throw error;
    }
  }

  async setSubmissionWorkflowState(classId: string, assignmentId: string, submissionId: string, state: 'submitted' | 'under_review' | 'graded' | 'returned'): Promise<void> {
    try {
      const submissionPath = `/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}`;
      
      // Use Plone's workflow system
      await this.transitionWorkflow(submissionPath, this.getWorkflowTransition(state));
    } catch (error) {
      console.error('Error setting submission workflow state:', error);
      throw error;
    }
  }

  private getWorkflowTransition(targetState: string): string {
    const transitions: { [key: string]: string } = {
      'submitted': 'submit',
      'under_review': 'review',
      'graded': 'grade',
      'returned': 'return'
    };
    
    return transitions[targetState] || 'submit';
  }

  private extractStudentIdFromSubmission(submissionId: string): string {
    // Extract student ID from submission folder ID (format: studentId-timestamp)
    return submissionId.split('-')[0];
  }

  // Submission analytics and reporting
  async getSubmissionAnalytics(classId: string, assignmentId: string): Promise<any> {
    try {
      const submissions = await this.getAllSubmissionsForAssignment(classId, assignmentId);
      
      const analytics = {
        totalSubmissions: submissions.length,
        submissionRate: 0, // Would need total enrolled students
        averageGrade: 0,
        gradedSubmissions: 0,
        lateSubmissions: 0,
        submissionsByDate: {} as { [key: string]: number },
        gradeDistribution: {
          'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0
        }
      };
      
      let totalGrade = 0;
      let gradedCount = 0;
      
      // Get assignment due date for late calculation
      const assignment = await this.getAssignment(classId, assignmentId);
      const dueDate = assignment?.dueDate ? new Date(assignment.dueDate) : null;
      
      submissions.forEach(submission => {
        // Count submissions by date
        const submitDate = new Date(submission.created).toDateString();
        analytics.submissionsByDate[submitDate] = (analytics.submissionsByDate[submitDate] || 0) + 1;
        
        // Check if late
        if (dueDate && new Date(submission.created) > dueDate) {
          analytics.lateSubmissions++;
        }
        
        // Grade analysis
        if (submission.grade !== undefined && submission.grade !== null) {
          gradedCount++;
          totalGrade += submission.grade;
          
          // Grade distribution (assuming 0-100 scale)
          if (submission.grade >= 90) analytics.gradeDistribution.A++;
          else if (submission.grade >= 80) analytics.gradeDistribution.B++;
          else if (submission.grade >= 70) analytics.gradeDistribution.C++;
          else if (submission.grade >= 60) analytics.gradeDistribution.D++;
          else analytics.gradeDistribution.F++;
        }
      });
      
      analytics.gradedSubmissions = gradedCount;
      analytics.averageGrade = gradedCount > 0 ? totalGrade / gradedCount : 0;
      
      return analytics;
    } catch (error) {
      console.error('Error getting submission analytics:', error);
      return null;
    }
  }
}

// Singleton instance
export const ploneAPI = new PloneAPI(); 