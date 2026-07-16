import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

describe('Server API Integration Tests', () => {
  let serverProcess: ChildProcess;
  const TEST_PORT = 3128;
  const BASE_URL = `http://localhost:${TEST_PORT}`;
  const DB_PATH = path.resolve(process.cwd(), 'data/db.json');
  let dbBackup: string | null = null;

  beforeAll(async () => {
    // 1. Back up existing db.json to avoid polluting local development data
    try {
      dbBackup = await fs.readFile(DB_PATH, 'utf-8');
    } catch {
      dbBackup = null;
    }

    // Ensure data directory exists
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

    // Initialize with a clean database state
    const cleanDb = { project: null, bomItems: [], logs: [] };
    await fs.writeFile(DB_PATH, JSON.stringify(cleanDb, null, 2), 'utf-8');

    // 2. Startbackend server in a child process
    return new Promise((resolve, reject) => {
      const entryPath = path.resolve(process.cwd(), 'dist/server/index.js');
      serverProcess = spawn('node', [entryPath], {
        env: { ...process.env, PORT: TEST_PORT.toString(), NODE_ENV: 'test' },
        shell: true,
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

      // Fallback timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 5000);
    });
  });

  afterAll(async () => {
    // 1. Terminate server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }

    // 2. Restore DB backup
    try {
      if (dbBackup !== null) {
        await fs.writeFile(DB_PATH, dbBackup, 'utf-8');
      } else {
        await fs.unlink(DB_PATH);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('POST /api/purchase/export should fail with 400 if no project is setup', async () => {
    const res = await fetch(`${BASE_URL}/api/purchase/export`, {
      method: 'POST',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No project setup found');
  });

  it('POST /api/project/setup should fail with 400 if projectId is empty', async () => {
    const res = await fetch(`${BASE_URL}/api/project/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: '', targetQty: 10 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Project ID cannot be empty');
  });

  it('POST /api/project/setup should fail with 400 if targetQty is invalid or <= 0', async () => {
    const res = await fetch(`${BASE_URL}/api/project/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'PRJ-1', targetQty: -5 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Quantity must be greater than 0');

    const res2 = await fetch(`${BASE_URL}/api/project/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'PRJ-1', targetQty: 'abc' }),
    });
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.error).toBe('Quantity must be greater than 0');
  });

  it('POST /api/project/setup should initialize project details and parse BOM', async () => {
    const payload = {
      projectId: 'PRJ-2026-T1',
      costCenter: 'CC-T1',
      targetQty: 10,
      bomText: `物料号,物料名称,单机用量,负责人
M-001,MCU Board,2,张三
M-002,12V Adapter,1,李四`,
      deadline: '2026-08-31',
    };

    const res = await fetch(`${BASE_URL}/api/project/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.project.projectId).toBe('PRJ-2026-T1');
    expect(body.project.targetQty).toBe(10);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].code).toBe('M-001');
    expect(body.data[0].qtyPerMachine).toBe(2);

    // Verify database file has been written correctly
    const dbContent = JSON.parse(await fs.readFile(DB_PATH, 'utf-8'));
    expect(dbContent.project.projectId).toBe('PRJ-2026-T1');
    expect(dbContent.bomItems).toHaveLength(2);
  });

  it('GET /api/project should fetch details and calculate correct KPIs before sync', async () => {
    const res = await fetch(`${BASE_URL}/api/project`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.project.projectId).toBe('PRJ-2026-T1');
    // Initially stock is 0 for all items, so:
    // bomCoverage should be 0 (since both items have shortage of required quantity)
    expect(body.bomCoverage).toBe(0);
    // estimatedBuildable should be 0
    expect(body.estimatedBuildable).toBe(0);
    // shortageCount should be 2 (both M-001 and M-002 have shortages)
    expect(body.shortageCount).toBe(2);
  });

  it('GET /api/mass/sync should query warehouse stock levels, update local db, and not mutate mock database', async () => {
    const res = await fetch(`${BASE_URL}/api/mass/sync`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify correct stock levels returned
    const item1 = body.data.find((it: any) => it.code === 'M-001');
    const item2 = body.data.find((it: any) => it.code === 'M-002');
    expect(item1.currentStock).toBe(15); // from mockInventory
    expect(item2.currentStock).toBe(3);  // from mockInventory

    // Verify database has been updated
    const dbContent = JSON.parse(await fs.readFile(DB_PATH, 'utf-8'));
    const dbItem1 = dbContent.bomItems.find((it: any) => it.code === 'M-001');
    const dbItem2 = dbContent.bomItems.find((it: any) => it.code === 'M-002');
    expect(dbItem1.currentStock).toBe(15);
    expect(dbItem2.currentStock).toBe(3);

    // Verify calculated risk levels:
    // M-001: Req = 20, Stock = 15. Shortage = 5. LeadTime = 10 (<= 15). Risk should be Medium
    expect(dbItem1.riskLevel).toBe('Medium');
    // M-002: Req = 10, Stock = 3. Shortage = 7. LeadTime = 5 (<= 15). Risk should be Medium
    expect(dbItem2.riskLevel).toBe('Medium');

    // Run sync again to confirm read-only behavior and no mutation of mock database
    const res2 = await fetch(`${BASE_URL}/api/mass/sync`);
    const body2 = await res2.json();
    const item1_second = body2.data.find((it: any) => it.code === 'M-001');
    expect(item1_second.currentStock).toBe(15);
  });

  it('GET /api/project should return correct KPIs after sync', async () => {
    const res = await fetch(`${BASE_URL}/api/project`);
    expect(res.status).toBe(200);
    const body = await res.json();

    // M-001: Stock = 15, Req = 20 -> Shortage = 5
    // M-002: Stock = 3, Req = 10 -> Shortage = 7
    // Both still have shortages. bomCoverage is still 0
    expect(body.bomCoverage).toBe(0);
    // estimatedBuildable = min(floor(15/2), floor(3/1)) = min(7, 3) = 3
    expect(body.estimatedBuildable).toBe(3);
    // shortageCount is still 2
    expect(body.shortageCount).toBe(2);
  });

  it('POST /api/purchase/export should export pending shortages to CSV and transition status to OA Submitted', async () => {
    const res = await fetch(`${BASE_URL}/api/purchase/export`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('PRJ-2026-T1_purchase.csv');

    const csvContent = await res.text();
    const lines = csvContent.trim().split('\n');

    expect(lines[0]).toBe('物料号,数量,负责人,成本中心,项目号');
    // We expect both items in the CSV since both have shortages and were 'Pending'
    // M-001 shortage: 20 - 15 = 5
    // M-002 shortage: 10 - 3 = 7
    expect(lines).toContain('M-001,5,张三,CC-T1,PRJ-2026-T1');
    expect(lines).toContain('M-002,7,李四,CC-T1,PRJ-2026-T1');

    // Check database to ensure status transition to 'OA Submitted'
    const dbContent = JSON.parse(await fs.readFile(DB_PATH, 'utf-8'));
    expect(dbContent.bomItems[0].status).toBe('OA Submitted');
    expect(dbContent.bomItems[1].status).toBe('OA Submitted');

    // Test subsequent export returns no items since their status is now 'OA Submitted' (not 'Pending')
    const resSecondExport = await fetch(`${BASE_URL}/api/purchase/export`, {
      method: 'POST',
    });
    expect(resSecondExport.status).toBe(200);
    const secondCsvContent = await resSecondExport.text();
    const secondLines = secondCsvContent.trim().split('\n');
    expect(secondLines).toHaveLength(1); // Only headers
    expect(secondLines[0]).toBe('物料号,数量,负责人,成本中心,项目号');
  });
});
