# SoftyPM MCP Server

Model Context Protocol (MCP) server for seamless SoftyPM integration with Claude Code. This eliminates the need to repeatedly explain APIs or maintain context between sessions.

## Features

🚀 **Native Claude Code Integration** - No more copying API documentation  
📊 **Persistent Project Context** - Maintains your current project across sessions  
🔄 **Automatic Workflow Management** - Enforces proper story progression (Backlog → In Progress → Done)  
📏 **Smart Story Sizing** - Built-in validation for 1-4 hour story guidelines  
⚡ **Zero Setup** - Claude Code automatically knows how to work with your SoftyPM projects  

## Installation

### Prerequisites

- Node.js 18+ 
- Claude Code installed
- SoftyPM account with API access

### 1. Install the MCP Server

**Option A: NPM Install (Recommended)**
```bash
npm install -g @softypm/mcp-server
```

**Option B: From Source**
```bash
# Clone the repository
git clone https://github.com/techcyclist/softypm-mcp-server
cd softypm-mcp-server

# Install and build
npm install && npm run build
```

### 2. Configure Authentication

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your details
SOFTYPM_BASE_URL=https://softypm.com/api
SOFTYPM_API_TOKEN=your_api_token_here
DEFAULT_PROJECT_ID=123  # Optional: set a default project
```

**Getting your API token:**
1. Log into SoftyPM
2. Go to your profile/API settings
3. Generate a new API token
4. Copy it to your `.env` file

### 3. Add to Claude Code Configuration

Add this to your Claude Code MCP configuration:

**MacOS/Linux:** `~/.config/claude-code/mcp.json`  
**Windows:** `%APPDATA%\claude-code\mcp.json`

```json
{
  "mcpServers": {
    "softypm": {
      "command": "node",
      "args": ["/path/to/softypm-mcp-server/dist/index.js"],
      "env": {
        "SOFTYPM_BASE_URL": "https://softypm.com/api",
        "SOFTYPM_API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

### 4. Restart Claude Code

Restart Claude Code to load the MCP server. You should now see SoftyPM tools available automatically!

## Usage

Once installed, Claude Code will automatically have access to these tools:

### Project Context
```
set_project_context(project_id: 123)
```
Sets the current project for all operations. Claude will remember this across the session.

### Story Management
```
create_story(name: "Add user validation", description: "...", estimate: 2)
update_story_status(story_id: 456, status: "3")  # Move to In Progress
get_story(story_id: 456)
list_my_stories(status: "3")  # Show In Progress stories
```

### Project Information
```
get_project_info()  # Shows current project status and next stories
```

## Workflow

The MCP server enforces proper agile workflow:

1. **Set Project Context** - `set_project_context(project_id: 123)`
2. **View Next Work** - `get_project_info()` shows stories ready to work on  
3. **Start Work** - `update_story_status(story_id: 456, status: "3")` (In Progress)
4. **Create Additional Stories** - `create_story()` for any work discovered
5. **Complete Work** - `update_story_status(story_id: 456, status: "5")` (Done)

## Benefits Over Manual API Integration

| Manual API Approach | MCP Server Approach |
|---------------------|-------------------|
| Copy-paste curl commands | Native tool calls |
| Lose context between sessions | Persistent project context |
| Repeat API documentation | Built-in tool definitions |
| Manual token management | Automatic authentication |
| Error-prone status updates | Workflow validation built-in |

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Debug mode
npm run inspect
```

## Troubleshooting

### Authentication Issues
- Verify your API token is correct in `.env`
- Check that your SoftyPM account has API access
- Ensure the base URL is correct (`https://softypm.com/api`)

### Claude Code Not Finding Server
- Check the MCP configuration path is correct
- Verify the server builds without errors (`npm run build`)
- Check Claude Code logs for MCP connection issues
- Restart Claude Code after configuration changes

### Story Creation Fails
- Ensure project context is set first: `set_project_context(project_id: 123)`
- Check that you have write access to the project
- Verify project ID exists and is accessible

### Connection Issues
- Test API connectivity: `curl -H "Authorization: Bearer YOUR_TOKEN" https://softypm.com/api/claude-code/health`
- Check firewall/network restrictions
- Verify SoftyPM is accessible from your network

## API Compatibility

This MCP server works with SoftyPM's Claude Code API endpoints:
- `/api/stories` - Create and manage stories
- `/api/stories/{id}/status` - Update story status  
- `/api/stories/{id}` - Get story details
- `/api/claude-code/projects/{id}/structure` - Get project structure
- `/api/claude-code/health` - Health check

## License

MIT License - see LICENSE file for details.

---

**Questions?** Check the SoftyPM documentation or create an issue in this repository.