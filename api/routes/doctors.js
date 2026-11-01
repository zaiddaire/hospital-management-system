import express from 'express';
import bcrypt from 'bcryptjs';
import { getPool, memoryStore, initializeDatabase, saveMemoryStore, formatDate } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

function mapDoctor(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id !== undefined ? row.user_id : row.userId,
    username: row.username || '',
    email: row.email || '',
    departmentId: row.department_id !== undefined ? row.department_id : row.departmentId,
    departmentName: row.department_name !== undefined ? row.department_name : (row.departmentName || ''),
    fullName: row.full_name !== undefined ? row.full_name : (row.fullName || ''),
    dateOfBirth: formatDate(row.date_of_birth !== undefined ? row.date_of_birth : row.dateOfBirth),
    gender: row.gender || 'MALE',
    phone: row.phone || '',
    specialization: row.specialization || '',
    qualification: row.qualification || '',
    experienceYears: row.experience_years !== undefined ? row.experience_years : (row.experienceYears || 0),
    consultationFee: Number(row.consultation_fee !== undefined ? row.consultation_fee : (row.consultationFee || 0)),
    availability: row.availability || 'Mon-Fri 9AM-5PM',
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : (row.isActive !== undefined ? Boolean(row.isActive) : true),
  };
}

const DOCTOR_SELECT_SQL = `
  SELECT d.*, u.username, u.email, dep.name as department_name
  FROM doctors d
  JOIN users u ON d.user_id = u.id
  LEFT JOIN departments dep ON d.department_id = dep.id
`;

// GET /api/doctors (Public list of active doctors)
router.get('/', async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${DOCTOR_SELECT_SQL} WHERE d.is_active = true ORDER BY d.id ASC`);
      return res.json(rows.map(mapDoctor));
    } else {
      const rows = memoryStore.doctors
        .filter(d => d.is_active)
        .map(d => {
          const user = memoryStore.users.find(u => Number(u.id) === Number(d.user_id));
          const dept = memoryStore.departments.find(dep => Number(dep.id) === Number(d.department_id));
          return mapDoctor({ ...d, username: user?.username, email: user?.email, department_name: dept?.name });
        });
      return res.json(rows);
    }
  } catch (err) {
    console.error('[DOCTORS] Error:', err);
    return res.status(500).json({ message: 'Failed to fetch doctors' });
  }
});

// GET /api/doctors/search?query=...
router.get('/search', async (req, res) => {
  await initializeDatabase();
  const query = (req.query.query || '').trim().toLowerCase();
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(
        `${DOCTOR_SELECT_SQL} WHERE d.is_active = true AND (LOWER(d.full_name) LIKE ? OR LOWER(d.specialization) LIKE ?)`,
        [`%${query}%`, `%${query}%`]
      );
      return res.json(rows.map(mapDoctor));
    } else {
      const rows = memoryStore.doctors
        .filter(d => d.is_active && (
          (d.full_name || '').toLowerCase().includes(query) ||
          (d.specialization || '').toLowerCase().includes(query)
        ))
        .map(d => {
          const user = memoryStore.users.find(u => Number(u.id) === Number(d.user_id));
          const dept = memoryStore.departments.find(dep => Number(dep.id) === Number(d.department_id));
          return mapDoctor({ ...d, username: user?.username, email: user?.email, department_name: dept?.name });
        });
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to search doctors' });
  }
});

// GET /api/doctors/department/:departmentId
router.get('/department/:departmentId', async (req, res) => {
  await initializeDatabase();
  const departmentId = Number(req.params.departmentId);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${DOCTOR_SELECT_SQL} WHERE d.department_id = ? AND d.is_active = true`, [departmentId]);
      return res.json(rows.map(mapDoctor));
    } else {
      const rows = memoryStore.doctors
        .filter(d => Number(d.department_id) === departmentId && d.is_active)
        .map(d => {
          const user = memoryStore.users.find(u => Number(u.id) === Number(d.user_id));
          const dept = memoryStore.departments.find(dep => Number(dep.id) === Number(d.department_id));
          return mapDoctor({ ...d, username: user?.username, email: user?.email, department_name: dept?.name });
        });
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch doctors by department' });
  }
});

