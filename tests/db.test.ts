import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalDb, ProjectConfig, BomItem } from '../server/db';
import fs from 'fs/promises';
import path from 'path';

const TEST_DB_PATH = path.resolve(process.cwd(), 'data/test_db.json');

describe('Local JSON Database (LocalDb)', () => {
  let testDb: LocalDb;

  beforeEach(async () => {
    testDb = new LocalDb(TEST_DB_PATH);
    await testDb.clear();
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_DB_PATH);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should initialize with default structure', async () => {
    const data = await testDb.read();
    expect(data.project).toBeNull();
    expect(data.bomItems).toEqual([]);
  });

  it('should save and retrieve project configuration', async () => {
    const projectConfig: ProjectConfig = {
      projectId: 'PRJ-2026-TEST',
      costCenter: 'CC-TEST-01',
      targetQty: 10,
    };

    await testDb.saveProject(projectConfig);
    const savedProject = await testDb.getProject();
    expect(savedProject).toEqual(projectConfig);
  });

  it('should save and retrieve BOM items', async () => {
    const bomItems: BomItem[] = [
      {
        code: 'M-001',
        name: 'Test Item 1',
        qtyPerMachine: 2,
        owner: 'Alice',
        status: 'Pending',
        currentStock: 5,
        leadTime: 5,
        riskLevel: 'Low',
      },
      {
        code: 'M-002',
        name: 'Test Item 2',
        qtyPerMachine: 1,
        owner: 'Bob',
        status: 'OA Submitted',
        currentStock: 0,
        leadTime: 20,
        riskLevel: 'High',
      },
    ];

    await testDb.saveBomItems(bomItems);
    const savedItems = await testDb.getBomItems();
    expect(savedItems).toEqual(bomItems);
  });

  it('should clear data back to default values', async () => {
    const projectConfig: ProjectConfig = {
      projectId: 'PRJ-2026-TEST',
      costCenter: 'CC-TEST-01',
      targetQty: 10,
    };

    await testDb.saveProject(projectConfig);
    await testDb.clear();

    const savedProject = await testDb.getProject();
    expect(savedProject).toBeNull();
  });
});
