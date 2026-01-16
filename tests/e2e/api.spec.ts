import { test, expect, type APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { createTestReporter, TEST_USER } from './utils/index.js';

async function getAuthCookie(request: APIRequestContext): Promise<string> {
  const loginResponse = await request.post('/api/login', {
    data: {
      username: TEST_USER.username,
      password: TEST_USER.password,
    },
  });

  const allHeaders = loginResponse.headers();
  const cookies = allHeaders['set-cookie'];

  if (!cookies) {
    const status = loginResponse.status();
    const body = await loginResponse.text();
    throw new Error(`No session cookie received. Status: ${status}, Body: ${body}, Headers: ${JSON.stringify(Object.keys(allHeaders))}`);
  }

  const sessionMatch = cookies.match(/mailpilot_session=([^;]+)/);
  if (!sessionMatch) throw new Error(`Session cookie not found in: ${cookies}`);

  return `mailpilot_session=${sessionMatch[1]}`;
}

test.describe('API - Public Endpoints', () => {
  test('GET /health returns status ok', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /health');
      const response = await request.get('/health');
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify response body contains status: ok');
      const body = await response.json();
      expect(body).toHaveProperty('status', 'ok');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('GET /health returns accounts status', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /health');
      const response = await request.get('/health');
      await reporter.stepComplete();

      await reporter.step('Verify accounts info present');
      const body = await response.json();
      expect(body).toHaveProperty('accounts');
      expect(body.accounts).toHaveProperty('connected');
      expect(body.accounts).toHaveProperty('total');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('GET /health returns uptime', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /health');
      const response = await request.get('/health');
      await reporter.stepComplete();

      await reporter.step('Verify uptime is present');
      const body = await response.json();
      expect(body).toHaveProperty('uptime');
      expect(typeof body.uptime).toBe('number');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('GET /non-existent returns 404', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /non-existent-endpoint');
      const response = await request.get('/non-existent-endpoint');
      await reporter.stepComplete();

      await reporter.step('Verify response status 404');
      expect(response.status()).toBe(404);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});

test.describe('API - Authentication Endpoints', () => {
  test('GET /api/auth returns needsSetup status', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /api/auth');
      const response = await request.get('/api/auth');
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify needsSetup field exists');
      const body = await response.json();
      expect(body).toHaveProperty('needsSetup');
      expect(typeof body.needsSetup).toBe('boolean');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('GET /api/auth returns authenticated field', async ({ baseURL }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      // Create fresh request context without cookies to test unauthenticated state
      const freshRequest = await playwrightRequest.newContext({ baseURL });

      await reporter.step('GET /api/auth with fresh context');
      const response = await freshRequest.get('/api/auth');
      await reporter.stepComplete();

      await reporter.step('Verify authenticated field exists');
      const body = await response.json();
      expect(body).toHaveProperty('authenticated');
      expect(typeof body.authenticated).toBe('boolean');
      await reporter.stepComplete();

      await freshRequest.dispose();
      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('POST /api/login with valid credentials returns session cookie', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('POST /api/login with valid credentials');
      const response = await request.post('/api/login', {
        data: {
          username: TEST_USER.username,
          password: TEST_USER.password,
        },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify session cookie set');
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies).toContain('mailpilot_session=');
      await reporter.stepComplete();

      await reporter.step('Verify response body');
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('POST /api/login with invalid credentials returns 401', async ({ baseURL }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      // Use fresh context to avoid rate limiting from previous tests
      const freshRequest = await playwrightRequest.newContext({ baseURL });

      await reporter.step('POST /api/login with invalid credentials');
      const response = await freshRequest.post('/api/login', {
        data: {
          username: 'wronguser',
          password: 'wrongpassword',
        },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 401');
      expect(response.status()).toBe(401);
      await reporter.stepComplete();

      await reporter.step('Verify error response');
      const body = await response.json();
      expect(body).toHaveProperty('error');
      await reporter.stepComplete();

      await freshRequest.dispose();
      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('POST /api/logout clears session', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login first');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('POST /api/logout');
      const response = await request.post('/api/logout', {
        headers: { Cookie: cookie },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify logout response');
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});

test.describe('API - Webhook Test Endpoint', () => {
  test('POST /api/test-webhook with valid URL returns success', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('POST /api/test-webhook');
      // Use httpbin.org as a reliable test endpoint that accepts POST
      const response = await request.post('/api/test-webhook', {
        headers: { Cookie: cookie },
        data: {
          url: 'https://httpbin.org/post',
          headers: {},
        },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify response body indicates success');
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('statusCode');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('POST /api/test-webhook with invalid URL returns error', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('POST /api/test-webhook with invalid URL');
      const response = await request.post('/api/test-webhook', {
        headers: { Cookie: cookie },
        data: {
          url: 'not-a-valid-url',
        },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response indicates failure');
      const body = await response.json();
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('POST /api/test-webhook without URL returns error', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('POST /api/test-webhook without URL');
      const response = await request.post('/api/test-webhook', {
        headers: { Cookie: cookie },
        data: {},
      });
      await reporter.stepComplete();

      await reporter.step('Verify response indicates failure');
      const body = await response.json();
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error', 'URL is required');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('POST /api/test-webhook with custom headers sends them', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('POST /api/test-webhook with custom headers');
      const response = await request.post('/api/test-webhook', {
        headers: { Cookie: cookie },
        data: {
          url: 'https://httpbin.org/post',
          headers: {
            'X-Custom-Header': 'test-value',
            'Authorization': 'Bearer test-token',
          },
        },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify response body');
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('POST /api/test-webhook requires authentication', async ({ baseURL }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      const freshRequest = await playwrightRequest.newContext({ baseURL });

      await reporter.step('POST /api/test-webhook without auth');
      const response = await freshRequest.post('/api/test-webhook', {
        data: {
          url: 'https://httpbin.org/post',
        },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 401');
      expect(response.status()).toBe(401);
      await reporter.stepComplete();

      await freshRequest.dispose();
      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});

test.describe('API - Protected Endpoints', () => {
  test('GET /api/stats returns stats', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /api/stats');
      const response = await request.get('/api/stats');
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify stats structure');
      const body = await response.json();
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('accounts');
      expect(body).toHaveProperty('totals');
      expect(body).toHaveProperty('actionBreakdown');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('GET /api/activity returns paginated entries', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('GET /api/activity with auth');
      const response = await request.get('/api/activity?limit=10', {
        headers: { Cookie: cookie },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify response structure');
      const body = await response.json();
      expect(body).toHaveProperty('entries');
      expect(Array.isArray(body.entries)).toBe(true);
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('GET /api/logs returns paginated logs', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('GET /api/logs with auth');
      const response = await request.get('/api/logs?limit=10', {
        headers: { Cookie: cookie },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify response structure');
      const body = await response.json();
      expect(body).toHaveProperty('logs');
      expect(Array.isArray(body.logs)).toBe(true);
      expect(body).toHaveProperty('total');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('GET /api/dead-letter returns entries', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('GET /api/dead-letter with auth');
      const response = await request.get('/api/dead-letter', {
        headers: { Cookie: cookie },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify response structure');
      const body = await response.json();
      expect(body).toHaveProperty('entries');
      expect(Array.isArray(body.entries)).toBe(true);
      expect(body).toHaveProperty('total');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('GET /api/config returns configuration', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('Login');
      const cookie = await getAuthCookie(request);
      await reporter.stepComplete();

      await reporter.step('GET /api/config with auth');
      const response = await request.get('/api/config', {
        headers: { Cookie: cookie },
      });
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify config structure');
      const body = await response.json();
      expect(body).toHaveProperty('config');
      expect(body.config).toHaveProperty('accounts');
      expect(body.config).toHaveProperty('llm_providers');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});
