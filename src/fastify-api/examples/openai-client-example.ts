/**
 * Example: Using OpenAI SDK with Bedrock Access Gateway
 * 
 * This example demonstrates how to use the OpenAI JavaScript/TypeScript SDK to interact
 * with the Bedrock Access Gateway API. This shows that your API is compatible with
 * existing OpenAI client libraries.
 * 
 * To run this example:
 * 1. Start your Bedrock Access Gateway API locally
 * 2. Set the API_KEY environment variable to match your gateway's API key
 * 3. Run this script with `ts-node openai-client-example.ts`
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

// Configuration
const API_KEY = process.env.API_KEY || 'your-api-key';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1';

// Initialize the OpenAI client with custom base URL
const openai = new OpenAI({
  apiKey: API_KEY,
  baseURL: API_BASE_URL,
});

async function main() {
  try {
    console.log('🔍 Fetching available models...');
    const models = await openai.models.list();
    console.log(`✅ Found ${models.data.length} models:`);
    models.data.forEach(model => {
      console.log(`   - ${model.id} (${model.owned_by})`);
    });
    console.log('\n');

    console.log('🤖 Sending a chat completion request...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4', // This will be mapped to the appropriate Bedrock model
      messages: [
        { role: 'system', content: 'You are a helpful, friendly AI assistant.' },
        { role: 'user', content: 'What are three benefits of using Amazon Bedrock?' }
      ],
      max_tokens: 150,
    });

    console.log('✅ Response received:');
    console.log(`Model: ${completion.model}`);
    console.log(`Content: ${completion.choices[0].message.content}`);
    console.log('\n');

    console.log('🌊 Testing streaming response...');
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful, friendly AI assistant.' },
        { role: 'user', content: 'Count from 1 to 5, with each number on a new line.' }
      ],
      stream: true,
    });

    console.log('✅ Streaming response:');
    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content || '');
    }
    console.log('\n\nStream completed');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

main().catch(console.error);
