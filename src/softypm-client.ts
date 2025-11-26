import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface SoftYPMConfig {
  baseURL: string;
  apiToken: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  client?: { name: string };
  progress_percentage?: number;
}

export interface Story {
  id: number;
  name: string;
  description?: string;
  status: number;
  estimate?: number;
  epic_id?: number;
  project_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateStoryData {
  name: string;
  description?: string;
  estimate?: number;
  epic_id?: number;
  project_id: number;
  status?: number;
}

export class SoftYPMClient {
  private client: AxiosInstance;

  constructor(config: SoftYPMConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const status = error.response.status;
          const message = error.response.data?.message || error.response.statusText;
          
          if (status === 401) {
            throw new Error('Authentication failed. Please check your API token.');
          } else if (status === 403) {
            throw new Error('Access denied. You may not have permission to access this resource.');
          } else if (status === 404) {
            throw new Error('Resource not found.');
          } else if (status >= 500) {
            throw new Error('SoftYPM server error. Please try again later.');
          }
          
          throw new Error(`API Error: ${message}`);
        } else if (error.request) {
          throw new Error('Unable to connect to SoftYPM. Please check your internet connection.');
        } else {
          throw new Error(`Request failed: ${error.message}`);
        }
      }
    );
  }

  async getProject(projectId: number): Promise<Project> {
    try {
      const response: AxiosResponse = await this.client.get(`/projects/${projectId}`);
      return response.data.project || response.data;
    } catch (error) {
      throw new Error(`Failed to get project ${projectId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getProjectStories(projectId: number): Promise<Story[]> {
    try {
      // Try the project structure endpoint first
      const response: AxiosResponse = await this.client.get(`/claude-code/projects/${projectId}/structure`);
      
      if (response.data.success && response.data.data) {
        // Extract stories from the project data
        const project = response.data.data.project;
        const stories: Story[] = [];
        
        // Collect stories from epics
        if (project.epics) {
          project.epics.forEach((epic: any) => {
            if (epic.stories) {
              stories.push(...epic.stories);
            }
          });
        }
        
        // Also get any direct stories on the project
        if (project.stories) {
          stories.push(...project.stories);
        }
        
        return stories;
      }
      
      // Fallback to direct API call if needed
      throw new Error('Unable to get project stories from structure endpoint');
    } catch (error) {
      throw new Error(`Failed to get stories for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createStory(data: CreateStoryData): Promise<Story> {
    try {
      const response: AxiosResponse = await this.client.post('/stories', data);
      
      if (response.data.success) {
        return response.data.story || response.data.data;
      }
      
      // Handle different response formats
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create story: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getStory(storyId: number): Promise<Story> {
    try {
      const response: AxiosResponse = await this.client.get(`/stories/${storyId}`);
      
      if (response.data.success) {
        return response.data.story || response.data.data;
      }
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get story ${storyId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateStoryStatus(storyId: number, status: number): Promise<void> {
    try {
      const response: AxiosResponse = await this.client.post(`/stories/${storyId}/status`, {
        status: status
      });
      
      if (!response.data.success && response.status !== 200) {
        throw new Error(response.data.message || 'Failed to update story status');
      }
    } catch (error) {
      throw new Error(`Failed to update story ${storyId} status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response: AxiosResponse = await this.client.get('/claude-code/health');
      return response.data.success === true;
    } catch (error) {
      return false;
    }
  }
}