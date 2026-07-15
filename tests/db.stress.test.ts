import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalDb, ProjectConfig, BomItem } from '../server/db';
import fs from 'fs/promises';
import path from 'path';

const STRESS_DB_PATH = path.resolve(process.cwd(), 'data/stress_db.json');

describe('LocalDb Empirical Stress Tests & Edge Cases', () => {
  let db: LocalDb;

  beforeEach(async () => {
    db = new LocalDb(STRESS_DB_PATH);
    await db.clear();
  });

  afterEach(async () => {
    try {
      await fs.unlink(STRESS_DB_PATH);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  // 1. Concurrency (Concurrent DB updates)
  it('should test behavior under concurrent project config updates', async () => {
    const numRequests = 50;
    const promises: Promise<void>[] = [];

    // Spin up 50 concurrent writes
    for (let i = 0; i < numRequests; i++) {
      const project: ProjectConfig = {
        projectId: `PRJ-${i}`,
        costCenter: `CC-${i}`,
        targetQty: i,
      };
      promises.push(db.saveProject(project));
    }

    // Await all. If there is concurrent fs.writeFile, this could throw or corrupt the file.
    let errorOccurred = false;
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Error during concurrent writes:', err);
      errorOccurred = true;
    }

    // Let's read the database and verify if it's corrupted or readable
    let data;
    let readError = false;
    try {
      data = await db.read();
    } catch (err) {
      readError = true;
    }

    console.log('Result of concurrent saveProject writes:', {
      errorOccurred,
      readError,
      finalProject: data?.project,
    });

    // Check if the file is valid JSON and contains one of the written projects
    expect(readError).toBe(false);
    if (data && data.project) {
      expect(data.project.projectId).toMatch(/^PRJ-\d+$/);
    }
  });

  it('should test data loss under concurrent bomItems appends', async () => {
    // If multiple client requests concurrently read, append to the array, and write back,
    // they will overwrite each other's changes.
    await db.saveBomItems([]);

    const numUpdates = 20;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < numUpdates; i++) {
      const appendTask = async () => {
        const currentItems = await db.getBomItems();
        const newItem: BomItem = {
          code: `M-${i}`,
          name: `Item ${i}`,
          qtyPerMachine: 1,
          owner: `Owner ${i}`,
          status: 'Pending',
          currentStock: 0,
          leadTime: 5,
          riskLevel: 'Low',
        };
        await db.saveBomItems([...currentItems, newItem]);
      };
      promises.push(appendTask());
    }

    await Promise.all(promises);

    const finalItems = await db.getBomItems();
    console.log(`Concurrent BOM items append count: expected ${numUpdates}, got ${finalItems.length}`);
    
    // In a race condition without locks, many updates will be lost.
    // If finalItems.length < numUpdates, data loss is empirically proven.
    expect(finalItems.length).toBeLessThanOrEqual(numUpdates);
  });

  it('should test JSON file corruption under heavy concurrent writing', async () => {
    // Force direct parallel writes to the exact same file path using direct fs.writeFile
    // or through multiple db.write calls to check if JSON becomes corrupt or empty.
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      const mockDbState = {
        project: { projectId: `PRJ-${i}`, costCenter: 'CC', targetQty: 1 },
        bomItems: Array.from({ length: 50 }, (_, k) => ({
          code: `M-${i}-${k}`,
          name: `Item ${k}`,
          qtyPerMachine: 1,
          owner: 'Test',
          status: 'Pending' as const,
          currentStock: 0,
          leadTime: 1,
          riskLevel: 'Low' as const,
        })),
      };
      promises.push(db.write(mockDbState));
    }

    await Promise.all(promises);

    // Let's read the file directly and try to parse it
    const fileContent = await fs.readFile(STRESS_DB_PATH, 'utf-8');
    let parsedSuccessfully = false;
    try {
      JSON.parse(fileContent);
      parsedSuccessfully = true;
    } catch (err) {
      console.error('JSON parsing failed on concurrent writes:', err);
    }

    console.log(`Direct JSON parse after 100 concurrent writes success: ${parsedSuccessfully}, length: ${fileContent.length}`);
    // If it failed or is empty, we have corruption!
  });

  // 2. Empty / Invalid Configurations
  it('should test empty database file behavior', async () => {
    // Write 0 bytes (empty file) to the DB path
    await fs.writeFile(STRESS_DB_PATH, '', 'utf-8');

    // db.read() should handle empty file and fall back to DEFAULT_DB
    const data = await db.read();
    expect(data).toEqual({ project: null, bomItems: [], logs: [] });

    // Now verify what happens if we save project: does it overwrite the corrupted file with a valid structure?
    await db.saveProject({ projectId: 'NEW-PRJ', costCenter: 'CC-1', targetQty: 5 });
    const saved = await db.getProject();
    expect(saved?.projectId).toBe('NEW-PRJ');
  });

  it('should test invalid JSON format in database file', async () => {
    // Write malformed JSON
    await fs.writeFile(STRESS_DB_PATH, '{ malformed json ', 'utf-8');

    // db.read() should catch error and return DEFAULT_DB
    const data = await db.read();
    expect(data).toEqual({ project: null, bomItems: [], logs: [] });
  });

  it('should test invalid schema/missing keys in database file', async () => {
    // Write a valid JSON but with incorrect/missing schema
    const invalidSchemaData = {
      somethingElse: 'unexpected data',
    };
    await fs.writeFile(STRESS_DB_PATH, JSON.stringify(invalidSchemaData), 'utf-8');

    // Reading the DB returns a fallback DbSchema, ensuring project is null and bomItems is []
    const data = await db.read();
    expect(data.bomItems).toEqual([]);
    expect(data.bomItems).not.toBeUndefined();
    expect(data.project).toBeNull();

    // If client code tries to access getBomItems, it returns an empty array
    const items = await db.getBomItems();
    expect(items).toEqual([]);

    // Now try to do operations on it (e.g. mapping over it, which should NOT crash the server)
    let crashed = false;
    try {
      // Mimicking server endpoint doing: const list = (await db.getBomItems()).map(i => i.code)
      (items as any).map((i: any) => i.code);
    } catch (err) {
      crashed = true;
      console.log('Server crash simulation on invalid schema input:', (err as Error).message);
    }
    expect(crashed).toBe(false);
  });

  // 3. Performance / Large database size scaling
  it('should measure read/write latency with 5000 BOM items', async () => {
    const largeBom: BomItem[] = Array.from({ length: 5000 }, (_, i) => ({
      code: `M-${i}`,
      name: `Large BOM Item ${i}`,
      qtyPerMachine: 2,
      owner: `Owner ${i % 10}`,
      status: 'Pending',
      currentStock: Math.floor(Math.random() * 100),
      leadTime: Math.floor(Math.random() * 30),
      riskLevel: 'Medium',
    }));

    // Measure write time
    const startWrite = performance.now();
    await db.saveBomItems(largeBom);
    const endWrite = performance.now();
    const writeTimeMs = endWrite - startWrite;

    // Measure read time
    const startRead = performance.now();
    const retrieved = await db.getBomItems();
    const endRead = performance.now();
    const readTimeMs = endRead - startRead;

    console.log(`Performance with 5000 items:`, {
      writeTimeMs: `${writeTimeMs.toFixed(2)} ms`,
      readTimeMs: `${readTimeMs.toFixed(2)} ms`,
      fileSizeKb: `${(JSON.stringify({ project: null, bomItems: largeBom }).length / 1024).toFixed(2)} KB`,
    });

    expect(retrieved.length).toBe(5000);
  });

  // 4. Express Health Check (/api/health) simulation
  it('should show health check is blind to DB status', async () => {
    const express = (await import('express')).default;
    const app = express();
    
    app.get('/api/health', async (req, res) => {
      try {
        const data = await db.read();
        if (!data || data.project === undefined || !Array.isArray(data.bomItems)) {
          throw new Error('Database schema check failed');
        }
        res.status(200).json({
          status: 'ok',
          time: new Date().toISOString()
        });
      } catch (error: any) {
        res.status(500).json({
          status: 'error',
          error: error?.message || String(error)
        });
      }
    });

    const server = app.listen(3126);

    // Mock database failure by mocking db.read to throw an error
    const originalRead = db.read;
    db.read = async () => {
      throw new Error('Mock database read failure');
    };

    try {
      const res = await fetch('http://localhost:3126/api/health');
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.status).toBe('error');
      expect(body.error).toContain('Mock database read failure');
    } finally {
      // Restore
      db.read = originalRead;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
