import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

describe('Health Check Cache Blindness Test', () => {
  let serverProcess: ChildProcess;
  const TEST_PORT = 3125;
  const BASE_URL = `http://localhost:${TEST_PORT}`;
  const DB_PATH = path.resolve(process.cwd(), 'data/db.json');

  beforeAll(async () => {
    // Ensure data dir exists
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    
    // Start backend server
    return new Promise((resolve, reject) => {
      serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
        env: { ...process.env, PORT: TEST_PORT.toString(), NODE_ENV: 'test' },
        shell: true
      });

      let resolved = false;

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
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

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 5000);
    });
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  it('should verify health check returns 200 even if db file is deleted', async () => {
    // 1. Initial health check call to ensure server reads DB and populates cache
    const res1 = await fetch(`${BASE_URL}/api/health`);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.status).toBe('ok');

    // 2. Delete the actual database file on disk!
    let fileDeleted = false;
    try {
      await fs.unlink(DB_PATH);
      fileDeleted = true;
    } catch (err) {
      console.error('Failed to delete DB file:', err);
    }
    expect(fileDeleted).toBe(true);

    // 3. Call health check again.
    // If the health check is active and checks the actual DB file, it should fail (status 500).
    // If it relies on the stale cache, it will return 200 OK.
    const res2 = await fetch(`${BASE_URL}/api/health`);
    const body2 = await res2.json();
    
    console.log('Health check status after DB file deletion:', {
      status: res2.status,
      body: body2
    });

    // The test shows health check returns 200 OK because db.read() reads from memory cache!
    expect(res2.status).toBe(200);
    expect(body2.status).toBe('ok');
  });
});
