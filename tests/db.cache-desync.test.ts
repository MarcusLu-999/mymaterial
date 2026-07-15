import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalDb } from '../server/db';
import fs from 'fs/promises';
import path from 'path';

const DESYNC_DB_PATH = path.resolve(process.cwd(), 'data/desync_db.json');

describe('LocalDb Cache Desynchronization Bug on Write Failure', () => {
  let db: LocalDb;

  beforeEach(async () => {
    db = new LocalDb(DESYNC_DB_PATH);
    await db.clear();
  });

  afterEach(async () => {
    try {
      await fs.unlink(DESYNC_DB_PATH);
    } catch {}
    vi.restoreAllMocks();
  });

  it('should demonstrate cache desync when file write fails', async () => {
    // 1. Initial write is successful
    const initialProject = { projectId: 'PRJ-INIT', costCenter: 'CC-INIT', targetQty: 10 };
    await db.saveProject(initialProject);

    const initialRead = await db.read();
    expect(initialRead.project?.projectId).toBe('PRJ-INIT');

    // 2. Mock fs.writeFile to fail on the next write
    const mockWriteFile = vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Disk Full Sim'));

    // 3. Try to save a new project config
    const newProject = { projectId: 'PRJ-NEW', costCenter: 'CC-NEW', targetQty: 20 };
    let writeThrew = false;
    try {
      await db.saveProject(newProject);
    } catch (err: any) {
      writeThrew = true;
      expect(err.message).toBe('Disk Full Sim');
    }
    expect(writeThrew).toBe(true);

    // 4. Read again. Since the file write failed, the database state ON DISK is still the initial state.
    // However, does the db.read() return the new state from cache?
    const postFailureRead = await db.read();
    
    console.log('Post-failure DB state returned from cache:', postFailureRead.project);

    // If the bug exists, postFailureRead.project will be PRJ-NEW, not PRJ-INIT!
    // Let's verify this empirically.
    expect(postFailureRead.project?.projectId).toBe('PRJ-NEW'); // This shows the bug exists!
    
    // 5. If we clear the cache (or reload the DB file) by creating a new LocalDb instance,
    // we get the actual persistent state which should still be PRJ-INIT.
    const freshDb = new LocalDb(DESYNC_DB_PATH);
    const diskState = await freshDb.read();
    console.log('Actual DB state on disk:', diskState.project);
    expect(diskState.project?.projectId).toBe('PRJ-INIT');
  });
});
