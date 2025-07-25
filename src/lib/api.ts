// Use NextJS proxy to avoid CORS issues - requests go to /api/plone/* and get proxied to Plone backend
const API_BASE = process.env.NEXT_PUBLIC_PLONE_API_URL || '/api/plone';

import { s3Service } from './s3';

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
  recordingS3Key?: string; // S3 key for recording file
  recordingUrl?: string; // S3 URL for recording file
  attendees?: string[];
  createdBy: string;
  created: string;
  modified: string;
}

export interface PloneTeacher {
  '@id': string;
  id?: string;
  username: string;
  fullname: string;
  email: string;
  roles: string[];
  created?: string;
  modified?: string;
  
  // Teacher-specific data
  department?: string;
  office?: string;
  phone?: string;
  bio?: string;
  
  // Teaching assignments
  classes?: string[];
  subjects?: string[];
  
  // Display helpers
  accountType?: 'teacher' | 'admin';
}

export class PloneAPI {
  private token: string | null = null;
  private userManagementAvailable: boolean | null = null; // Cache the availability check

  constructor() {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('plone_token')
    }
  }

  // Retry mechanism for database conflict errors
  private async retryOnConflict<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 100
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a database conflict error
        const isConflictError = error.message && 
          (error.message.includes('ConflictError') || 
           error.message.includes('database conflict') ||
           error.message.includes('conflict error'));
        
        // If it's not a conflict error or we've exhausted retries, throw
        if (!isConflictError || attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        console.warn(`Database conflict detected, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
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
      // For security reasons, don't expose detailed error messages from the API
      // Only include response body for specific endpoints that need it
      let errorDetails = '';
      
      // Only include detailed errors for non-authentication endpoints
      if (response.status !== 401 && response.status !== 403) {
        try {
          const errorBody = await response.text();
          // Sanitize error body to only include safe information
          if (errorBody && !errorBody.toLowerCase().includes('password') && 
              !errorBody.toLowerCase().includes('credential') &&
              !errorBody.toLowerCase().includes('unauthorized')) {
            errorDetails = ` - ${errorBody}`;
          }
        } catch (e) {
          // Ignore error parsing, use default message
        }
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
    
    // Reset user management availability cache when token changes
    this.userManagementAvailable = null;
    
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

  // Check if user management endpoints are available (cached)
  private async checkUserManagementAvailability(): Promise<boolean> {
    if (this.userManagementAvailable !== null) {
      return this.userManagementAvailable;
    }

    try {
      await this.makeRequest('/@users', { method: 'GET' });
      this.userManagementAvailable = true;
      console.log('User management endpoint is available');
      return true;
    } catch (error: any) {
      this.userManagementAvailable = false;
      console.warn('User management endpoint not available:', error.message);
      return false;
    }
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
          
          // Clean description by removing metadata
          const cleanDescription = (item.description || '').replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim();
          
          return {
            '@id': item['@id'],
            id: id,
            title: item.title,
            description: cleanDescription,
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
      const subfolders = ['assignments', 'resources', 'students', 'grades', 'meetings'];
      
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

      // Auto-setup permissions for the current user (who created the class)
      try {
        const currentUser = await this.getCurrentUser();
        if (currentUser && currentUser.username) {
          console.log(`Auto-setting up class creator ${currentUser.username} as teacher for class ${newClass.id}`);
          await this.setupTeacherForClass(currentUser.username, newClass.id);
          console.log(`Successfully set up ${currentUser.username} as teacher for class ${newClass.id}`);
        }
      } catch (setupError) {
        console.warn(`Could not auto-setup creator permissions:`, setupError);
        // Don't fail class creation if permission setup fails
      }

      // If a different teacher is specified, try to set up their permissions too
      if (classData.teacher && classData.teacher !== 'Unassigned') {
        try {
          // Try to extract username from teacher name (basic approach)
          const teacherUsername = classData.teacher.toLowerCase().replace(/[^a-z0-9]/g, '');
          console.log(`Attempting to set up additional teacher permissions for: ${teacherUsername}`);
          
          // Check if this user exists and set up permissions
          await this.setupTeacherForClass(teacherUsername, newClass.id);
          console.log(`Successfully set up teacher ${teacherUsername} for class ${newClass.id}`);
        } catch (teacherError) {
          console.warn(`Could not auto-setup teacher permissions:`, teacherError);
          // Don't fail - the creator already has permissions
        }
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
      
      // Clean description by removing metadata
      const cleanDescription = (classData.description || '').replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim();
      
      return {
        ...classData,
        description: cleanDescription,
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
      const meetingId = this.generateMeetingId(meetingData.title, meetingData.startTime);
      // Generate unique join URL for this meeting
      const joinUrl = `/meeting/${meetingId}${meetingData.classId ? `?classId=${meetingData.classId}` : ''}`;
      
      // Create meeting in the meetings subfolder
      const targetPath = meetingData.classId ? `classes/${meetingData.classId}/meetings` : 'meetings';
      
      console.log(`Creating meeting with ID: ${meetingId} in path: ${targetPath}`);
      
      // Create meeting as a Folder so it can contain recordings
      const response = await this.makeRequest(`/${targetPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'Folder',
          id: meetingId,
          title: meetingData.title,
          description: this.formatMeetingDescription({
            ...meetingData,
            joinUrl,
            meetingPlatform: 'internal',
            zoomMeetingId: '', // Not using Zoom anymore
            zoomMeetingUrl: '' // Not using Zoom anymore
          })
        })
      });
      
      console.log(`Meeting created with response ID: ${response.id}, @id: ${response['@id']}`);
      
      const metadata = this.parseMeetingMetadata(response.description || '');
      
      return {
        '@id': response['@id'],
        id: response.id || meetingId, // Use the actual ID Plone assigned
        title: response.title,
        description: metadata.description || meetingData.description || '',
        startTime: metadata.startTime || meetingData.startTime,
        duration: metadata.duration || meetingData.duration || 60,
        meetingType: metadata.meetingType || meetingData.meetingType || 'meeting',
        classId: metadata.classId || meetingData.classId,
        status: metadata.status || 'scheduled',
        autoRecord: metadata.autoRecord ?? meetingData.autoRecord ?? false,
        joinUrl: metadata.joinUrl || joinUrl,
        meetingPlatform: 'internal',
        createdBy: metadata.createdBy || 'unknown',
        created: response.created || new Date().toISOString(),
        modified: response.modified || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating meeting:', error);
      throw error;
    }
  }

  async getMeetings(classId?: string): Promise<PloneMeeting[]> {
    try {
      // Get meetings from the meetings folder directly
      const meetingsPath = classId ? `classes/${classId}/meetings` : 'meetings';
      const meetingsContainer = await this.makeRequest(`/${meetingsPath}`);
      
      if (meetingsContainer.items) {
        return meetingsContainer.items
          .filter((item: any) => {
            // Only include items that have meeting metadata and belong to this class
            const metadata = this.parseMeetingMetadata(item.description || '');
            const hasMetadata = item.description?.includes('[METADATA]') && 
                              item.description?.includes('startTime');
            const belongsToClass = !classId || metadata.classId === classId;
            return hasMetadata && belongsToClass;
          })
          .map((item: any) => {
            const id = item.id || item['@id'].split('/').pop() || '';
            const metadata = this.parseMeetingMetadata(item.description || '');
            
            // Clean description by removing metadata
            const cleanDescription = (item.description || '').replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim();
            
            return {
              '@id': item['@id'],
              id: id,
              title: item.title,
              description: cleanDescription,
              startTime: metadata.startTime || '',
              duration: metadata.duration || 60,
              meetingType: metadata.meetingType || 'meeting',
              classId: metadata.classId || classId,
              status: metadata.status || 'scheduled',
              autoRecord: metadata.autoRecord || false,
              joinUrl: metadata.joinUrl || `/meeting/${id}${classId ? `?classId=${classId}` : ''}`,
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
    } catch (error: any) {
      console.log('Error fetching meetings:', error);
      return [];
    }
  }

  async getMeeting(meetingId: string, classId?: string): Promise<PloneMeeting> {
    try {
      const meetingPath = classId ? 
        `classes/${classId}/meetings/${meetingId}` : 
        `meetings/${meetingId}`;
      
      console.log(`Looking for meeting at path: ${meetingPath}`);
      
      const meetingData = await this.makeRequest(`/${meetingPath}`);
      const metadata = this.parseMeetingMetadata(meetingData.description || '');
      
      // Clean description by removing metadata
      const cleanDescription = (meetingData.description || '').replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim();
      
      return {
        '@id': meetingData['@id'],
        id: meetingId,
        title: meetingData.title,
        description: cleanDescription,
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

  async uploadMeetingRecording(meetingId: string, classId: string | undefined, recordingBlob: Blob, metadata: {
    duration: number;
    startTime: string;
    endTime: string;
    participantCount: number;
  }): Promise<any> {
    // Try S3 upload first if configured, fallback to Plone
    if (s3Service.isConfigured()) {
      return this.uploadMeetingRecordingToS3(meetingId, classId, recordingBlob, metadata);
    } else {
      return this.uploadMeetingRecordingToPlone(meetingId, classId, recordingBlob, metadata);
    }
  }

  private async uploadMeetingRecordingToS3(meetingId: string, classId: string | undefined, recordingBlob: Blob, metadata: {
    duration: number;
    startTime: string;
    endTime: string;
    participantCount: number;
  }): Promise<any> {
    if (!classId) {
      throw new Error('Class ID is required for S3 uploads');
    }

    try {
      console.log(`Uploading ${recordingBlob.size} byte recording to S3...`);
      
      // Upload to S3
      const s3Result = await s3Service.uploadRecording(classId, meetingId, recordingBlob, metadata);
      console.log('Recording uploaded to S3:', s3Result);

      // Store metadata in Plone
      const recordingMetadata = {
        '@type': 'Document',
        id: `recording-${Date.now()}`,
        title: `Meeting Recording - ${new Date().toLocaleString()}`,
        description: JSON.stringify({
          ...metadata,
          s3Key: s3Result.key,
          s3Url: s3Result.url,
          fileSize: s3Result.size,
          storageType: 's3',
          uploadedAt: new Date().toISOString(),
        }),
      };

      // Ensure recordings folder exists in Plone for metadata
      await this.ensureRecordingsFolder(meetingId, classId);
      
      // Store metadata document in Plone
      const recordingsPath = `classes/${classId}/meetings/${meetingId}/recordings`;
      const metadataDoc = await this.makeRequest(`/${recordingsPath}`, {
        method: 'POST',
        body: JSON.stringify(recordingMetadata),
      });

      // Note: Meeting update temporarily disabled due to API path issues
      // The recording is successfully uploaded to S3 and metadata stored in Plone
      console.log('Recording uploaded successfully. Meeting update skipped to avoid API errors.');

      console.log('Recording metadata stored in Plone:', metadataDoc);
      
      return {
        ...metadataDoc,
        s3Key: s3Result.key,
        s3Url: s3Result.url,
        fileSize: s3Result.size,
        storageType: 's3',
      };
    } catch (error) {
      console.error('Error uploading recording to S3:', error);
      throw error;
    }
  }

  private async uploadMeetingRecordingToPlone(meetingId: string, classId: string | undefined, recordingBlob: Blob, metadata: {
    duration: number;
    startTime: string;
    endTime: string;
    participantCount: number;
  }): Promise<any> {
    const recordingsPath = classId 
      ? `classes/${classId}/meetings/${meetingId}/recordings`
      : `meetings/${meetingId}/recordings`;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const recordingId = `recording-${timestamp}`;

    console.log(`Uploading recording to: /${recordingsPath}/${recordingId}`);

    if (recordingBlob.size === 0) {
      const errorMessage = 'Cannot upload an empty recording file (0 bytes).';
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      // First ensure the recordings folder exists
      await this.ensureRecordingsFolder(meetingId, classId || '');
      
      // Create the video file using FormData (same pattern as submission files)
      console.log('Uploading video file...');
      const fileData = new FormData();
      
      // Convert blob to file for proper upload
      const videoFile = new File([recordingBlob], `${recordingId}.webm`, {
        type: recordingBlob.type || 'video/webm'
      });
      
      fileData.append('file', videoFile);
      fileData.append('@type', 'File');
      fileData.append('title', `Meeting Recording - ${new Date().toLocaleString()}`);
      fileData.append('id', recordingId);
      fileData.append('description', JSON.stringify({
        ...metadata,
        fileSize: recordingBlob.size,
        mimeType: recordingBlob.type || 'video/webm',
        recordingDate: timestamp
      }));

      // Use direct Plone upload like uploadSubmissionFiles (which works)
      // Upload to the recordings folder directly, not through REST API content creation
      const directPloneUrl = `http://127.0.0.1:8080/Plone/${recordingsPath}`;
      console.log(`Uploading recording directly to Plone: ${directPloneUrl}`);
      console.log(`File size: ${recordingBlob.size} bytes`);
      console.log(`Auth token exists: ${!!this.token}`);
      
      const uploadResponse = await fetch(directPloneUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: fileData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed with response:', errorText);
        throw new Error(`${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
      }

      const result = await uploadResponse.json();
      console.log('Recording uploaded successfully:', result);
      
      return result;

    } catch (error) {
      console.error('Error during recording upload:', error);
      
      // Provide more specific error messages
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(`Unable to connect to Plone backend at http://127.0.0.1:8080. Please ensure the Plone server is running.`);
      } else if (error instanceof Error && error.message.includes('Unauthorized')) {
        throw new Error(`Authentication failed. Please log in again.`);
      } else if (error instanceof Error && error.message.includes('404')) {
        throw new Error(`Recording upload path not found. The class or meeting may not exist.`);
      }
      
      throw error;
    }
  }

  async getMeetingRecordings(meetingId: string, classId?: string): Promise<any[]> {
    try {
      const meetingPath = classId ? 
        `/classes/${classId}/meetings/${meetingId}` : 
        `/meetings/${meetingId}`;
      
      const recordingsFolder = await this.makeRequest(`${meetingPath}/recordings`);
      
      console.log(`Recordings folder contents for ${meetingPath}/recordings:`, recordingsFolder);
      
      if (recordingsFolder.items) {
        const recordings = recordingsFolder.items
          .filter((item: any) => {
            console.log(`Checking item:`, item);
            
            // Check if this is a recording file or S3 metadata document
            const hasRecordingTitle = item.title && 
                                     (item.title.includes('Recording') || 
                                      item.title.includes('recording') ||
                                      item.title.includes('Meeting Recording'));
            
            // Accept both File types (direct uploads) and Document types (S3 metadata)
            const isValidType = item['@type'] === 'File' || item['@type'] === 'Document';
            const hasId = item.id || item['@id']; // Use either id or @id
            
            // For S3 recordings, check if description contains S3 metadata
            let isS3Recording = false;
            if (item['@type'] === 'Document' && item.description) {
              try {
                const metadata = JSON.parse(item.description);
                isS3Recording = metadata.storageType === 's3' && metadata.s3Key;
              } catch (e) {
                // Ignore parse errors
              }
            }
            
            const isValidRecording = isValidType && hasRecordingTitle && hasId && 
                                   (item['@type'] === 'File' || isS3Recording);
            
            console.log(`Item "${item.title}" (type: ${item['@type']}) is valid recording:`, isValidRecording ? item['@id'] : 'false');
            if (isS3Recording) {
              console.log('  -> Detected as S3 recording metadata document');
            }
            return isValidRecording;
          })
          .map((item: any) => {
            // For File objects in Plone, the download URL should be constructed properly
            // For S3 metadata documents, we'll use the S3 URL from metadata
            const itemId = item['@id'];
            let downloadUrl = itemId;
            let metadata: any = {};
            
            // Parse metadata from description
            try {
              if (item.description) {
                if (item.description.startsWith('{') || item.description.includes('storageType')) {
                  // Direct JSON metadata (S3 recordings)
                  metadata = JSON.parse(item.description);
                } else {
                  // Encoded metadata (legacy format)
                  metadata = this.parseMeetingMetadata(item.description);
                }
              }
            } catch (e) {
              console.warn('Could not parse recording metadata:', e);
            }
            
            // For S3 recordings, we'll generate presigned URLs when needed
            if (metadata.storageType === 's3') {
              console.log('S3 recording found:', metadata.s3Key);
              downloadUrl = metadata.s3Url || itemId; // Fallback to item ID
            }
            
            console.log('Generated download URL for', item.title, ':', downloadUrl);
            
            return {
              id: item.id || item['@id']?.split('/').pop() || 'unknown',
              title: item.title,
              downloadUrl: downloadUrl,
              description: item.description, // Keep full description for metadata parsing
              created: item.created || item.modified,
              modified: item.modified || item.created,
              '@id': item['@id'],
              '@type': item['@type']
            };
          });
        
        console.log(`Found ${recordings.length} recordings:`, recordings);
        return recordings;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching meeting recordings:', error);
      return [];
    }
  }

  // Helper method to check if a meeting is properly structured for recordings
  async checkMeetingStructure(meetingId: string, classId?: string): Promise<{ isFolder: boolean; canRecord: boolean; error?: string }> {
    try {
      const meetingPath = classId ? 
        `classes/${classId}/meetings/${meetingId}` : 
        `meetings/${meetingId}`;
      
      const meeting = await this.makeRequest(`/${meetingPath}`);
      
      // Check if meeting is a Folder (can contain recordings) or Document (cannot)
      const isFolder = meeting['@type'] === 'Folder';
      
      return {
        isFolder,
        canRecord: isFolder,
        error: isFolder ? undefined : 'Meeting was created as Document and cannot contain recordings. Please recreate the meeting.'
      };
    } catch (error) {
      return {
        isFolder: false,
        canRecord: false,
        error: `Meeting not found: ${error}`
      };
    }
  }

  // Helper method to test if a recording can be downloaded
  async testRecordingDownload(recordingId: string, meetingId: string, classId?: string): Promise<{
    canDownload: boolean;
    workingUrl: string | null;
    errors: string[];
    details: any;
  }> {
    const errors: string[] = [];
    const details: any = {};
    
    try {
      const meetingPath = classId ? 
        `/classes/${classId}/meetings/${meetingId}` : 
        `/meetings/${meetingId}`;
      const recordingPath = `${meetingPath}/recordings/${recordingId}`;
      
      // Try different download URLs
      const urlsToTry = [
        `${recordingPath}/@@download/file`,
        `${recordingPath}/@@download`,
        recordingPath,
        `${recordingPath}/file`,
      ];
      
      let workingUrl: string | null = null;
      
      for (const url of urlsToTry) {
        try {
          const response = await fetch(`${API_BASE}${url}`, {
            method: 'HEAD',
            headers: {
              'Authorization': `Bearer ${this.token}`,
            },
          });
          
          const contentType = response.headers.get('content-type') || '';
          
          details[url] = {
            status: response.ok ? 'accessible' : `error ${response.status}`,
            contentType,
            contentLength: response.headers.get('content-length')
          };
          
          if (contentType.startsWith('video/') || 
              contentType.includes('webm') || 
              contentType.includes('mp4') ||
              contentType === 'application/octet-stream') {
            workingUrl = `${API_BASE}${url}`;
            break;
          }
        } catch (error) {
          details[url] = {
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          };
          errors.push(`${url}: ${error}`);
        }
      }
      
      return {
        canDownload: workingUrl !== null,
        workingUrl,
        errors,
        details
      };
    } catch (error) {
      errors.push(`Test failed: ${error}`);
      return {
        canDownload: false,
        workingUrl: null,
        errors,
        details
      };
    }
  }

  // Helper method to test recording upload capability for a specific meeting
  async testRecordingUpload(meetingId: string, classId: string): Promise<{ 
    canUpload: boolean; 
    errors: string[]; 
    details: any 
  }> {
    const errors: string[] = [];
    const details: any = {};
    
    try {
      // Check meeting structure
      const structure = await this.checkMeetingStructure(meetingId, classId);
      details.meetingStructure = structure;
      
      if (!structure.canRecord) {
        errors.push(structure.error || 'Meeting cannot support recordings');
      }
      
      // Check if recordings folder exists or can be created
      try {
        await this.ensureRecordingsFolder(meetingId, classId);
        details.recordingsFolderStatus = 'exists or created';
      } catch (error) {
        errors.push(`Cannot create recordings folder: ${error}`);
        details.recordingsFolderError = error;
      }
      
      // Test permissions by trying to create a test document
      try {
        const recordingsPath = `classes/${classId}/meetings/${meetingId}/recordings`;
        const testDoc = await this.makeRequest(`/${recordingsPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@type': 'Document',
            id: 'test-upload-permissions',
            title: 'Test Upload Permissions',
            description: 'This is a test document to verify upload permissions'
          })
        });
        
        // Clean up test document
        await this.makeRequest(`/${recordingsPath}/test-upload-permissions`, {
          method: 'DELETE'
        });
        
        details.permissionTest = 'passed';
      } catch (error) {
        errors.push(`Permission test failed: ${error}`);
        details.permissionError = error;
      }
      
      return {
        canUpload: errors.length === 0,
        errors,
        details
      };
    } catch (error) {
      errors.push(`Test failed: ${error}`);
      return {
        canUpload: false,
        errors,
        details
      };
    }
  }

  // Helper method to audit all meetings and find ones that need updating
  async auditMeetingsForRecording(): Promise<{ 
    totalMeetings: number; 
    documentMeetings: number; 
    folderMeetings: number; 
    issues: Array<{ meetingId: string; classId?: string; issue: string }> 
  }> {
    try {
      const results = {
        totalMeetings: 0,
        documentMeetings: 0,
        folderMeetings: 0,
        issues: [] as Array<{ meetingId: string; classId?: string; issue: string }>
      };

      // Get all classes
      const classes = await this.getClasses();
      
      for (const cls of classes) {
        try {
          const meetings = await this.getMeetings(cls.id);
          
          for (const meeting of meetings) {
            results.totalMeetings++;
            
            const structure = await this.checkMeetingStructure(meeting.id, cls.id);
            
            if (structure.isFolder) {
              results.folderMeetings++;
            } else {
              results.documentMeetings++;
              results.issues.push({
                meetingId: meeting.id,
                classId: cls.id,
                issue: 'Meeting is Document type, cannot contain recordings'
              });
            }
          }
        } catch (error) {
          console.warn(`Could not audit meetings for class ${cls.id}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Error auditing meetings:', error);
      throw error;
    }
  }

  async deleteMeeting(meetingId: string, classId?: string): Promise<void> {
    try {
      const meetingPath = classId ? 
        `classes/${classId}/meetings/${meetingId}` : 
        `meetings/${meetingId}`;
      
      await this.makeRequest(`/${meetingPath}`, {
        method: 'DELETE'
      });
      
      console.log(`Successfully deleted meeting ${meetingId}`);
    } catch (error) {
      console.error('Error deleting meeting:', error);
      throw error;
    }
  }

  async deleteMeetingsBefore(beforeDate: string, classId?: string): Promise<{ deleted: number; errors: string[] }> {
    try {
      const meetings = await this.getMeetings(classId);
      const cutoffDate = new Date(beforeDate);
      const results = { deleted: 0, errors: [] as string[] };
      
      for (const meeting of meetings) {
        try {
          const meetingDate = new Date(meeting.startTime);
          if (meetingDate < cutoffDate) {
            await this.deleteMeeting(meeting.id, classId);
            results.deleted++;
            console.log(`Deleted old meeting: ${meeting.title} (${meeting.startTime})`);
          }
        } catch (error) {
          const errorMsg = `Failed to delete meeting ${meeting.title}: ${error}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error bulk deleting meetings:', error);
      throw error;
    }
  }

  async deleteMultipleMeetings(meetingIds: string[], classId?: string): Promise<{ deleted: string[]; errors: string[] }> {
    const results = { deleted: [] as string[], errors: [] as string[] };
    
    for (const meetingId of meetingIds) {
      try {
        await this.deleteMeeting(meetingId, classId);
        results.deleted.push(meetingId);
        console.log(`Successfully deleted meeting: ${meetingId}`);
      } catch (error) {
        const errorMsg = `Failed to delete meeting ${meetingId}: ${error}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }
    
    return results;
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
      createdBy: meetingData.createdBy || 'unknown',
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

  async ensureMeetingsFolder(meetingFolder: string): Promise<void> {
    try {
      // Try to get the meetings folder
      await this.makeRequest(`/${meetingFolder}`);
      console.log('Meetings folder already exists');
    } catch (error: any) {
      // If it doesn't exist, try to create it
      console.log('Meetings folder not found, attempting to create...');
      
      try {
        const parentPath = meetingFolder.substring(0, meetingFolder.lastIndexOf('/'));
        console.log(`Creating meetings folder at: ${parentPath}`);
        
        // First, ensure the parent folder (class) exists
        try {
          await this.makeRequest(`/${parentPath}`);
        } catch (parentError: any) {
          console.warn('Parent folder does not exist:', parentPath);
          // If the parent class doesn't exist, we can't create meetings for it
          throw new Error(`Class folder does not exist: ${parentPath}`);
        }
        
        await this.makeRequest(`/${parentPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@type': 'Folder',
            id: 'meetings',
            title: 'Meetings',
            description: 'Virtual class meetings and recordings',
          }),
        });
        console.log('Meetings folder created successfully');
      } catch (createError: any) {
        console.warn('Could not create meetings folder:', createError);
        
        // Check if it's a permission error
        if (createError.message?.includes('401') || createError.message?.includes('Unauthorized')) {
          // Don't throw an error - just warn and continue
          console.warn('Insufficient permissions to create meetings folder. Meeting will be created without folder structure.');
          return;
        }
        
        // For other errors, still throw but with a clearer message
        throw new Error(`Cannot create meetings folder: ${createError.message || createError}`);
      }
    }
  }

  async ensureRecordingsFolder(meetingId: string, classId: string): Promise<void> {
    try {
      const recordingsPath = `classes/${classId}/meetings/${meetingId}/recordings`;
      
      // First ensure the meeting folder exists (now created as Folder, not Document)
      const meetingPath = `classes/${classId}/meetings/${meetingId}`;
      
      try {
        // Check if meeting exists
        await this.makeRequest(`/${meetingPath}`);
        console.log(`Meeting folder exists: ${meetingPath}`);
      } catch (error: any) {
        console.error(`Meeting folder does not exist: ${meetingPath}`, error);
        throw new Error(`Meeting not found: ${meetingId}. Please ensure the meeting exists before recording.`);
      }
      
      // Then ensure the recordings subfolder exists
      try {
        await this.makeRequest(`/${recordingsPath}`);
        console.log(`Recordings folder already exists: ${recordingsPath}`);
      } catch (error: any) {
        if (error.message?.includes('404') || error.status === 404) {
          // Create recordings folder inside the meeting folder
          console.log(`Creating recordings folder in: ${meetingPath}`);
          await this.makeRequest(`/${meetingPath}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              '@type': 'Folder',
              'title': 'Recordings',
              'id': 'recordings'
            })
          });
          console.log(`Created recordings folder: ${recordingsPath}`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to ensure recordings folder:', error);
      throw error;
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
      console.log('Starting complete student deletion:', studentData);

      // 1. Get all classes and find where this student is enrolled
      const allClasses = await this.getClasses();
      const classesToDeleteFrom = [];

      for (const cls of allClasses) {
        try {
          const classStudents = await this.getStudents(cls.id);
          // Look for student by multiple identifiers
          const foundStudent = classStudents.find((s: any) => {
            // Priority 1: Match by student_id (most reliable unique identifier)
            if (s.student_id && studentData.studentId && s.student_id === studentData.studentId) {
              return true;
            }
            // Priority 2: Match by document ID
            if (s.id === studentData.studentId) {
              return true;
            }
            // Priority 3: Match by email (if username provided)
            if (s.email && studentData.username && s.email.includes(studentData.username)) {
              return true;
            }
            // Priority 4: Match by name (least reliable)
            if (s.name === studentData.username) {
              return true;
            }
            return false;
          });
          
          if (foundStudent) {
            // Extract student ID from @id URL if id field is missing
            let studentId = foundStudent.id;
            if (!studentId && foundStudent['@id']) {
              // Extract ID from URL like: http://localhost:3000/api/plone/classes/precalc/students/jane-smith
              const urlParts = foundStudent['@id'].split('/');
              studentId = urlParts[urlParts.length - 1]; // Get the last part of the URL
            }
            
            classesToDeleteFrom.push({
              classId: cls.id,
              studentRecord: { ...foundStudent, id: studentId }
            });
            console.log(`Found student in class: ${cls.id} with ID: ${studentId}`);
          }
        } catch (classError) {
          console.warn(`Cannot check class ${cls.id}:`, classError);
        }
      }

      console.log(`Student found in ${classesToDeleteFrom.length} classes`);

      // 2. Delete student record from each class they're in
      for (const { classId, studentRecord } of classesToDeleteFrom) {
        try {
          await this.deleteStudent(classId, studentRecord.id);
          results.recordsDeleted.push(`Class: ${classId}`);
          console.log(`Deleted student record from class: ${classId}`);
        } catch (error) {
          results.errors.push(`Failed to delete from class ${classId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3. Delete user account if requested
      if (studentData.deleteUserAccount && studentData.username) {
        try {
          await this.deleteUser(studentData.username);
          results.userAccountDeleted = true;
          console.log(`Deleted user account: ${studentData.username}`);
        } catch (userError) {
          console.warn(`Failed to delete user account:`, userError);
          results.errors.push(`Failed to delete user account: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
        }
      }

      // 4. Remove local roles from all classes
      if (studentData.username) {
        for (const { classId } of classesToDeleteFrom) {
          try {
            await this.setLocalRoles(`/classes/${classId}`, studentData.username, []);
            await this.setLocalRoles(`/classes/${classId}/submissions`, studentData.username, []);
          } catch (roleError) {
            console.log(`Could not remove roles from ${classId}:`, roleError);
          }
        }
      }

      console.log('Complete deletion results:', results);
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

  // Helper method to fix permissions for a specific student
  async fixStudentPermissionsForAllClasses(studentUsername: string): Promise<{ fixed: string[]; errors: string[] }> {
    try {
      const results = { fixed: [] as string[], errors: [] as string[] };
      
      console.log(`Fixing permissions for student ${studentUsername} across all classes`);
      
      // Get all classes
      const classes = await this.getClasses();
      
      for (const cls of classes) {
        try {
          // Check if student has a record in this class
          const students = await this.getStudents(cls.id);
          const studentRecord = students.find((s: any) => {
            const recordUsername = s.email?.split('@')[0] || s.name?.toLowerCase().replace(/[^a-z0-9]/g, '');
            return recordUsername === studentUsername || s.name?.toLowerCase().includes(studentUsername);
          });
          
          if (studentRecord) {
            console.log(`Found student record in class ${cls.id}, granting permissions...`);
            await this.grantStudentSubmissionPermissions(cls.id, studentUsername);
            results.fixed.push(cls.id);
          }
        } catch (error) {
          console.warn(`Error processing class ${cls.id} for student ${studentUsername}:`, error);
          results.errors.push(`Class ${cls.id}: ${error}`);
        }
      }
      
      console.log(`Fixed permissions for ${studentUsername} in ${results.fixed.length} classes:`, results.fixed);
      return results;
    } catch (error) {
      console.error('Error fixing student permissions for all classes:', error);
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
      console.log(`Finding classes for student: ${studentUsername}`);
      
      // Simple approach: Try to get the actual list of classes and test access
      try {
        console.log(`Attempting to list /classes folder for student ${studentUsername}...`);
        const classesResponse = await this.makeRequest('/classes');
        console.log('Classes response:', classesResponse);
        console.log('Classes response items:', classesResponse.items);
        console.log('Classes response keys:', Object.keys(classesResponse));
        if (classesResponse && classesResponse.items) {
          // Debug each item to see what properties they have
          classesResponse.items.forEach((item: any, index: number) => {
            console.log(`Item ${index}:`, {
              id: item.id,
              '@id': item['@id'],
              title: item.title,
              '@type': item['@type'],
              allKeys: Object.keys(item)
            });
          });
          
          // Extract class IDs from items - try multiple methods
          const allClassIds = classesResponse.items.map((item: any) => {
            // Method 1: Direct id property
            if (item.id) return item.id;
            
            // Method 2: Extract from @id URL (e.g., "http://...../classes/algebra" -> "algebra")
            if (item['@id']) {
              const urlParts = item['@id'].split('/');
              return urlParts[urlParts.length - 1];
            }
            
            // Method 3: Use title as fallback (converted to ID format)
            if (item.title) {
              return item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }
            
            return null;
          }).filter(Boolean);
          
          console.log(`Found ${allClassIds.length} classes to test:`, allClassIds);
          
          // Test enrollment in each class (not just access)
          for (const classId of allClassIds) {
            try {
              console.log(`Checking enrollment in class: ${classId}`);
              
              // First check if we can access the class at all
              const classDetail = await this.makeRequest(`/classes/${classId}`);
              if (!classDetail) continue;
              
              // Now check if this student actually has a record in this class
              try {
                const studentsInClass = await this.makeRequest(`/classes/${classId}/students`);
                let isEnrolled = false;
                
                if (studentsInClass && studentsInClass.items) {
                  // Look for this student in the class roster
                  isEnrolled = studentsInClass.items.some((studentRecord: any) => {
                    const recordMetadata = this.parseStudentMetadata(studentRecord.description || '');
                    const recordUsername = recordMetadata.email?.split('@')[0] || 
                                         studentRecord.title?.toLowerCase().replace(/[^a-z0-9]/g, '');
                    
                    return recordUsername === studentUsername || 
                           recordMetadata.email?.includes(studentUsername) ||
                           studentRecord.title?.toLowerCase().includes(studentUsername.toLowerCase());
                  });
                }
                
                if (isEnrolled) {
                  console.log(`✅ Student ${studentUsername} is enrolled in class: ${classId}`);
                  const metadata = this.parseClassMetadata(classDetail.description || '');
                  const cleanDescription = (classDetail.description || '').replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim();
                  
                  enrolledClasses.push({
                    '@id': classDetail['@id'] || `/classes/${classId}`,
                    id: classId,
                    title: classDetail.title,
                    description: cleanDescription,
                    teacher: metadata.teacher || 'Unknown',
                    subject: metadata.subject,
                    grade_level: metadata.gradeLevel,
                    schedule: metadata.schedule,
                    created: classDetail.created,
                    modified: classDetail.modified
                  });
                } else {
                  console.log(`⚠️ Student ${studentUsername} can access class ${classId} but is not enrolled`);
                }
              } catch (studentsError: any) {
                console.log(`❌ Cannot check enrollment in class ${classId}:`, studentsError.message?.substring(0, 100));
              }
            } catch (accessError: any) {
              console.log(`❌ Cannot access class ${classId}:`, accessError.message?.substring(0, 100));
            }
          }
        }
             } catch (listError) {
         console.log('Cannot list classes folder, error:', listError);
         console.log('Trying search approach as fallback...');
         
         // Fallback: Search for student records
         try {
           const searchResponse = await this.makeRequest(`/@search?path=/classes&portal_type=Document&SearchableText=${studentUsername}`);
           
           if (searchResponse && searchResponse.items) {
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
             
             for (const classId of classIds) {
               try {
                 const classDetail = await this.makeRequest(`/classes/${classId}`);
                 if (classDetail) {
                   const metadata = this.parseClassMetadata(classDetail.description || '');
                   const cleanDescription = (classDetail.description || '').replace(/\[METADATA\].*?\[\/METADATA\]/, '').trim();
                   
                   enrolledClasses.push({
                     '@id': classDetail['@id'] || `/classes/${classDetail.id}`,
                     id: classDetail.id,
                     title: classDetail.title,
                     description: cleanDescription,
                     teacher: metadata.teacher || 'Unknown',
                     subject: metadata.subject,
                     grade_level: metadata.gradeLevel,
                     schedule: metadata.schedule,
                     created: classDetail.created,
                     modified: classDetail.modified
                   });
                 }
               } catch (classDetailError) {
                 console.warn(`Cannot get details for class ${classId}:`, classDetailError);
               }
             }
           }
         } catch (searchError) {
           console.log('Search approach also failed:', searchError);
         }
       }
       
       console.log(`Found ${enrolledClasses.length} enrolled classes for ${studentUsername}`);
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
      
      // Add roles - if explicitly provided, use those; otherwise default to Member
      if (userData.roles && userData.roles.length > 0) {
        payload.roles = userData.roles;
      } else {
        // Default role for basic users
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
              
              console.log('User created successfully with assigned roles');
              
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
      
      // The response might be an array directly, or have a different structure
      if (Array.isArray(response)) {
        return response;
      } else if (response.users && Array.isArray(response.users)) {
        return response.users;
      } else if (response.items && Array.isArray(response.items)) {
        return response.items;
      } else {
        console.warn('Unexpected @users response structure:', response);
        return [];
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async getTeachers(): Promise<PloneTeacher[]> {
    try {
      const users = await this.getAllUsers();
      
      // Filter for users who have teaching roles
      const teachingRoles = ['Editor', 'Site Administrator', 'Manager'];
      const teacherUsers = users.filter((user: any) => {
        if (!user.roles) return false;
        
        // Must have at least one teaching role
        const hasTeachingRole = user.roles.some((role: string) => teachingRoles.includes(role));
        
        // If they only have Contributor+Member, they're a student, not a teacher
        const isStudentOnly = user.roles.includes('Contributor') && 
                             user.roles.includes('Member') && 
                             !user.roles.some((role: string) => ['Editor', 'Site Administrator', 'Manager'].includes(role));
        
        return hasTeachingRole && !isStudentOnly;
      });
      
      // Transform to PloneTeacher format
      return teacherUsers.map((user: any) => ({
        '@id': user['@id'] || `/users/${user.username}`,
        id: user.username,
        username: user.username,
        fullname: user.fullname || user.username,
        email: user.email || '',
        roles: user.roles || [],
        created: user.created,
        modified: user.modified,
        department: user.properties?.department,
        office: user.properties?.office,
        phone: user.properties?.phone,
        bio: user.properties?.bio,
        accountType: (user.roles?.includes('Manager') || user.roles?.includes('Site Administrator')) ? 'admin' : 'teacher'
      }));
    } catch (error) {
      console.error('Error fetching teachers:', error);
      return [];
    }
  }

  async getUsersByType(userType: 'students' | 'teachers' | 'all' = 'all'): Promise<(PloneStudent | PloneTeacher)[]> {
    try {
      const users = await this.getAllUsers();
      const teachingRoles = ['Editor', 'Site Administrator', 'Manager'];
      
      const categorizedUsers: (PloneStudent | PloneTeacher)[] = [];
      
      for (const user of users) {
        if (!user.roles) continue;
        
        const hasTeachingRole = user.roles.some((role: string) => teachingRoles.includes(role));
        const isStudentOnly = user.roles.includes('Contributor') && 
                             user.roles.includes('Member') && 
                             !hasTeachingRole;
        
        if (hasTeachingRole && (userType === 'teachers' || userType === 'all')) {
          // This is a teacher/admin
          categorizedUsers.push({
            '@id': user['@id'] || `/users/${user.username}`,
            id: user.username,
            username: user.username,
            fullname: user.fullname || user.username,
            email: user.email || '',
            roles: user.roles || [],
            created: user.created,
            modified: user.modified,
            department: user.properties?.department,
            office: user.properties?.office,
            phone: user.properties?.phone,
            bio: user.properties?.bio,
            accountType: (user.roles?.includes('Manager') || user.roles?.includes('Site Administrator')) ? 'admin' : 'teacher'
          } as PloneTeacher);
        } else if (isStudentOnly && (userType === 'students' || userType === 'all')) {
          // This is a student - we need to get their full student data
          // For now, create a basic student record from user data
          categorizedUsers.push({
            '@id': user['@id'] || `/users/${user.username}`,
            id: user.username,
            name: user.fullname || user.username,
            email: user.email || '',
            created: user.created,
            modified: user.modified,
            student_id: user.properties?.student_id,
            grade_level: user.properties?.grade_level,
            phone: user.properties?.phone,
            address: user.properties?.address
          } as PloneStudent);
        }
      }
      
      return categorizedUsers;
    } catch (error) {
      console.error('Error fetching users by type:', error);
      return [];
    }
  }

  async grantTeacherClassPermissions(username: string, classId: string): Promise<void> {
    try {
      console.log(`Granting teacher permissions for ${username} on class ${classId}`);
      
      // Give teacher Editor role on their specific class - allows creating/editing content
      await this.setLocalRoles(`/classes/${classId}`, username, ['Editor']);
      
      // Also give Contributor role so they can create subfolders (meetings, etc.)
      await this.setLocalRoles(`/classes/${classId}`, username, ['Editor', 'Contributor']);
      
      console.log(`Successfully granted class permissions to ${username} for class ${classId}`);
    } catch (error) {
      console.warn('Error granting teacher class permissions (non-blocking):', error);
      // Don't throw error - make this non-blocking so class creation doesn't fail
      // The admin can manually assign permissions if needed
    }
  }

  async setupTeacherRole(username: string): Promise<void> {
    console.log(`Setting up teacher role for: ${username}`);
    
    // Check if the user management endpoint is available (cached)
    const isUserManagementAvailable = await this.checkUserManagementAvailability();
    
    if (!isUserManagementAvailable) {
      console.warn('User management endpoint not available - skipping automatic role setup');
      return;
    }
    
    // Only proceed if the endpoint is available
    try {
      console.log('Proceeding with user role update...');
      await this.updateUser(username, {
        roles: ['Member', 'Contributor'] // Contributor allows creating content
      });
      console.log(`Successfully set up teacher role for ${username}`);
    } catch (updateError) {
      console.warn('Error updating user roles (non-blocking):', updateError);
      // Don't throw error - make this non-blocking so class creation doesn't fail
    }
  }

  async setupTeacherForClass(username: string, classId: string): Promise<void> {
    try {
      console.log(`Setting up teacher ${username} for class ${classId}`);
      
      // First ensure they have teacher role globally (non-blocking)
      try {
        await this.setupTeacherRole(username);
      } catch (roleError) {
        console.warn(`Could not set up global teacher role for ${username}:`, roleError);
        // Continue with local permissions even if global role setup fails
      }
      
      // Then give them permissions on the specific class (non-blocking)
      try {
        await this.grantTeacherClassPermissions(username, classId);
      } catch (permError) {
        console.warn(`Could not grant class permissions for ${username}:`, permError);
        // Continue even if local permissions fail
      }
      
      // Ensure meetings folder exists (non-blocking)
      try {
        await this.ensureClassHasMeetingsFolder(classId);
      } catch (folderError) {
        console.warn(`Could not create meetings folder for class ${classId}:`, folderError);
        // Continue even if folder creation fails
      }
      
      console.log(`Teacher setup completed for ${username} in class ${classId} (some steps may have been skipped due to configuration)`);
    } catch (error) {
      console.warn('Error setting up teacher for class (non-blocking):', error);
      // Don't throw error - make this non-blocking so class creation doesn't fail
      // The admin can manually assign permissions if needed
    }
  }

  // Helper method to check if current user has proper teacher permissions
  async checkTeacherPermissions(): Promise<{ hasManagerRole: boolean; message: string }> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return { hasManagerRole: false, message: 'No user logged in' };
      }

      const hasManager = currentUser.roles?.includes('Manager') || false;
      
      if (hasManager) {
        return { 
          hasManagerRole: true, 
          message: `✅ ${currentUser.username} has Manager role and can create classes and meetings` 
        };
      } else {
        return { 
          hasManagerRole: false, 
          message: `❌ ${currentUser.username} needs Manager role to create meetings. Current roles: ${currentUser.roles?.join(', ') || 'none'}. Please ask an admin to recreate your account with Teacher role.` 
        };
      }
    } catch (error: any) {
      return { 
        hasManagerRole: false, 
        message: `Error checking permissions: ${error.message || error}` 
      };
    }
  }

  async ensureClassHasMeetingsFolder(classId: string): Promise<void> {
    try {
      console.log(`Ensuring class ${classId} has meetings folder`);
      
      const meetingsPath = `/classes/${classId}/meetings`;
      
      // Try to access meetings folder
      try {
        await this.makeRequest(meetingsPath);
        console.log(`Meetings folder already exists for class ${classId}`);
      } catch (error: any) {
        // Create meetings folder if it doesn't exist
        console.log(`Creating meetings folder for class ${classId}`);
        
        try {
          await this.makeRequest(`/classes/${classId}`, {
            method: 'POST',
            body: JSON.stringify({
              '@type': 'Folder',
              id: 'meetings',
              title: 'Meetings',
              description: 'Virtual class meetings and recordings',
            }),
          });
          console.log(`Successfully created meetings folder for class ${classId}`);
        } catch (createError: any) {
          if (createError.message?.includes('401') || createError.message?.includes('Unauthorized')) {
            console.warn(`Insufficient permissions to create meetings folder for class ${classId}. Skipping.`);
            return; // Don't throw - just warn and continue
          }
          throw createError; // Re-throw other errors
        }
      }
    } catch (error: any) {
      console.error(`Error ensuring meetings folder for class ${classId}:`, error);
      // Only throw if it's not a permission error
      if (!error.message?.includes('401') && !error.message?.includes('Unauthorized')) {
        throw error;
      }
    }
  }

  async ensureWhiteboardsFolder(classId: string): Promise<void> {
    try {
      console.log(`Ensuring class ${classId} has whiteboards folder`);
      
      const whiteboardsPath = `/classes/${classId}/whiteboards`;
      
      // Try to access whiteboards folder
      try {
        await this.makeRequest(whiteboardsPath);
        console.log(`Whiteboards folder already exists for class ${classId}`);
      } catch (error: any) {
        // Create whiteboards folder if it doesn't exist
        console.log(`Creating whiteboards folder for class ${classId}`);
        
        try {
          await this.makeRequest(`/classes/${classId}`, {
            method: 'POST',
            body: JSON.stringify({
              '@type': 'Folder',
              id: 'whiteboards',
              title: 'Whiteboards',
              description: 'Interactive whiteboard drawings for this class',
            }),
          });
          console.log(`Successfully created whiteboards folder for class ${classId}`);
        } catch (createError: any) {
          if (createError.message?.includes('401') || createError.message?.includes('Unauthorized')) {
            console.warn(`Insufficient permissions to create whiteboards folder for class ${classId}. Skipping.`);
            return; // Don't throw - just warn and continue
          }
          throw createError; // Re-throw other errors
        }
      }
    } catch (error: any) {
      console.error(`Error ensuring whiteboards folder for class ${classId}:`, error);
      // Only throw if it's not a permission error
      if (!error.message?.includes('401') && !error.message?.includes('Unauthorized')) {
        throw error;
      }
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
      // Try PATCH first, then fall back to PUT if 405 error
      return await this.makeRequest(`/@users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch (error: any) {
      // If PATCH fails with 405, try PUT
      if (error.message?.includes('405')) {
        console.log('PATCH not supported, trying PUT for user update');
        try {
          return await this.makeRequest(`/@users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
          });
        } catch (putError) {
          console.error('Both PATCH and PUT failed for user update:', putError);
          throw putError;
        }
      }
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

  async deleteTeacher(teacherData: PloneTeacher & { deleteUserAccount?: boolean }): Promise<{ userAccountDeleted: boolean, errors: string[] }> {
    const results = {
      userAccountDeleted: false,
      errors: [] as string[]
    };

    try {
      console.log('Starting teacher deletion:', teacherData);

      // 1. Delete user account if requested
      if (teacherData.deleteUserAccount && teacherData.username) {
        try {
          await this.deleteUser(teacherData.username);
          results.userAccountDeleted = true;
          console.log(`Deleted user account: ${teacherData.username}`);
        } catch (userError) {
          console.warn(`Failed to delete user account:`, userError);
          results.errors.push(`Failed to delete user account: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
        }
      }

      // Note: In a real implementation, you might need to:
      // - Remove teacher from all classes they're assigned to
      // - Handle teacher-specific content and permissions
      // - Update any assignments or grades they've created
      // For now, the main deletion is the user account removal

      return results;
    } catch (error) {
      console.error('Error in teacher deletion process:', error);
      results.errors.push(`Teacher deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return results;
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

        // Upload files if any were provided
        if (submission.files && submission.files.length > 0) {
          console.log(`Uploading ${submission.files.length} files for submission ${submissionId}`);
          try {
            const uploadedFiles = await this.uploadSubmissionFiles(classId, assignmentId, submissionId, submission.files);
            console.log('Files uploaded successfully:', uploadedFiles);
            
            // Update the submission document with file metadata
            const fileMetadata = uploadedFiles.map(file => ({
              id: file.id,
              title: file.title,
              s3Key: file.s3Key,
              s3Url: file.s3Url,
              size: file.size,
              contentType: file.contentType,
              isS3: file.isS3,
              storageType: file.storageType
            }));
            
            // Update submission description with file metadata
            const updatedMetadata = this.parseSubmissionMetadata(submissionData.description);
            updatedMetadata.attachments = fileMetadata;
            
            await this.makeRequest(`${submissionsPath}/${submissionId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                description: this.formatSubmissionDescription({
                  ...updatedMetadata,
                  attachments: fileMetadata
                })
              })
            });
            
          } catch (fileError) {
            console.error('Error uploading files:', fileError);
            // Don't fail the whole submission if file upload fails
            console.warn('Submission created but file upload failed');
          }
        }

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
            
            // Upload files if any were provided
            if (submission.files && submission.files.length > 0) {
              console.log(`Uploading ${submission.files.length} files for submission ${submissionId} (after permission fix)`);
              try {
                const uploadedFiles = await this.uploadSubmissionFiles(classId, assignmentId, submissionId, submission.files);
                console.log('Files uploaded successfully after permission fix:', uploadedFiles);
                
                // Update the submission document with file metadata
                const fileMetadata = uploadedFiles.map(file => ({
                  id: file.id,
                  title: file.title,
                  s3Key: file.s3Key,
                  s3Url: file.s3Url,
                  size: file.size,
                  contentType: file.contentType,
                  isS3: file.isS3,
                  storageType: file.storageType
                }));
                
                // Update submission description with file metadata
                const updatedMetadata = this.parseSubmissionMetadata(submissionData.description);
                updatedMetadata.attachments = fileMetadata;
                
                await this.makeRequest(`${submissionsPath}/${submissionId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    description: this.formatSubmissionDescription({
                      ...updatedMetadata,
                      attachments: fileMetadata
                    })
                  })
                });
                
              } catch (fileError) {
                console.error('Error uploading files after permission fix:', fileError);
                // Don't fail the whole submission if file upload fails
                console.warn('Submission created but file upload failed');
              }
            }
            
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
      // Use S3 for file storage if configured, fallback to Plone
      if (s3Service.isConfigured()) {
        console.log(`Uploading ${files.length} submission files to S3...`);
        const s3Results = await s3Service.uploadSubmissionFiles(classId, assignmentId, submissionId, files);
        
        // Convert S3 results to the format expected by the rest of the system
        return s3Results.map(file => ({
          id: file.key.split('/').pop(),
          title: file.filename,
          '@id': `/api/s3-file/${encodeURIComponent(file.key)}`,
          url: file.url,
          s3Key: file.key,
          s3Url: file.url,
          size: file.size,
          contentType: file.contentType,
          isS3: true,
          storageType: 's3'
        }));
      } else {
        // Fallback to Plone storage
        console.log('S3 not configured, falling back to Plone storage...');
        return this.uploadSubmissionFilesToPlone(classId, assignmentId, submissionId, files);
      }
    } catch (error) {
      console.error('Error uploading submission files:', error);
      throw error;
    }
  }

  private async uploadSubmissionFilesToPlone(classId: string, assignmentId: string, submissionId: string, files: File[]): Promise<any[]> {
    try {
      // Files should be stored with the submission document in the submissions folder
      const submissionPath = `/classes/${classId}/submissions/${submissionId}`;
      
      // Create attachments folder within the submission
      await this.makeRequest(submissionPath, {
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

          // For file uploads, bypass the Next.js proxy and go directly to Plone
          const directPloneUrl = `http://127.0.0.1:8080/Plone${submissionPath}/attachments`;
          const uploadedFile = await fetch(directPloneUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
            },
            body: fileData,
          });

          if (uploadedFile.ok) {
            const fileResult = await uploadedFile.json();
            uploadedFiles.push({
              ...fileResult,
              isS3: false,
              storageType: 'plone'
            });
          }
        } catch (fileError) {
          console.error(`Error uploading file ${file.name}:`, fileError);
        }
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Error uploading submission files to Plone:', error);
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
      
      console.log(`Checking for submission: assignment=${assignmentId}, student=${studentId}`);
      
      try {
        // Check submissions folder for submissions matching this assignment and student
        const submissionsPath = `/classes/${classId}/submissions`;
        const submissionsFolder = await this.makeRequest(submissionsPath);
        
        if (submissionsFolder.items) {
          // Look for submission documents that match this assignment and student
          // Submission ID format: assignmentId-studentId-timestamp
          const studentSubmission = submissionsFolder.items.find((item: any) => {
            const itemId = item.id || '';
            const itemTitle = item.title || '';
            
            // Check if this submission is for the right assignment and student
            const matchesAssignment = itemId.startsWith(`${assignmentId}-${studentId}-`) || 
                                    itemTitle.includes(`${assignmentId} - ${studentId}`);
            
            return matchesAssignment;
          });
          
          if (studentSubmission) {
            console.log(`Found existing submission: ${studentSubmission.id}`);
            
            // Parse submission metadata from description
            const submissionMetadata = this.parseSubmissionMetadata(studentSubmission.description || '');
            
            return {
              id: studentSubmission.id,
              title: studentSubmission.title,
              created: studentSubmission.created,
              modified: studentSubmission.modified,
              submittedAt: submissionMetadata.submittedAt || studentSubmission.created,
              content: submissionMetadata.content || '',
              feedback: submissionMetadata.feedback || '',
              grade: submissionMetadata.grade,
              gradedAt: submissionMetadata.gradedAt,
              studentId: submissionMetadata.studentId || studentId,
              assignmentId: submissionMetadata.assignmentId || assignmentId,
              ...submissionMetadata
            };
          }
        }
        
        console.log(`No submission found for assignment=${assignmentId}, student=${studentId}`);
        return null;
        
      } catch (submissionsError) {
        // If submissions folder doesn't exist or can't be accessed, no submissions exist
        console.log(`Submissions folder not accessible for class ${classId}:`, submissionsError);
        return null;
      }
      
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
      assignmentId: submissionData.assignmentId || '',
      submittedAt: submissionData.submittedAt || new Date().toISOString(),
      content: submissionData.content || '',
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
          assignmentId: metadata.assignmentId,
          submittedAt: metadata.submittedAt,
          content: metadata.content,
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
      const submissionsPath = `/classes/${classId}/submissions`;
      const submissionsFolder = await this.makeRequest(submissionsPath);
      
      if (submissionsFolder.items) {
        // Find all submissions by this student for this assignment (for versioning)
        const studentSubmissions = submissionsFolder.items.filter((item: any) => {
          const itemId = item.id || '';
          // Submission ID format: assignmentId-studentId-timestamp
          return itemId.startsWith(`${assignmentId}-${studentId}-`);
        });
        
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
      console.log(`[getAllSubmissionsForAssignment] Looking for submissions in class "${classId}" for assignment "${assignmentId}"`);
      
      const submissionsPath = `/classes/${classId}/submissions`;
      console.log(`[getAllSubmissionsForAssignment] API_BASE: ${API_BASE}`);
      console.log(`[getAllSubmissionsForAssignment] Submissions path: ${submissionsPath}`);
      console.log(`[getAllSubmissionsForAssignment] Full API path: ${API_BASE}${submissionsPath}`);
      
      let submissionsFolder;
      try {
        submissionsFolder = await this.makeRequest(submissionsPath);
        console.log(`[getAllSubmissionsForAssignment] Found submissions folder:`, submissionsFolder);
      } catch (error) {
        console.log(`[getAllSubmissionsForAssignment] Submissions folder doesn't exist yet for class "${classId}"`);
        // If submissions folder doesn't exist, no submissions have been made yet
        return [];
      }
      
      if (submissionsFolder.items) {
        console.log(`[getAllSubmissionsForAssignment] All submissions found:`, submissionsFolder.items.map((item: any) => ({
          id: item.id,
          title: item.title,
          created: item.created
        })));
        const submissions = [];
        
        // Filter submissions for this specific assignment
        const assignmentSubmissions = submissionsFolder.items.filter((item: any) => {
          const itemId = item.id || '';
          const itemTitle = item.title || '';
          
          console.log(`Checking submission: id="${itemId}", title="${itemTitle}" against assignment "${assignmentId}"`);
          
          // Multiple formats to check:
          // 1. New format: assignmentId-studentId-timestamp
          // 2. Old format: assignmentId - studentname (with spaces and dashes)
          // 3. Title format: "assignmentId - studentname"
          const matchesNewFormat = itemId.startsWith(`${assignmentId}-`);
          const matchesOldFormat = itemId.includes(assignmentId) || itemTitle.includes(assignmentId);
          
          const matches = matchesNewFormat || matchesOldFormat;
          console.log(`Submission "${itemId}" matches assignment "${assignmentId}": ${matches}`);
          
          return matches;
        });
        
        console.log(`[getAllSubmissionsForAssignment] Filtered submissions for assignment "${assignmentId}":`, assignmentSubmissions.map((item: any) => ({
          id: item.id,
          title: item.title,
          matches: true
        })));
        
        for (const submissionFolder of assignmentSubmissions) {
          // Get detailed submission data
          let submissionUrl = submissionFolder['@id'];
          
          // Handle full URLs vs relative paths
          if (submissionUrl.startsWith('http')) {
            // Convert full URL to relative path for our proxy
            const urlParts = submissionUrl.split('/api/plone');
            submissionUrl = urlParts.length > 1 ? urlParts[1] : submissionUrl;
          }
          
          console.log(`[getAllSubmissionsForAssignment] Fetching submission details from: ${submissionUrl}`);
          const submissionDetails = await this.makeRequest(submissionUrl);
          
          console.log(`Loading submission details for: ${submissionFolder.id}`, submissionDetails);
          
          let submissionContent = submissionDetails; // Use the submission document itself
          let attachments = [];
          let feedback = [];

          // Check if this is a folder with sub-items or a direct document
          if (submissionDetails.items && submissionDetails.items.length > 0) {
            // This is a folder containing submission items
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
          } else {
            // This is a direct document submission
            submissionContent = submissionDetails;
            
            // Check if it has sub-items for attachments/feedback
            try {
              let attachmentsPath = `${submissionFolder['@id']}/attachments`;
              if (attachmentsPath.startsWith('http')) {
                const urlParts = attachmentsPath.split('/api/plone');
                attachmentsPath = urlParts.length > 1 ? urlParts[1] : attachmentsPath;
              }
              const attachmentsFolder = await this.makeRequest(attachmentsPath);
              attachments = attachmentsFolder.items || [];
            } catch (e) {
              // No attachments folder
            }
            
            try {
              let feedbackPath = `${submissionFolder['@id']}/feedback`;
              if (feedbackPath.startsWith('http')) {
                const urlParts = feedbackPath.split('/api/plone');
                feedbackPath = urlParts.length > 1 ? urlParts[1] : feedbackPath;
              }
              const feedbackFolder = await this.makeRequest(feedbackPath);
              feedback = feedbackFolder.items || [];
            } catch (e) {
              // No feedback folder
            }
          }

          // Get submission ID from either id field, title, or URL
          const submissionId = submissionFolder.id || submissionFolder.title || submissionUrl.split('/').pop() || 'unknown';
          const extractedStudentId = this.extractStudentIdFromSubmission(submissionId);
          const submissionMetadata = this.parseSubmissionMetadata(submissionContent?.description || '');
          
          console.log(`Processed submission for student ${extractedStudentId}:`, {
            content: submissionContent,
            attachments,
            feedback,
            metadata: submissionMetadata
          });

          submissions.push({
            ...submissionFolder,
            content: submissionContent,
            attachments,
            feedback,
            studentId: extractedStudentId,
            ...submissionMetadata
          });
        }
        
        return submissions;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching all submissions:', error);
      // Return empty array instead of throwing error - this allows the UI to show "No submissions yet"
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
    // Handle multiple submission ID formats:
    // 1. New format: assignmentId-studentId-timestamp
    // 2. Old format: assignmentId - studentname (e.g., "chapter-1 - janesmith")
    
    console.log(`Extracting student ID from submission: "${submissionId}"`);
    
    if (!submissionId || submissionId === 'unknown') {
      console.log('No valid submission ID provided, returning "unknown"');
      return 'unknown';
    }
    
    if (submissionId.includes(' - ')) {
      // Old format with spaces: "chapter-1 - janesmith"
      const parts = submissionId.split(' - ');
      if (parts.length >= 2) {
        const studentId = parts[1].trim().toLowerCase();
        console.log(`Extracted student ID (old format): "${studentId}"`);
        return studentId;
      }
    }
    
    // New format: assignmentId-studentId-timestamp
    const parts = submissionId.split('-');
    if (parts.length >= 3) {
      // Skip first part (assignment ID), get student ID
      const studentId = parts[1];
      console.log(`Extracted student ID (new format): "${studentId}"`);
      return studentId;
    }
    
    // Fallback: use first part
    const fallbackId = parts[0];
    console.log(`Extracted student ID (fallback): "${fallbackId}"`);
    return fallbackId;
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

  // Helper method to update meeting with recording info
  private async updateMeetingWithRecording(meetingId: string, classId: string, recordingInfo: {
    recordingId: string;
    recordingS3Key?: string;
    recordingUrl?: string;
  }): Promise<void> {
    try {
      const meetingPath = `/classes/${classId}/meetings/${meetingId}`;
      const meetingData = await this.makeRequest(meetingPath);
      
      // Parse existing metadata
      const metadata = this.parseMeetingMetadata(meetingData.description || '');
      
      // Update with recording info
      const updatedMetadata = {
        ...metadata,
        recordingId: recordingInfo.recordingId,
        recordingS3Key: recordingInfo.recordingS3Key,
        recordingUrl: recordingInfo.recordingUrl,
      };
      
      // Update meeting with full object (required for PUT)
      await this.makeRequest(meetingPath, {
        method: 'PUT',
        body: JSON.stringify({
          ...meetingData,
          description: this.formatMeetingDescription(updatedMetadata),
        }),
      });
    } catch (error) {
      console.error('Error updating meeting with recording info:', error);
      // Don't throw - this is not critical, just log and continue
      console.warn('Meeting update failed, but recording was uploaded successfully');
    }
  }

  // Whiteboard Management
  async saveWhiteboard(classId: string, whiteboardData: {
    title: string;
    dataUrl: string;
    description?: string;
  }): Promise<any> {
    // Try S3 upload first if configured, fallback to Plone
    if (s3Service.isConfigured()) {
      return this.saveWhiteboardToS3(classId, whiteboardData);
    } else {
      return this.saveWhiteboardToPlone(classId, whiteboardData);
    }
  }

  private async saveWhiteboardToS3(classId: string, whiteboardData: {
    title: string;
    dataUrl: string;
    description?: string;
  }): Promise<any> {
    try {
      console.log('Uploading whiteboard to S3...');
      
      // Upload to S3
      const s3Result = await s3Service.uploadWhiteboard(classId, whiteboardData);
      console.log('Whiteboard uploaded to S3:', s3Result);

      // Store metadata in Plone
      const whiteboardMetadata = {
        '@type': 'Document',
        id: `whiteboard-${Date.now()}`,
        title: whiteboardData.title,
        description: JSON.stringify({
          title: whiteboardData.title,
          description: whiteboardData.description || `Whiteboard created on ${new Date().toLocaleString()}`,
          s3Key: s3Result.key,
          s3Url: s3Result.url,
          fileSize: s3Result.size,
          storageType: 's3',
          uploadedAt: new Date().toISOString(),
        }),
      };

      // Ensure whiteboards folder exists in Plone for metadata
      await this.ensureWhiteboardsFolder(classId);
      
      // Store metadata document in Plone
      const whiteboardsPath = `classes/${classId}/whiteboards`;
      const metadataDoc = await this.makeRequest(`/${whiteboardsPath}`, {
        method: 'POST',
        body: JSON.stringify(whiteboardMetadata),
      });

      console.log('Whiteboard metadata stored in Plone:', metadataDoc);
      
      return {
        ...metadataDoc,
        s3Key: s3Result.key,
        s3Url: s3Result.url,
        fileSize: s3Result.size,
        storageType: 's3',
      };
    } catch (error) {
      console.error('Error uploading whiteboard to S3:', error);
      throw error;
    }
  }

  private async saveWhiteboardToPlone(classId: string, whiteboardData: {
    title: string;
    dataUrl: string;
    description?: string;
  }): Promise<any> {
    try {
      const whiteboardsPath = `classes/${classId}/whiteboards`;
      
      // Ensure whiteboards folder exists
      await this.ensureWhiteboardsFolder(classId);

      // Convert data URL to blob
      const response = await fetch(whiteboardData.dataUrl);
      const blob = await response.blob();
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const whiteboardId = `whiteboard-${timestamp}`;
      
      // Create the Image content object with the file data in one step
      console.log('Creating whiteboard Image object with file data...');
      
      // Convert blob to base64 for JSON upload
      const arrayBuffer = await blob.arrayBuffer();
      const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const createResponse = await this.makeRequest(`/${whiteboardsPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          '@type': 'Image',
          id: whiteboardId,
          title: whiteboardData.title,
          description: whiteboardData.description || `Whiteboard created on ${new Date().toLocaleString()}`,
          image: {
            data: base64String,
            encoding: 'base64',
            filename: `${whiteboardId}.png`,
            'content-type': 'image/png',
          },
        }),
      });
      
      console.log('Whiteboard saved successfully:', createResponse);
      return createResponse;
    } catch (error) {
      console.error('Error saving whiteboard:', error);
      throw error;
    }
  }

  async getWhiteboards(classId: string): Promise<any[]> {
    try {
      // Ensure whiteboards folder exists first
      await this.ensureWhiteboardsFolder(classId);
      
      const whiteboardsPath = `classes/${classId}/whiteboards`;
      const response = await this.makeRequest(`/${whiteboardsPath}`);
      
      if (response.items) {
        const whiteboards = response.items
          .filter((item: any) => {
            // Accept Image/File types (Plone storage) and Document types (S3 metadata)
            const isValidType = item['@type'] === 'Image' || item['@type'] === 'File' || item['@type'] === 'Document';
            const hasWhiteboardTitle = item.title && 
              (item.title.toLowerCase().includes('whiteboard') || 
               item.id?.includes('whiteboard'));
            
            // For S3 whiteboards, check if description contains S3 metadata
            let isS3Whiteboard = false;
            if (item['@type'] === 'Document' && item.description) {
              try {
                const metadata = JSON.parse(item.description);
                isS3Whiteboard = metadata.storageType === 's3' && metadata.s3Key;
              } catch (e) {
                // Ignore parse errors
              }
            }
            
            return isValidType && (hasWhiteboardTitle || isS3Whiteboard);
          })
          .map((item: any) => {
            // Parse metadata for S3 whiteboards
            let metadata: any = {};
            try {
              if (item.description && item['@type'] === 'Document') {
                metadata = JSON.parse(item.description);
              }
            } catch (e) {
              // Ignore parsing errors
            }
            
            // Return enhanced whiteboard object
            return {
              ...item,
              storageType: metadata.storageType || 'plone',
              s3Key: metadata.s3Key,
              s3Url: metadata.s3Url,
              fileSize: metadata.fileSize,
              isS3: metadata.storageType === 's3'
            };
          });
        
        console.log(`Found ${whiteboards.length} whiteboards for class ${classId}:`, whiteboards);
        return whiteboards;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching whiteboards:', error);
      return [];
    }
  }

  async deleteWhiteboard(classId: string, whiteboardId: string): Promise<void> {
    try {
      // Get whiteboard metadata first to check if it's stored in S3
      const whiteboardPath = `/classes/${classId}/whiteboards/${whiteboardId}`;
      const whiteboard = await this.makeRequest(whiteboardPath);
      
      // Parse metadata to check storage type
      let metadata: any = {};
      try {
        metadata = JSON.parse(whiteboard.description || '{}');
      } catch (e) {
        // Ignore parsing errors
      }
      
      // If stored in S3, delete from S3 first
      if (metadata.storageType === 's3' && metadata.s3Key) {
        try {
          await s3Service.deleteFile(metadata.s3Key);
          console.log('Deleted whiteboard from S3:', metadata.s3Key);
        } catch (s3Error) {
          console.error('Error deleting from S3:', s3Error);
          // Continue with Plone deletion even if S3 fails
        }
      }
      
      // Delete metadata from Plone
      await this.makeRequest(whiteboardPath, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting whiteboard:', error);
      throw error;
    }
  }

  /**
   * Get a secure access URL for S3 stored files
   */
  async getSecureFileUrl(s3Key: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      if (!s3Service.isConfigured()) {
        throw new Error('S3 is not configured');
      }
      
      const expiresInSeconds = expiresInMinutes * 60;
      return await s3Service.getPresignedUrl(s3Key, expiresInSeconds);
    } catch (error) {
      console.error('Error generating secure file URL:', error);
      throw error;
    }
  }

  /**
   * Test S3 connectivity and configuration
   */
  async testS3Connection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      if (!s3Service.isConfigured()) {
        return {
          success: false,
          error: 'S3 is not configured. Please check your environment variables.',
          details: {
            hasAccessKey: !!process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
            hasSecretKey: !!process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
            hasBucketName: !!process.env.NEXT_PUBLIC_S3_BUCKET_NAME,
            hasRegion: !!process.env.NEXT_PUBLIC_AWS_REGION,
          }
        };
      }

      return await s3Service.testConnection();
    } catch (error) {
      console.error('Error testing S3 connection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const ploneAPI = new PloneAPI();

// Make API available globally for debugging (remove in production)
if (typeof window !== 'undefined') {
  (window as any).ploneAPI = ploneAPI;
  
  // Helper function for fixing student permissions
  (window as any).fixStudentPermissions = async (username: string) => {
    console.log(`Fixing permissions for student: ${username}`);
    try {
      const result = await ploneAPI.fixStudentPermissionsForAllClasses(username);
      console.log('Permission fix result:', result);
      return result;
    } catch (error) {
      console.error('Error fixing permissions:', error);
      return { fixed: [], errors: [error] };
    }
  };
  
  // Helper function to grant basic access to classes folder
  (window as any).grantClassesFolderAccess = async (username: string) => {
    console.log(`Granting classes folder access for student: ${username}`);
    try {
      await ploneAPI.setLocalRoles('/classes', username, ['Reader']);
      console.log(`✅ Granted Reader access to /classes for ${username}`);
      return { success: true };
    } catch (error) {
      console.error('Error granting classes folder access:', error);
      return { success: false, error };
    }
  };
  
  // Helper function to test direct class access
  (window as any).testDirectClassAccess = async (username: string, classIds: string[]) => {
    console.log(`Testing direct access to classes for ${username}:`, classIds);
    const results = { accessible: [] as any[], inaccessible: [] as any[] };
    
    for (const classId of classIds) {
      try {
        console.log(`Testing direct access to /classes/${classId}...`);
        const classData = await fetch(`/api/plone/classes/${classId}`, {
          headers: { 'Authorization': `Bearer ${ploneAPI.getToken()}` }
        }).then(r => r.json());
        console.log(`✅ Can access ${classId}:`, classData.title);
        results.accessible.push({ classId, title: classData.title });
      } catch (error: any) {
        console.log(`❌ Cannot access ${classId}:`, error.message?.substring(0, 100));
        results.inaccessible.push({ classId, error: error.message });
      }
    }
    
    return results;
  };
}