import express from 'express';
import { getPool, memoryStore, initializeDatabase } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/departments (Public)
router.get('/', async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query('SELECT * FROM departments WHERE is_active = true ORDER BY name ASC');
      return res.json(rows);
    } else {
      const rows = memoryStore.departments.filter(d => d.is_active);
      return res.json(rows);
    }
  } catch (err) {
    console.error('[DEPTS] Error:', err);
    return res.status(500).json({ message: 'Failed to fetch departments' });
  }
});

// GET /api/departments/:id (Public)
router.get('/:id', async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Department not found' });
      return res.json(rows[0]);
    } else {
      const dept = memoryStore.departments.find(d => d.id === id);
      if (!dept) return res.status(404).json({ message: 'Department not found' });
      return res.json(dept);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch department' });
  }
});

// POST /api/departments (ADMIN only)
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Department name is required' });

  const pool = await getPool();

  try {
    if (pool) {
      const [existing] = await pool.query('SELECT id FROM departments WHERE name = ?', [name]);
      if (existing.length > 0) {
        return res.status(400).json({ message: 'Department with this name already exists' });
      }

      const [insert] = await pool.query(
        'INSERT INTO departments (name, description, is_active) VALUES (?, ?, true)',
        [name, description || '']
      );
      const [created] = await pool.query('SELECT * FROM departments WHERE id = ?', [insert.insertId]);
      return res.json(created[0]);
    } else {
      if (memoryStore.departments.some(d => d.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ message: 'Department with this name already exists' });
      }
      const newDept = {
        id: memoryStore.departments.length + 1,
        name,
        description: description || '',
        is_active: true,
      };
      memoryStore.departments.push(newDept);
      return res.json(newDept);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create department' });
  }
});

// PUT /api/departments/:id (ADMIN only)
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const { name, description } = req.body;
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Department not found' });

      await pool.query(
        'UPDATE departments SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
        [name, description, id]
      );
      const [updated] = await pool.query('SELECT * FROM departments WHERE id = ?', [id]);
      return res.json(updated[0]);
    } else {
      const dept = memoryStore.departments.find(d => d.id === id);
      if (!dept) return res.status(404).json({ message: 'Department not found' });
      if (name) dept.name = name;
      if (description !== undefined) dept.description = description;
      return res.json(dept);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update department' });
  }
});

export default router;
