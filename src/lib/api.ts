// Use NextJS proxy to avoid CORS issues - requests go to /api/plone/* and get proxied to Plone backend
const API_BASE = process.env.NEXT_PUBLIC_PLONE_API_URL || '/api/plone';

export interface PloneClass {
  '@id': string;
  title: string;
  description: string;
  student_count?: number;
  subject?: string;
  grade_level?: string;
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

export interface PloneContent {
  '@id': string;
  '@type': string;
  title: string;
  description: string;
  effective?: string;
  modified?: string;
  review_state?: string;
}

export class PloneAPI {
  private token: string | null = null;

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
      throw new Error(`API request failed: ${response.status} - ${response.statusText}`);
    }

    return response.json();
  }

  async login(username: string, password: string): Promise<void> {
    const response = await this.makeRequest('/@login', {
      method: 'POST',
      body: JSON.stringify({ login: username, password: password }),
    });
    this.token = response.token;
  }

  async getCurrentUser() {
    try {
      if (!this.token) {
        await this.login('admin', 'admin');
      }
      return this.makeRequest('/@login');
    } catch (error) {
      console.log('Current user endpoint not available', error);
      return null;
    }
  }

  async getSiteInfo() {
    // Use the @site endpoint for site information
    return this.makeRequest('/@site');
  }

  async getClasses() {
    try {
      // Try to search for content that might represent classes
      const searchData = await this.makeRequest('/@search?portal_type=Folder&SearchableText=class');
      
      // Filter and transform the results to match our class interface
      const classes = searchData.items?.filter((item: any) => 
        item.title.toLowerCase().includes('class') || 
        item.description.toLowerCase().includes('class')
      ).map((item: any) => ({
        '@id': item['@id'],
        title: item.title,
        description: item.description || '',
        students: 0, // Default since we don't have this data yet
        progress: 0, // Default since we don't have this data yet
        color: 'from-blue-400 to-indigo-600', // Default color
        // icon property removed - will be handled by frontend
      })) || [];
      
      return classes;
    } catch (error) {
      console.log('Classes endpoint not available, returning empty array');
      return [];
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
}

// Singleton instance
export const ploneAPI = new PloneAPI(); 