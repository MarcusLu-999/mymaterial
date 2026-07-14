import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store database in data/db.json relative to the project root.
const DB_FILE_PATH = path.resolve(process.cwd(), 'data/db.json');

export interface ProjectConfig {
  projectId: string;
  costCenter: string;
  targetQty: number;
}

export interface BomItem {
  code: string;          // 物料号
  name: string;          // 物料名称
  qtyPerMachine: number; // 单机用量
  owner: string;         // 负责人
  status: 'Pending' | 'OA Submitted';
  currentStock: number;
  leadTime: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface DbSchema {
  project: ProjectConfig | null;
  bomItems: BomItem[];
}

const DEFAULT_DB: DbSchema = {
  project: null,
  bomItems: [],
};

export function createDefaultDb(): DbSchema {
  return deepClone(DEFAULT_DB);
}

// Deep clone helper
function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export class LocalDb {
  private filePath: string;
  private cache: DbSchema | null = null;
  private queue: Promise<any> = Promise.resolve();

  constructor(filePath: string = DB_FILE_PATH) {
    this.filePath = filePath;
  }

  private async runQueued<T>(operation: () => Promise<T>): Promise<T> {
    const nextPromise = this.queue.then(async () => {
      return operation();
    });
    this.queue = nextPromise.catch(() => {});
    return nextPromise;
  }

  /**
   * Initializes the database file if it does not exist.
   */
  async init(): Promise<void> {
    return this.runQueued(() => this.initInternal());
  }

  private async initInternal(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      try {
        await fs.access(this.filePath);
      } catch {
        // File does not exist, write the default structure
        await this.writeInternal(createDefaultDb());
      }
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Reads all data from the database.
   */
  async read(): Promise<DbSchema> {
    return this.runQueued(() => this.readInternal());
  }

  private async readInternal(): Promise<DbSchema> {
    if (this.cache !== null) {
      return deepClone(this.cache);
    }

    await this.initInternal();
    let content: string;
    try {
      content = await fs.readFile(this.filePath, 'utf-8');
    } catch (error) {
      console.error('Failed to read database file:', error);
      throw error;
    }

    let data: any;
    if (!content || !content.trim()) {
      data = createDefaultDb();
    } else {
      try {
        data = JSON.parse(content);
      } catch (error) {
        console.error('Failed to parse database JSON, falling back to default:', error);
        data = createDefaultDb();
      }
    }

    // Add schema validation and default fallback values to ensure parsed JSON always returns valid properties: 'project' as ProjectConfig | null, and 'bomItems' as BomItem[].
    if (!data || typeof data !== 'object') {
      data = createDefaultDb();
    }
    if (data.project === undefined) {
      data.project = null;
    } else if (data.project !== null) {
      if (
        typeof data.project !== 'object' ||
        typeof data.project.projectId !== 'string' ||
        typeof data.project.costCenter !== 'string' ||
        typeof data.project.targetQty !== 'number'
      ) {
        data.project = null;
      }
    }

    if (!Array.isArray(data.bomItems)) {
      data.bomItems = [];
    } else {
      data.bomItems = data.bomItems.filter((item: any) => {
        return (
          item &&
          typeof item === 'object' &&
          typeof item.code === 'string' &&
          typeof item.name === 'string' &&
          typeof item.qtyPerMachine === 'number' &&
          typeof item.owner === 'string' &&
          (item.status === 'Pending' || item.status === 'OA Submitted') &&
          typeof item.currentStock === 'number' &&
          typeof item.leadTime === 'number' &&
          (item.riskLevel === 'Low' || item.riskLevel === 'Medium' || item.riskLevel === 'High')
        );
      });
    }

    const validatedData = data as DbSchema;
    this.cache = deepClone(validatedData);
    return deepClone(validatedData);
  }

  /**
   * Writes data to the database.
   */
  async write(data: DbSchema): Promise<void> {
    return this.runQueued(() => this.writeInternal(data));
  }

  private async writeInternal(data: DbSchema): Promise<void> {
    try {
      this.cache = deepClone(data);
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      console.error('Failed to write database:', error);
      throw error;
    }
  }

  /**
   * Gets the current project configuration.
   */
  async getProject(): Promise<ProjectConfig | null> {
    return this.runQueued(async () => {
      const data = await this.readInternal();
      return data.project;
    });
  }

  /**
   * Saves the project configuration.
   */
  async saveProject(project: ProjectConfig): Promise<void> {
    return this.runQueued(async () => {
      const data = await this.readInternal();
      data.project = project;
      await this.writeInternal(data);
    });
  }

  /**
   * Gets all BOM items.
   */
  async getBomItems(): Promise<BomItem[]> {
    return this.runQueued(async () => {
      const data = await this.readInternal();
      return data.bomItems;
    });
  }

  /**
   * Saves BOM items.
   */
  async saveBomItems(bomItems: BomItem[]): Promise<void> {
    return this.runQueued(async () => {
      const data = await this.readInternal();
      data.bomItems = bomItems;
      await this.writeInternal(data);
    });
  }

  /**
   * Clears the entire database (resets to defaults).
   */
  async clear(): Promise<void> {
    return this.runQueued(async () => {
      this.cache = null;
      await this.writeInternal(createDefaultDb());
    });
  }
}

// Export a default instance for convenience
export const db = new LocalDb();
