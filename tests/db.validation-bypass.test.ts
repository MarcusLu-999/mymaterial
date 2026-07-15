import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalDb } from '../server/db';
import fs from 'fs/promises';
import path from 'path';

const VALIDATION_DB_PATH = path.resolve(process.cwd(), 'data/validation_db.json');

describe('LocalDb Write Validation Bypass Bug', () => {
  let db: LocalDb;

  beforeEach(async () => {
    db = new LocalDb(VALIDATION_DB_PATH);
    await db.clear();
  });

  afterEach(async () => {
    try {
      await fs.unlink(VALIDATION_DB_PATH);
    } catch {}
  });

  it('should verify that invalid written data bypasses validation and is returned from cache', async () => {
    // 1. Construct invalid data matching the DbSchema type but with incorrect fields (using as any)
    const invalidData = {
      project: {
        projectId: 12345, // should be string
        costCenter: 'CC',
        targetQty: 'not a number' // should be number
      },
      bomItems: [
        {
          code: 'M-001',
          name: 'Invalid Status Item',
          qtyPerMachine: 1,
          owner: 'Owner',
          status: 'InvalidStatus', // should be 'Pending' | 'OA Submitted'
          currentStock: 0,
          leadTime: 5,
          riskLevel: 'Low'
        }
      ]
    } as any;

    // 2. Write invalid data
    await db.write(invalidData);

    // 3. Read it back immediately (should hit cache)
    const read1 = await db.read();
    
    console.log('Read immediately after write (hitting cache):', read1);
    
    // Check if the read data is still invalid (i.e. validation was bypassed)
    expect(typeof read1.project?.projectId).toBe('number'); // Bypassed validation!
    expect(typeof read1.project?.targetQty).toBe('string'); // Bypassed validation!
    expect(read1.bomItems[0].status).toBe('InvalidStatus'); // Bypassed validation!

    // 4. Reset cache by initializing a new LocalDb instance (forcing read from file and validation)
    const freshDb = new LocalDb(VALIDATION_DB_PATH);
    const read2 = await freshDb.read();

    console.log('Read from file after cache clear:', read2);

    // Check if validation filter applied when reading from file
    expect(read2.project).toBeNull(); // Project should be filtered out
    expect(read2.bomItems.length).toBe(0); // BOM item should be filtered out due to invalid status
  });
});
