// examples/complex-tool-request.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_KEY = process.env.API_KEY || 'your-api-key';
const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

/**
 * Tests a complex request with tools to the Bedrock Gateway
 */
async function testComplexToolRequest() {
  console.log('Testing complex request with tools...');
  
  try {
    // Define example tools
    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA',
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The unit of temperature to use',
              },
            },
            required: ['location'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_stock_price',
          description: 'Get the current stock price for a symbol',
          parameters: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'The stock symbol, e.g. AAPL',
              },
            },
            required: ['symbol'],
          },
        },
      },
    ];

    // Complex request with multimodal content and tools
    const request = {
      model: 'claude-3-5-sonnet-v2',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Use tools when appropriate.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'What\'s the weather like in Seattle right now?',
            }
          ],
        },
      ],
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 800,
    };

    console.log('Request payload:', JSON.stringify(request, null, 2));

    // Make the API call
    const response = await axios.post(`${API_URL}/chat/completions`, request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Error in request:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    console.error(error.stack);
    throw error;
  }
}

// Execute the test
testComplexToolRequest()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(() => {
    console.error('Test failed');
    process.exit(1);
  });
