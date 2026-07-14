import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('Express Health Check API (/api/health)', () => {
  let serverProcess: ChildProcess;
  const TEST_PORT = 3123;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    return new Promise((resolve, reject) => {
      // Start backend server in a child process
      serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
        env: { ...process.env, PORT: TEST_PORT.toString(), NODE_ENV: 'test' },
        shell: true
      });

      let resolved = false;

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        // Server prints running message
        if (output.includes('Server running on port')) {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error(`Server Stderr: ${data}`);
      });

      serverProcess.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 5000);
    });
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  it('should return 200 OK and valid JSON structure', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('time');

    // Verify time is a valid ISO date
    const parsedTime = Date.parse(body.time);
    expect(isNaN(parsedTime)).toBe(false);
  });

  it('should handle high concurrency of health check requests', async () => {
    const numRequests = 200;
    const requests = Array.from({ length: numRequests }, () =>
      fetch(`${BASE_URL}/api/health`)
    );

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    console.log(`Finished ${numRequests} concurrent health check requests in ${duration}ms`);

    for (const res of responses) {
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
    }

    // Average latency per request should be low
    const avgLatency = duration / numRequests;
    console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
    expect(avgLatency).toBeLessThan(50); // In intranet, it should be fast
  });
});