// GET /api/doctors/user/:userId
router.get('/user/:userId', async (req, res) => {
  await initializeDatabase();
  const userId = Number(req.params.userId);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${DOCTOR_SELECT_SQL} WHERE d.user_id = ?`, [userId]);
      if (rows.length === 0) return res.status(404).json({ message: 'Doctor profile not found' });
      return res.json(mapDoctor(rows[0]));
    } else {
      const d = memoryStore.doctors.find(doc => Number(doc.user_id) === userId);
      if (!d) return res.status(404).json({ message: 'Doctor profile not found' });
      const user = memoryStore.users.find(u => Number(u.id) === userId);
      const dept = memoryStore.departments.find(dep => Number(dep.id) === Number(d.department_id));
      return res.json(mapDoctor({ ...d, username: user?.username, email: user?.email, department_name: dept?.name }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch doctor' });
  }
});

// GET /api/doctors/:id
// Fix: Checks both doctor.id and doctor.user_id to prevent any "Doctor not found" bug when switching between IDs
router.get('/:id', async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      let [rows] = await pool.query(`${DOCTOR_SELECT_SQL} WHERE d.id = ?`, [id]);
      if (rows.length === 0) {
        [rows] = await pool.query(`${DOCTOR_SELECT_SQL} WHERE d.user_id = ?`, [id]);
      }
      if (rows.length === 0) return res.status(404).json({ message: 'Doctor not found' });
      return res.json(mapDoctor(rows[0]));
    } else {
      let d = memoryStore.doctors.find(doc => Number(doc.id) === id);
      if (!d) {
        d = memoryStore.doctors.find(doc => Number(doc.user_id) === id);
      }
      if (!d) return res.status(404).json({ message: 'Doctor not found' });
      const user = memoryStore.users.find(u => Number(u.id) === Number(d.user_id));
      const dept = memoryStore.departments.find(dep => Number(dep.id) === Number(d.department_id));
      return res.json(mapDoctor({ ...d, username: user?.username, email: user?.email, department_name: dept?.name }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch doctor' });
  }
});

// POST /api/doctors (ADMIN only)
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const {
    username, email, fullName, departmentId,
    specialization, qualification, experienceYears,
    consultationFee, phone, gender, availability
  } = req.body;

  if (!username || !email || !fullName || !departmentId || !specialization || !phone) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  const pool = await getPool();
  const defaultPassword = 'doctor123';

  try {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    if (pool) {
      const [existing] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
      if (existing.length > 0) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }

      const [uRes] = await pool.query(
        'INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, true)',
        [username, email, passwordHash, 'DOCTOR']
      );
      const userId = uRes.insertId;

      const [dRes] = await pool.query(
        `INSERT INTO doctors (user_id, department_id, full_name, gender, phone, specialization, qualification, experience_years, consultation_fee, availability, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
        [userId, departmentId, fullName, gender || 'MALE', phone, specialization, qualification || '', experienceYears || 0, consultationFee || 500, availability || 'Mon-Fri 9AM-5PM']
      );

      const [created] = await pool.query(`${DOCTOR_SELECT_SQL} WHERE d.id = ?`, [dRes.insertId]);
      return res.status(200).json(mapDoctor(created[0]));
    } else {
      if (memoryStore.users.some(u => u.username === username || u.email === email)) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }

      const userId = memoryStore.users.length + 1;
      memoryStore.users.push({
        id: userId,
        username,
        email,
        password: passwordHash,
        role: 'DOCTOR',
        is_active: true,
      });

      const docId = memoryStore.doctors.length + 1;
      const newDoc = {
        id: docId,
        user_id: userId,
        department_id: Number(departmentId),
        full_name: fullName,
        gender: gender || 'MALE',
        phone,
        specialization,
        qualification: qualification || '',
        experience_years: Number(experienceYears) || 0,
        consultation_fee: Number(consultationFee) || 500,
        availability: availability || 'Mon-Fri 9AM-5PM',
        is_active: true,
      };
      memoryStore.doctors.push(newDoc);
      saveMemoryStore();

      const dept = memoryStore.departments.find(dep => Number(dep.id) === Number(departmentId));
      return res.json(mapDoctor({ ...newDoc, username, email, department_name: dept?.name }));
    }
  } catch (err) {
    console.error('[DOCTORS] Create error:', err);
    return res.status(500).json({ message: 'Failed to create doctor' });
  }
});

// PUT /api/doctors/:id (ADMIN or DOCTOR)
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR'), async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const {
    fullName, departmentId, specialization,
    qualification, experienceYears, consultationFee,
    phone, gender, availability
  } = req.body;

  const pool = await getPool();

  try {
    if (pool) {
      await pool.query(
        `UPDATE doctors SET
          full_name = COALESCE(?, full_name),
          department_id = COALESCE(?, department_id),
          specialization = COALESCE(?, specialization),
          qualification = COALESCE(?, qualification),
          experience_years = COALESCE(?, experience_years),
          consultation_fee = COALESCE(?, consultation_fee),
          phone = COALESCE(?, phone),
          gender = COALESCE(?, gender),
          availability = COALESCE(?, availability)
        WHERE id = ?`,
        [fullName, departmentId, specialization, qualification, experienceYears, consultationFee, phone, gender, availability, id]
      );

      const [updated] = await pool.query(`${DOCTOR_SELECT_SQL} WHERE d.id = ?`, [id]);
      if (updated.length === 0) return res.status(404).json({ message: 'Doctor not found' });
      return res.json(mapDoctor(updated[0]));
    } else {
      let doc = memoryStore.doctors.find(d => Number(d.id) === id);
      if (!doc) {
        doc = memoryStore.doctors.find(d => Number(d.user_id) === id);
      }
      if (!doc) return res.status(404).json({ message: 'Doctor not found' });

      if (fullName) doc.full_name = fullName;
      if (departmentId) doc.department_id = Number(departmentId);
      if (specialization) doc.specialization = specialization;
      if (qualification) doc.qualification = qualification;
      if (experienceYears !== undefined) doc.experience_years = Number(experienceYears);
      if (consultationFee !== undefined) doc.consultation_fee = Number(consultationFee);
      if (phone) doc.phone = phone;
      if (gender) doc.gender = gender;
      if (availability) doc.availability = availability;

      saveMemoryStore();

      const user = memoryStore.users.find(u => Number(u.id) === Number(doc.user_id));
      const dept = memoryStore.departments.find(dep => Number(dep.id) === Number(doc.department_id));
      return res.json(mapDoctor({ ...doc, username: user?.username, email: user?.email, department_name: dept?.name }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update doctor' });
  }
});

// DELETE /api/doctors/:id (ADMIN only)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      await pool.query('UPDATE doctors SET is_active = false WHERE id = ?', [id]);
      return res.status(204).send();
    } else {
      const doc = memoryStore.doctors.find(d => Number(d.id) === id);
      if (doc) {
        doc.is_active = false;
        saveMemoryStore();
      }
      return res.status(204).send();
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete doctor' });
  }
});

export default router;
