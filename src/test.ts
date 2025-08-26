#!/usr/bin/env node

import { SoftYPMClient } from './softypm-client.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('🧪 Testing SoftYPM MCP Server Connection...\n');
  
  const client = new SoftYPMClient({
    baseURL: process.env.SOFTYPM_BASE_URL || 'https://softypm.com/api',
    apiToken: process.env.SOFTYPM_API_TOKEN || '',
  });

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing health check...');
    const isHealthy = await client.healthCheck();
    console.log(`   ✅ Health check: ${isHealthy ? 'PASS' : 'FAIL'}\n`);

    if (!isHealthy) {
      console.log('❌ Health check failed. Please verify your API token and base URL.\n');
      return;
    }

    // Test 2: Get Project (if DEFAULT_PROJECT_ID is set)
    if (process.env.DEFAULT_PROJECT_ID) {
      console.log('2️⃣ Testing project access...');
      const projectId = parseInt(process.env.DEFAULT_PROJECT_ID);
      
      try {
        const project = await client.getProject(projectId);
        console.log(`   ✅ Project access: PASS`);
        console.log(`   📊 Project: ${project.name} (ID: ${project.id})\n`);

        // Test 3: Get Project Stories  
        console.log('3️⃣ Testing story retrieval...');
        const stories = await client.getProjectStories(projectId);
        console.log(`   ✅ Story retrieval: PASS`);
        console.log(`   📋 Found ${stories.length} stories\n`);

        if (stories.length > 0) {
          console.log('📋 **Sample Stories:**');
          stories.slice(0, 3).forEach(story => {
            const statusName = {1: 'Backlog', 3: 'In Progress', 5: 'Done'}[story.status] || story.status;
            console.log(`   • #${story.id}: ${story.name} [${statusName}]`);
          });
          console.log('');
        }
      } catch (error) {
        console.log(`   ❌ Project access: FAIL - ${error instanceof Error ? error.message : String(error)}\n`);
      }
    } else {
      console.log('2️⃣ Skipping project tests (no DEFAULT_PROJECT_ID set)\n');
    }

    console.log('✅ **Connection Test Complete**');
    console.log('\nThe MCP server should work correctly with these settings.');
    console.log('Add this server to your Claude Code MCP configuration to get started!\n');

  } catch (error) {
    console.error('❌ **Connection Test Failed**');
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    console.log('Please check:');
    console.log('- Your API token is correct');
    console.log('- The base URL is accessible');
    console.log('- Your network connection\n');
  }
}

// Run the test
testConnection().catch(console.error);