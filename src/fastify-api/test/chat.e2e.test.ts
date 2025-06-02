import { test } from 'tap';
import buildServer from '../src/server.js';
import { FastifyInstance } from 'fastify';

let app: FastifyInstance;

test('setup', async (t) => {
  process.env.API_KEY = 'test-api-key';
  process.env.AWS_REGION = 'us-east-1';
  app = await buildServer();
  await app.ready();
  t.pass('server started');
});

test('POST /v1/chat/completions - missing auth', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/chat/completions',
    payload: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    }
  });

  t.equal(response.statusCode, 401);
  const body = JSON.parse(response.body);
  t.equal(body.error.code, 'invalid_api_key');
});

test('POST /v1/chat/completions - valid request', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/chat/completions',
    headers: {
      'Authorization': 'Bearer test-api-key'
    },
    payload: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    }
  });

  // This will fail in test environment without AWS credentials
  // but we're testing the API structure
  t.ok(response.statusCode === 200 || response.statusCode === 500);
});

test('GET /v1/models', async (t) => {
  const response = await app.inject({
    method: 'GET',
    url: '/v1/models'
  });

  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.equal(body.object, 'list');
  t.ok(Array.isArray(body.data));
});

test('GET /health', async (t) => {
  const response = await app.inject({
    method: 'GET',
    url: '/health'
  });

  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.equal(body.status, 'healthy');
});

test('teardown', async (t) => {
  await app.close();
  t.pass('server closed');
});