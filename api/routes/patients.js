import express from 'express';
import { getPool, memoryStore, initializeDatabase } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

function mapPatient(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth).split('T')[0] : null,
    gender: row.gender,
    bloodGroup: row.blood_group,
    phone: row.phone,
    address: row.address,
    emergencyContact: row.emergency_contact,
  };
}

const PATIENT_SELECT_SQL = `
  SELECT p.*, u.username, u.email
  FROM patients p
  JOIN users u ON p.user_id = u.id
`;

// GET /api/patients (ADMIN or DOCTOR)
router.get('/', authenticate, authorize('ADMIN', 'DOCTOR'), async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${PATIENT_SELECT_SQL} ORDER BY p.id ASC`);
      return res.json(rows.map(mapPatient));
    } else {
      const rows = memoryStore.patients.map(p => {
        const u = memoryStore.users.find(user => user.id === p.user_id);
        return mapPatient({ ...p, username: u?.username, email: u?.email });
      });
      return res.json(rows);
    }
  } catch (err) {
    console.error('[PATIENTS] Error:', err);
    return res.status(500).json({ message: 'Failed to fetch patients' });
  }
});

// GET /api/patients/search?name=... (ADMIN or DOCTOR)
router.get('/search', authenticate, authorize('ADMIN', 'DOCTOR'), async (req, res) => {
  await initializeDatabase();
  const name = (req.query.name || '').trim().toLowerCase();
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(
        `${PATIENT_SELECT_SQL} WHERE LOWER(p.full_name) LIKE ? OR LOWER(u.username) LIKE ?`,
        [`%${name}%`, `%${name}%`]
      );
      return res.json(rows.map(mapPatient));
    } else {
      const rows = memoryStore.patients
        .filter(p => p.full_name.toLowerCase().includes(name))
        .map(p => {
          const u = memoryStore.users.find(user => user.id === p.user_id);
          return mapPatient({ ...p, username: u?.username, email: u?.email });
        });
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to search patients' });
  }
});

// GET /api/patients/user/:userId
router.get('/user/:userId', authenticate, async (req, res) => {
  await initializeDatabase();
  const userId = Number(req.params.userId);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${PATIENT_SELECT_SQL} WHERE p.user_id = ?`, [userId]);
      if (rows.length === 0) return res.status(404).json({ message: 'Patient profile not found' });
      return res.json(mapPatient(rows[0]));
    } else {
      const p = memoryStore.patients.find(pat => pat.user_id === userId);
      if (!p) return res.status(404).json({ message: 'Patient profile not found' });
      const u = memoryStore.users.find(user => user.id === p.user_id);
      return res.json(mapPatient({ ...p, username: u?.username, email: u?.email }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch patient' });
  }
});

// GET /api/patients/:id
router.get('/:id', authenticate, async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${PATIENT_SELECT_SQL} WHERE p.id = ?`, [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Patient not found' });
      return res.json(mapPatient(rows[0]));
    } else {
      const p = memoryStore.patients.find(pat => pat.id === id);
      if (!p) return res.status(404).json({ message: 'Patient not found' });
      const u = memoryStore.users.find(user => user.id === p.user_id);
      return res.json(mapPatient({ ...p, username: u?.username, email: u?.email }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch patient' });
  }
});

// PUT /api/patients/:id
router.put('/:id', authenticate, async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const { fullName, phone, dateOfBirth, gender, bloodGroup, address, emergencyContact } = req.body;
  const pool = await getPool();

  try {
    if (pool) {
      await pool.query(
        `UPDATE patients SET
          full_name = COALESCE(?, full_name),
          phone = COALESCE(?, phone),
          date_of_birth = COALESCE(?, date_of_birth),
          gender = COALESCE(?, gender),
          blood_group = COALESCE(?, blood_group),
          address = COALESCE(?, address),
          emergency_contact = COALESCE(?, emergency_contact)
        WHERE id = ?`,
        [fullName, phone, dateOfBirth, gender, bloodGroup, address, emergencyContact, id]
      );

      const [updated] = await pool.query(`${PATIENT_SELECT_SQL} WHERE p.id = ?`, [id]);
      if (updated.length === 0) return res.status(404).json({ message: 'Patient not found' });
      return res.json(mapPatient(updated[0]));
    } else {
      const p = memoryStore.patients.find(pat => pat.id === id);
      if (!p) return res.status(404).json({ message: 'Patient not found' });

      if (fullName) p.full_name = fullName;
      if (phone) p.phone = phone;
      if (dateOfBirth) p.date_of_birth = dateOfBirth;
      if (gender) p.gender = gender;
      if (bloodGroup) p.blood_group = bloodGroup;
      if (address !== undefined) p.address = address;
      if (emergencyContact !== undefined) p.emergency_contact = emergencyContact;

      const u = memoryStore.users.find(user => user.id === p.user_id);
      return res.json(mapPatient({ ...p, username: u?.username, email: u?.email }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update patient profile' });
  }
});

export default router;
