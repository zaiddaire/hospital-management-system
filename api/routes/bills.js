import express from 'express';
import { getPool, memoryStore, initializeDatabase, saveMemoryStore, formatDate } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

function mapBill(row) {
  return {
    id: row.id,
    billNumber: row.bill_number,
    patientId: row.patient_id,
    patientName: row.patient_name || '',
    appointmentId: row.appointment_id || null,
    description: row.description || '',
    amount: Number(row.amount) || 0,
    billDate: formatDate(row.bill_date),
    paymentStatus: row.payment_status || 'PENDING',
  };
}

const BILL_SELECT_SQL = `
  SELECT b.*, p.full_name as patient_name
  FROM bills b
  JOIN patients p ON b.patient_id = p.id
`;

// GET /api/bills (ADMIN: all, PATIENT: their own)
router.get('/', authenticate, async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();
  const user = req.user;

  try {
    if (pool) {
      if (user.role === 'ADMIN') {
        const [rows] = await pool.query(`${BILL_SELECT_SQL} ORDER BY b.bill_date DESC, b.id DESC`);
        return res.json(rows.map(mapBill));
      } else if (user.role === 'PATIENT') {
        const [pats] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [user.userId]);
        const patientId = pats.length > 0 ? pats[0].id : 0;
        const [rows] = await pool.query(`${BILL_SELECT_SQL} WHERE b.patient_id = ? ORDER BY b.bill_date DESC`, [patientId]);
        return res.json(rows.map(mapBill));
      } else if (user.role === 'DOCTOR') {
        // Doctors don't manage bills directly; return empty
        return res.json([]);
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      let filteredBills = memoryStore.bills;
      if (user.role === 'PATIENT') {
        const pat = memoryStore.patients.find(p => p.user_id === user.userId);
        filteredBills = filteredBills.filter(b => b.patient_id === (pat ? pat.id : 0));
      } else if (user.role === 'DOCTOR') {
        filteredBills = [];
      } else if (user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Access denied' });
      }
      const rows = filteredBills.map(b => {
        const p = memoryStore.patients.find(pat => pat.id === b.patient_id);
        return mapBill({ ...b, patient_name: p?.full_name });
      });
      return res.json(rows);
    }
  } catch (err) {
    console.error('[BILLS] Error:', err);
    return res.status(500).json({ message: 'Failed to fetch bills' });
  }
});


// GET /api/bills/patient/:patientId
router.get('/patient/:patientId', authenticate, async (req, res) => {
  await initializeDatabase();
  const patientId = Number(req.params.patientId);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${BILL_SELECT_SQL} WHERE b.patient_id = ? ORDER BY b.bill_date DESC`, [patientId]);
      return res.json(rows.map(mapBill));
    } else {
      const rows = memoryStore.bills
        .filter(b => b.patient_id === patientId)
        .map(b => {
          const p = memoryStore.patients.find(pat => pat.id === b.patient_id);
          return mapBill({ ...b, patient_name: p?.full_name });
        });
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch patient bills' });
  }
});

// GET /api/bills/:id
router.get('/:id', authenticate, async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${BILL_SELECT_SQL} WHERE b.id = ?`, [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Bill not found' });
      return res.json(mapBill(rows[0]));
    } else {
      const b = memoryStore.bills.find(bill => bill.id === id);
      if (!b) return res.status(404).json({ message: 'Bill not found' });
      const p = memoryStore.patients.find(pat => pat.id === b.patient_id);
      return res.json(mapBill({ ...b, patient_name: p?.full_name }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch bill' });
  }
});

// POST /api/bills (ADMIN or DOCTOR)
router.post('/', authenticate, authorize('ADMIN', 'DOCTOR'), async (req, res) => {
  await initializeDatabase();
  const { patientId, appointmentId, description, amount } = req.body;

  if (!patientId || amount === undefined || amount === null) {
    return res.status(400).json({ message: 'Patient and Amount are required' });
  }

  const pool = await getPool();
  const today = new Date().toISOString().split('T')[0];
  const billNumber = 'BILL-' + Math.floor(1000 + Math.random() * 9000);

  try {
    if (pool) {
      const [insert] = await pool.query(
        `INSERT INTO bills (bill_number, patient_id, appointment_id, description, amount, bill_date, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
        [billNumber, patientId, appointmentId || null, description || 'Hospital Service Charge', amount, today]
      );

      const [created] = await pool.query(`${BILL_SELECT_SQL} WHERE b.id = ?`, [insert.insertId]);
      return res.status(200).json(mapBill(created[0]));
    } else {
      const newBill = {
        id: memoryStore.bills.length + 1,
        bill_number: billNumber,
        patient_id: Number(patientId),
        appointment_id: appointmentId ? Number(appointmentId) : null,
        description: description || 'Hospital Service Charge',
        amount: Number(amount),
        bill_date: today,
        payment_status: 'PENDING',
      };
      memoryStore.bills.push(newBill);
      saveMemoryStore();

      const p = memoryStore.patients.find(pat => pat.id === Number(patientId));
      return res.json(mapBill({ ...newBill, patient_name: p?.full_name }));
    }
  } catch (err) {
    console.error('[BILLS] Create error:', err);
    return res.status(500).json({ message: 'Failed to create bill' });
  }
});

// PATCH /api/bills/:id/payment (ADMIN only)
router.patch('/:id/payment', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!status) return res.status(400).json({ message: 'Payment status is required' });

  const pool = await getPool();

  try {
    if (pool) {
      await pool.query('UPDATE bills SET payment_status = ? WHERE id = ?', [status, id]);
      const [updated] = await pool.query(`${BILL_SELECT_SQL} WHERE b.id = ?`, [id]);
      if (updated.length === 0) return res.status(404).json({ message: 'Bill not found' });
      return res.json(mapBill(updated[0]));
    } else {
      const b = memoryStore.bills.find(bill => bill.id === id);
      if (!b) return res.status(404).json({ message: 'Bill not found' });
      b.payment_status = status;
      saveMemoryStore();
      const p = memoryStore.patients.find(pat => pat.id === b.patient_id);
      return res.json(mapBill({ ...b, patient_name: p?.full_name }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update bill payment status' });
  }
});

export default router;
