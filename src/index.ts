#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SoftYPMClient } from './softypm-client.js';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validation schemas for tool inputs
const CreateStorySchema = z.object({
  name: z.string().min(1, "Story name is required"),
  description: z.string().optional(),
  estimate: z.number().positive().max(8).optional(),
  epic_id: z.number().optional(),
  project_id: z.number().optional(),
});

const UpdateStoryStatusSchema = z.object({
  story_id: z.number().positive(),
  status: z.enum(['1', '3', '5']).or(z.number().min(1).max(5)),
  notes: z.string().optional(),
});

const GetProjectSchema = z.object({
  project_id: z.number().positive().optional(),
});

const SetProjectContextSchema = z.object({
  project_id: z.number().positive(),
});

class SoftYPMServer {
  private server: Server;
  private softYPMClient: SoftYPMClient;
  private currentProjectId: number | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'softypm-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.softYPMClient = new SoftYPMClient({
      baseURL: process.env.SOFTYPM_BASE_URL || 'https://softypm.com/api',
      apiToken: process.env.SOFTYPM_API_TOKEN || '',
    });

    // Set default project if provided
    if (process.env.DEFAULT_PROJECT_ID) {
      this.currentProjectId = parseInt(process.env.DEFAULT_PROJECT_ID);
    }

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'set_project_context',
            description: 'Set the current project context for all subsequent operations',
            inputSchema: {
              type: 'object',
              properties: {
                project_id: {
                  type: 'number',
                  description: 'The project ID to set as current context',
                },
              },
              required: ['project_id'],
            },
          },
          {
            name: 'get_project_info',
            description: 'Get current project information, stories, and progress',
            inputSchema: {
              type: 'object',
              properties: {
                project_id: {
                  type: 'number',
                  description: 'Project ID (optional if project context is set)',
                },
              },
            },
          },
          {
            name: 'create_story',
            description: 'Create a new story in the current project. Stories should be 1-4 hours of work.',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Story title (be specific and actionable)',
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the work to be done',
                },
                estimate: {
                  type: 'number',
                  description: 'Estimated hours (1-8, prefer 1-4 for good stories)',
                  minimum: 1,
                  maximum: 8,
                },
                epic_id: {
                  type: 'number',
                  description: 'Epic ID to assign this story to (optional)',
                },
                project_id: {
                  type: 'number',
                  description: 'Project ID (optional if project context is set)',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'update_story_status',
            description: 'Update story status following proper workflow: Backlog(1) → In Progress(3) → Done(5)',
            inputSchema: {
              type: 'object',
              properties: {
                story_id: {
                  type: 'number',
                  description: 'The story ID to update',
                },
                status: {
                  type: 'string',
                  enum: ['1', '3', '5'],
                  description: '1=Backlog, 3=In Progress, 5=Done. Always follow workflow order.',
                },
                notes: {
                  type: 'string',
                  description: 'Optional progress notes',
                },
              },
              required: ['story_id', 'status'],
            },
          },
          {
            name: 'get_story',
            description: 'Get details for a specific story',
            inputSchema: {
              type: 'object',
              properties: {
                story_id: {
                  type: 'number',
                  description: 'The story ID to retrieve',
                },
              },
              required: ['story_id'],
            },
          },
          {
            name: 'list_my_stories',
            description: 'List stories in current project, optionally filtered by status',
            inputSchema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['1', '3', '5', 'all'],
                  description: 'Filter by status: 1=Backlog, 3=In Progress, 5=Done, all=All stories',
                },
                project_id: {
                  type: 'number',
                  description: 'Project ID (optional if project context is set)',
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'set_project_context':
            return await this.setProjectContext(args);
          
          case 'get_project_info':
            return await this.getProjectInfo(args);
          
          case 'create_story':
            return await this.createStory(args);
          
          case 'update_story_status':
            return await this.updateStoryStatus(args);
          
          case 'get_story':
            return await this.getStory(args);
          
          case 'list_my_stories':
            return await this.listStories(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async setProjectContext(args: any) {
    const { project_id } = SetProjectContextSchema.parse(args);
    
    try {
      // Verify project exists and user has access
      const project = await this.softYPMClient.getProject(project_id);
      this.currentProjectId = project_id;
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Project context set to: ${project.name} (ID: ${project_id})\n\nYou are now acting as both DEVELOPER and PROJECT MANAGER for this project. Remember to:\n\n🔄 **Workflow**: Always move stories Backlog(1) → In Progress(3) → Done(5)\n📏 **Story Size**: Keep stories 1-4 hours, create new ones for additional work\n📊 **Track Progress**: Update story status as you work\n\nProject Progress: ${project.progress_percentage || 0}% complete`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to set project context: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getProjectInfo(args: any) {
    const { project_id } = GetProjectSchema.parse(args);
    const projectId = project_id || this.currentProjectId;
    
    if (!projectId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No project context set. Use set_project_context first or provide project_id.'
      );
    }

    try {
      const project = await this.softYPMClient.getProject(projectId);
      const stories = await this.softYPMClient.getProjectStories(projectId);
      
      const backlogStories = stories.filter(s => {
        const status = typeof s.status === 'string' ? parseInt(s.status) : s.status;
        return status === 1;
      });
      const inProgressStories = stories.filter(s => {
        const status = typeof s.status === 'string' ? parseInt(s.status) : s.status;
        return status === 3;
      });
      const doneStories = stories.filter(s => {
        const status = typeof s.status === 'string' ? parseInt(s.status) : s.status;
        return status === 5;
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `📊 **${project.name}** (Project #${projectId})

**Progress**: ${project.progress_percentage || 0}% complete
**Stories**: ${doneStories.length} done, ${inProgressStories.length} in progress, ${backlogStories.length} in backlog

**🚀 Next Stories to Work On:**
${inProgressStories.length > 0 
  ? inProgressStories.slice(0, 3).map(s => `• #${s.id}: ${s.name} (${s.estimate || '?'}h)`).join('\n')
  : backlogStories.slice(0, 3).map(s => `• #${s.id}: ${s.name} (${s.estimate || '?'}h) - Move to In Progress first`).join('\n')
}

**Remember**: 
- Move stories to "In Progress" before starting work
- Create new stories for any additional work discovered  
- Keep stories 1-4 hours each for best tracking`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get project info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async createStory(args: any) {
    const { name, description, estimate, epic_id, project_id } = CreateStorySchema.parse(args);
    const targetProjectId = project_id || this.currentProjectId;
    
    if (!targetProjectId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No project context set. Use set_project_context first or provide project_id.'
      );
    }

    // Validate story size
    if (estimate && estimate > 6) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ **Story Too Large**: "${name}" is estimated at ${estimate} hours.\n\nStories should be 1-4 hours for best tracking. Consider breaking this down into smaller stories:\n\n**Example breakdown:**\n• Create core functionality (3h)\n• Add validation and error handling (2h)\n• Write tests (2h)\n• Update documentation (1h)\n\nWould you like to create a smaller, more focused story instead?`,
          },
        ],
      };
    }

    try {
      const story = await this.softYPMClient.createStory({
        name,
        description,
        estimate,
        epic_id,
        project_id: targetProjectId,
        status: 1, // Start in backlog
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **Story Created**: #${story.id} - ${story.name}\n\n📝 **Description**: ${description || 'No description provided'}\n⏱️ **Estimate**: ${estimate || 'Not estimated'} hours\n📊 **Status**: Backlog (ready to start)\n\n**Next step**: Use \`update_story_status\` to move it to "In Progress" when you start working on it.`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create story: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async updateStoryStatus(args: any) {
    const { story_id, status, notes } = UpdateStoryStatusSchema.parse(args);
    const targetStatus = typeof status === 'string' ? parseInt(status) : status;
    
    try {
      // Get current story status to validate workflow
      const currentStory = await this.softYPMClient.getStory(story_id);
      const currentStatus = typeof currentStory.status === 'string' ? parseInt(currentStory.status) : currentStory.status;
      
      // Validate workflow progression
      const statusNames: Record<number, string> = { 1: 'Backlog', 3: 'In Progress', 5: 'Done' };
      const validTransitions: Record<number, number[]> = {
        1: [3], // Backlog → In Progress
        3: [5, 1], // In Progress → Done or back to Backlog  
        5: [1, 3], // Done → reopened states
      };
      
      if (!validTransitions[currentStatus]?.includes(targetStatus)) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **Invalid Workflow Transition**\n\nCannot move story from "${statusNames[currentStatus]}" to "${statusNames[targetStatus]}"\n\n**Valid workflow**: Backlog (1) → In Progress (3) → Done (5)\n\nCurrent status: ${statusNames[currentStatus]}\nValid next steps: ${validTransitions[currentStatus]?.map((s: number) => statusNames[s]).join(', ')}`,
            },
          ],
        };
      }
      
      await this.softYPMClient.updateStoryStatus(story_id, targetStatus);
      
      let message = `✅ **Story Updated**: #${story_id} - ${currentStory.name}\n\n📊 **Status**: ${statusNames[currentStatus]} → ${statusNames[targetStatus]}`;
      
      if (notes) {
        message += `\n📝 **Notes**: ${notes}`;
      }
      
      if (targetStatus === 3) {
        message += '\n\n🔨 **Now In Progress** - You are actively working on this story. Remember to move it to "Done" when completed.';
      } else if (targetStatus === 5) {
        message += '\n\n🎉 **Story Completed!** - Great work! This story is now marked as done.';
      }
      
      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update story status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getStory(args: any) {
    const { story_id } = z.object({ story_id: z.number() }).parse(args);
    
    try {
      const story = await this.softYPMClient.getStory(story_id);
      const statusNames: Record<number, string> = { 1: 'Backlog', 3: 'In Progress', 5: 'Done' };
      const storyStatus = typeof story.status === 'string' ? parseInt(story.status) : story.status;
      
      return {
        content: [
          {
            type: 'text',
            text: `📋 **Story #${story.id}**: ${story.name}\n\n📝 **Description**: ${story.description || 'No description'}\n📊 **Status**: ${statusNames[storyStatus] || storyStatus}\n⏱️ **Estimate**: ${story.estimate || 'Not estimated'} hours\n📅 **Created**: ${story.created_at ? new Date(story.created_at).toLocaleDateString() : 'Unknown'}\n\n${storyStatus === 1 ? '💡 **Next**: Move to "In Progress" when you start working' : storyStatus === 3 ? '🔨 **Active**: Currently in progress' : '✅ **Complete**: This story is done'}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get story: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async listStories(args: any) {
    const { status, project_id } = z.object({
      status: z.enum(['1', '3', '5', 'all']).optional(),
      project_id: z.number().optional(),
    }).parse(args);
    
    const targetProjectId = project_id || this.currentProjectId;
    
    if (!targetProjectId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No project context set. Use set_project_context first or provide project_id.'
      );
    }

    try {
      const stories = await this.softYPMClient.getProjectStories(targetProjectId);
      const statusNames: Record<number, string> = { 1: 'Backlog', 3: 'In Progress', 5: 'Done' };
      
      let filteredStories = stories;
      if (status && status !== 'all') {
        const targetStatus = parseInt(status);
        filteredStories = stories.filter(s => {
          const storyStatus = typeof s.status === 'string' ? parseInt(s.status) : s.status;
          return storyStatus === targetStatus;
        });
      }
      
      if (filteredStories.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `📋 **No Stories Found** ${status && status !== 'all' ? `with status "${statusNames[parseInt(status)]}"` : ''}`,
            },
          ],
        };
      }
      
      const storyList = filteredStories
        .slice(0, 10) // Limit to 10 stories
        .map(story => {
          const storyStatus = typeof story.status === 'string' ? parseInt(story.status) : story.status;
          return `• #${story.id}: ${story.name} [${statusNames[storyStatus]}] ${story.estimate ? `(${story.estimate}h)` : ''}`;
        })
        .join('\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `📋 **Stories** ${status && status !== 'all' ? `(${statusNames[parseInt(status)]})` : ''}:\n\n${storyList}\n\n${filteredStories.length > 10 ? `... and ${filteredStories.length - 10} more` : ''}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list stories: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('SoftYPM MCP server running on stdio');
  }
}

const server = new SoftYPMServer();
server.run().catch(console.error);