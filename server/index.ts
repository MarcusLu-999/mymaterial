import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes placeholder
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

// Mock MASS stock data
const mockInventory = [
  { code: 'M-001', name: 'MCU Controller board v2', stock: 15, leadTime: 10, owner: '张三' },
  { code: 'M-002', name: '12V Power Adapter', stock: 3, leadTime: 5, owner: '李四' },
  { code: 'M-003', name: 'Aluminium Shell bracket', stock: 0, leadTime: 30, owner: '王五' },
  { code: 'M-004', name: 'M3 mounting screws pack', stock: 200, leadTime: 2, owner: '赵六' }
];

app.get('/api/mass/sync', (req, res) => {
  // Simulating query response from MASS database
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: mockInventory
  });
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
