import tap from 'tap';
import build from '../src/server.ts';

tap.test('health route', async (t) => {
  const app = await build();
  const res = await app.inject({ method: 'GET', url: '/health' });
  t.equal(res.statusCode, 200);
});