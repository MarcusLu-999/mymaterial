import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { parseBomText } from './bomParser.js';
import { calculateRequiredQty, calculateShortage, calculateEstimatedBuildable } from './calcEngine.js';
import { calculateRiskLevel } from './riskEvaluator.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mock MASS stock data
const mockInventory = [
  { code: 'M-001', name: 'MCU Controller board v2', stock: 15, leadTime: 10, owner: '张三' },
  { code: 'M-002', name: '12V Power Adapter', stock: 3, leadTime: 5, owner: '李四' },
  { code: 'M-003', name: 'Aluminium Shell bracket', stock: 0, leadTime: 30, owner: '王五' },
  { code: 'M-004', name: 'M3 mounting screws pack', stock: 200, leadTime: 2, owner: '赵六' }
];

// Health Check API
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

// GET /api/project
app.get('/api/project', async (req, res) => {
  try {
    const project = await db.getProject();
    const bomItems = await db.getBomItems();
    const targetQty = project ? project.targetQty : 0;

    let coveredCount = 0;
    let shortageCount = 0;

    const itemsForBuildable = bomItems.map(item => {
      const requiredQty = calculateRequiredQty(targetQty, item.qtyPerMachine);
      const shortage = calculateShortage(requiredQty, item.currentStock);
      if (shortage === 0) {
        coveredCount++;
      } else {
        shortageCount++;
      }
      return {
        currentStock: item.currentStock,
        qtyPerMachine: item.qtyPerMachine
      };
    });

    const bomCoverage = bomItems.length > 0 ? coveredCount / bomItems.length : 0;
    const estimatedBuildable = calculateEstimatedBuildable(itemsForBuildable, targetQty);

    res.json({
      project,
      bomItems,
      bomCoverage,
      estimatedBuildable,
      buildableMachines: estimatedBuildable,
      shortageCount,
      shortageItemsCount: shortageCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

// POST /api/project/setup
app.post('/api/project/setup', async (req, res) => {
  try {
    const { projectId, costCenter, targetQty: rawTargetQty, bomText, deadline } = req.body;
    if (!projectId || projectId.trim() === '') {
      return res.status(400).json({ error: 'Project ID cannot be empty' });
    }
    const targetQtyNum = Number(rawTargetQty);
    if (isNaN(targetQtyNum) || targetQtyNum <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }
    const targetQty = Math.floor(targetQtyNum);

    const project = {
      projectId,
      costCenter: costCenter || '',
      targetQty,
      deadline
    };

    await db.saveProject(project);

    let bomItems: any[] = [];
    if (bomText && bomText.trim() !== '') {
      const parsedItems = parseBomText(bomText);
      bomItems = parsedItems.map(item => {
        const currentStock = 0;
        const leadTime = 0;
        const status = 'Pending';
        const requiredQty = calculateRequiredQty(targetQty, item.qtyPerMachine);
        const shortage = calculateShortage(requiredQty, currentStock);
        const riskLevel = calculateRiskLevel(shortage, leadTime, undefined, deadline);

        return {
          code: item.code,
          name: item.name,
          qtyPerMachine: item.qtyPerMachine,
          owner: item.owner,
          status,
          currentStock,
          leadTime,
          riskLevel
        };
      });
      await db.saveBomItems(bomItems);
    }

    res.json({ success: true, project, data: bomItems });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

// POST /api/project/bom
app.post('/api/project/bom', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }
    const project = await db.getProject();
    const targetQty = project ? project.targetQty : 0;
    const deadline = project?.deadline;

    const bomItems = items.map((it: any) => {
      const code = it.code || it.partNumber || '';
      const name = it.name || '';
      const qtyPerMachine = Number(it.qtyPerMachine) || 0;
      const owner = it.owner || '';
      const currentStock = it.currentStock !== undefined ? Number(it.currentStock) : 0;
      const leadTime = it.leadTime !== undefined ? Number(it.leadTime) : 0;
      const status = it.status || 'Pending';

      const requiredQty = calculateRequiredQty(targetQty, qtyPerMachine);
      const shortage = calculateShortage(requiredQty, currentStock);
      const riskLevel = calculateRiskLevel(shortage, leadTime, it.shippingDate, deadline);

      return {
        code,
        name,
        qtyPerMachine,
        owner,
        status,
        currentStock,
        leadTime,
        riskLevel,
        shippingDate: it.shippingDate
      };
    });

    await db.saveBomItems(bomItems);
    res.json({ success: true, count: bomItems.length });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

// GET /api/mass/sync
app.get('/api/mass/sync', async (req, res) => {
  try {
    if ((globalThis as any).forceSyncTimeout) {
      return res.status(504).json({ error: 'Sync failed: Timeout' });
    }
    if ((globalThis as any).forceSyncMalformed) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('malformed json string');
    }

    const project = await db.getProject();
    const targetQty = project ? project.targetQty : 0;
    const deadline = project?.deadline;
    const bomItems = await db.getBomItems();

    const massInventory = (globalThis as any).mockMassDb || mockInventory;

    const updatedBomItems = bomItems.map((item: any) => {
      const massItem = massInventory.find((m: any) => m.code === item.code);
      if (massItem) {
        let stock = massItem.stock !== undefined ? massItem.stock : massItem.stockLevel;
        if (stock === undefined && massItem.currentStock !== undefined) {
          stock = massItem.currentStock;
        }
        if (stock === null || stock === undefined) {
          stock = 0;
        }
        if (stock < 0) {
          stock = 0;
        }

        item.currentStock = stock;
        item.leadTime = (massItem.leadTime !== undefined && massItem.leadTime !== null) ? massItem.leadTime : item.leadTime;
        if (massItem.owner) {
          item.owner = massItem.owner;
        }
        if (massItem.shippingDate !== undefined) {
          item.shippingDate = massItem.shippingDate;
        }
        delete item.warning;
      } else {
        item.currentStock = 0;
        item.warning = 'Not found in MASS';
      }

      // Recalculate shortage and risk level
      const requiredQty = calculateRequiredQty(targetQty, item.qtyPerMachine);
      const shortage = calculateShortage(requiredQty, item.currentStock);
      item.riskLevel = calculateRiskLevel(shortage, item.leadTime, item.shippingDate, deadline);

      return item;
    });

    await db.saveBomItems(updatedBomItems);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: updatedBomItems
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

// POST /api/purchase/export
app.post('/api/purchase/export', async (req, res) => {
  try {
    if ((globalThis as any).forceExportPermissionError) {
      return res.status(403).json({ error: 'Export failed: Permission denied' });
    }
    if ((globalThis as any).forceExportTxFailure) {
      return res.status(500).json({ error: 'Database transaction failed' });
    }

    const project = await db.getProject();
    if (!project) {
      return res.status(400).json({ error: 'No project setup found' });
    }

    const bomItems = await db.getBomItems();
    const targetQty = project.targetQty;

    // Filter items with shortage > 0 AND status is Pending
    const exportItems = bomItems.filter(item => {
      const requiredQty = calculateRequiredQty(targetQty, item.qtyPerMachine);
      const shortage = calculateShortage(requiredQty, item.currentStock);
      return shortage > 0 && item.status === 'Pending';
    });

    if (exportItems.length === 0 && (globalThis as any).forceExportZeroShortageError) {
      return res.status(400).json({ error: 'No shortages found for export' });
    }

    let csvContent = '物料号,数量,负责人,成本中心,项目号\n';
    exportItems.forEach(item => {
      const requiredQty = calculateRequiredQty(targetQty, item.qtyPerMachine);
      const shortage = calculateShortage(requiredQty, item.currentStock);
      csvContent += `${item.code},${shortage},${item.owner},${project.costCenter},${project.projectId}\n`;
    });

    // Update status to 'OA Submitted' and save
    const updatedBomItems = bomItems.map(item => {
      const isExported = exportItems.some(exp => exp.code === item.code);
      if (isExported) {
        item.status = 'OA Submitted';
      }
      return item;
    });

    await db.saveBomItems(updatedBomItems);

    // Log the export action
    await db.addLog('export');

    const projectIdSanitized = project.projectId ? project.projectId.replace(/[\/\\*?:"<>|]/g, '_') : 'project';
    const filename = `${projectIdSanitized}_purchase.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});


// Server static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
