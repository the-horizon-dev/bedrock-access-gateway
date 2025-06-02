/**
 * Example: Using Node.js native fetch with Bedrock Access Gateway
 * 
 * This example demonstrates how to use Node.js native fetch API to interact
 * with the Bedrock Access Gateway API without any external dependencies.
 * 
 * To run this example:
 * 1. Start your Bedrock Access Gateway API locally
 * 2. Set the API_KEY environment variable to match your gateway's API key
 * 3. Run this script with `node node-client-example.js`
 */

// Load environment variables from .env file if available
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not installed, skipping .env loading');
}

// Configuration
const API_KEY = process.env.API_KEY || 'your-api-key';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1';

// Helper function to make API requests
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response;
}

// Example usage functions
async function listModels() {
  console.log('🔍 Fetching available models...');
  const response = await makeRequest('/models');
  const models = await response.json();

  console.log(`✅ Found ${models.data.length} models:`);
  models.data.forEach(model => {
    console.log(`   - ${model.id} (${model.owned_by})`);
  });
  console.log('\n');
}

async function createChatCompletion() {
  console.log('🤖 Sending a chat completion request...');
  const response = await makeRequest('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'gpt-4', // This will be mapped to the appropriate Bedrock model
      messages: [
        { role: 'system', content: 'You are a helpful, friendly AI assistant.' },
        { role: 'user', content: 'What are three benefits of using Amazon Bedrock?' }
      ],
      max_tokens: 150,
    }),
  });

  const completion = await response.json();
  console.log('✅ Response received:');
  console.log(`Model: ${completion.model}`);
  console.log(`Content: ${completion.choices[0].message.content}`);
  console.log('\n');
}

async function createStreamingChatCompletion() {
  console.log('🌊 Testing streaming response...');
  const response = await makeRequest('/chat/completions', {
    method: 'POST',
    headers: {
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful, friendly AI assistant.' },
        { role: 'user', content: 'Count from 1 to 5, with each number on a new line.' }
      ],
      stream: true,
    }),
  });

  console.log('✅ Streaming response:');
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.substring(6));
          process.stdout.write(data.choices[0]?.delta?.content || '');
        } catch (e) {
          // Skip incomplete or invalid JSON
        }
      }
    }
  }
  
  console.log('\n\nStream completed');
}

// Main function to run all examples
async function main() {
  try {
    await listModels();
    await createChatCompletion();
    await createStreamingChatCompletion();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
