const API_BASE = process.env.NEXT_PUBLIC_PLONE_API_URL || 'http://localhost:8080/Plone/++api++';

export interface PloneClass {
  '@id': string;
  title: string;
  description: string;
  student_count: number;
  subject: string;
  grade_level: string;
}

export interface PloneLesson {
  '@id': string;
  title: string;
  description: string;
  subject: string;
  grade_level: string;
  created: string;
  modified: string;
}

export interface PloneUser {
  '@id': string;
  fullname: string;
  email: string;
  roles: string[];
}

export class PloneAPI {
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }

  async getSiteInfo() {
    return this.makeRequest('/');
  }

  async getClasses(): Promise<PloneClass[]> {
    const response = await this.makeRequest('/classes');
    return response.items || [];
  }

  async getLessons(): Promise<PloneLesson[]> {
    const response = await this.makeRequest('/lessons');
    return response.items || [];
  }

  async getCurrentUser(): Promise<PloneUser> {
    return this.makeRequest('/@users/current');
  }

  async getRecentActivity() {
    return this.makeRequest('/recent-activity');
  }

  async searchContent(query: string) {
    return this.makeRequest(`/@search?SearchableText=${encodeURIComponent(query)}`);
  }
}

// Singleton instance
export const ploneAPI = new PloneAPI(); 