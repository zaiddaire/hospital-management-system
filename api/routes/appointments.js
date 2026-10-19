import express from 'express';
import { getPool, memoryStore, initializeDatabase } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

function mapAppointment(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name || '',
    doctorId: row.doctor_id,
    doctorName: row.doctor_name || '',
    departmentName: row.department_name || '',
    appointmentDate: row.appointment_date ? String(row.appointment_date).split('T')[0] : null,
    appointmentTime: row.appointment_time || '',
    reason: row.reason || '',
    status: row.status || 'PENDING',
  };
}

const APPT_SELECT_SQL = `
  SELECT a.*, p.full_name as patient_name, d.full_name as doctor_name, dep.name as department_name
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  JOIN doctors d ON a.doctor_id = d.id
  LEFT JOIN departments dep ON d.department_id = dep.id
`;

// GET /api/appointments (ADMIN only)
router.get('/', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${APPT_SELECT_SQL} ORDER BY a.appointment_date DESC, a.appointment_time DESC`);
      return res.json(rows.map(mapAppointment));
    } else {
      const rows = memoryStore.appointments.map(a => {
        const p = memoryStore.patients.find(pat => pat.id === a.patient_id);
        const d = memoryStore.doctors.find(doc => doc.id === a.doctor_id);
        const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
        return mapAppointment({ ...a, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name });
      });
      return res.json(rows);
    }
  } catch (err) {
    console.error('[APPOINTMENTS] Error:', err);
    return res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/doctor/:doctorId
router.get('/doctor/:doctorId', authenticate, async (req, res) => {
  await initializeDatabase();
  const doctorId = Number(req.params.doctorId);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${APPT_SELECT_SQL} WHERE a.doctor_id = ? ORDER BY a.appointment_date DESC`, [doctorId]);
      return res.json(rows.map(mapAppointment));
    } else {
      const rows = memoryStore.appointments
        .filter(a => a.doctor_id === doctorId)
        .map(a => {
          const p = memoryStore.patients.find(pat => pat.id === a.patient_id);
          const d = memoryStore.doctors.find(doc => doc.id === a.doctor_id);
          const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
          return mapAppointment({ ...a, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name });
        });
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch doctor appointments' });
  }
});

// GET /api/appointments/patient/:patientId
router.get('/patient/:patientId', authenticate, async (req, res) => {
  await initializeDatabase();
  const patientId = Number(req.params.patientId);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${APPT_SELECT_SQL} WHERE a.patient_id = ? ORDER BY a.appointment_date DESC`, [patientId]);
      return res.json(rows.map(mapAppointment));
    } else {
      const rows = memoryStore.appointments
        .filter(a => a.patient_id === patientId)
        .map(a => {
          const p = memoryStore.patients.find(pat => pat.id === a.patient_id);
          const d = memoryStore.doctors.find(doc => doc.id === a.doctor_id);
          const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
          return mapAppointment({ ...a, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name });
        });
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch patient appointments' });
  }
});

// GET /api/appointments/:id
router.get('/:id', authenticate, async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${APPT_SELECT_SQL} WHERE a.id = ?`, [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Appointment not found' });
      return res.json(mapAppointment(rows[0]));
    } else {
      const a = memoryStore.appointments.find(appt => appt.id === id);
      if (!a) return res.status(404).json({ message: 'Appointment not found' });
      const p = memoryStore.patients.find(pat => pat.id === a.patient_id);
      const d = memoryStore.doctors.find(doc => doc.id === a.doctor_id);
      const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
      return res.json(mapAppointment({ ...a, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch appointment' });
  }
});

// POST /api/appointments (Book appointment)
router.post('/', authenticate, async (req, res) => {
  await initializeDatabase();
  const { patientId, doctorId, appointmentDate, appointmentTime, reason } = req.body;

  if (!patientId || !doctorId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ message: 'Patient, Doctor, Date, and Time are required' });
  }

  // Format time as HH:mm:ss
  let formattedTime = appointmentTime;
  if (formattedTime.length === 5) formattedTime += ':00';

  const pool = await getPool();

  try {
    if (pool) {
      // Check for slot conflict on doctor
      const [existing] = await pool.query(
        `SELECT id FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'CANCELLED'`,
        [doctorId, appointmentDate, formattedTime]
      );

      if (existing.length > 0) {
        return res.status(400).json({ message: 'This time slot is already booked for the selected doctor.' });
      }

      const [insert] = await pool.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
         VALUES (?, ?, ?, ?, ?, 'PENDING')`,
        [patientId, doctorId, appointmentDate, formattedTime, reason || '']
      );

      const [created] = await pool.query(`${APPT_SELECT_SQL} WHERE a.id = ?`, [insert.insertId]);
      return res.status(200).json(mapAppointment(created[0]));
    } else {
      const slotConflict = memoryStore.appointments.some(
        a => a.doctor_id === Number(doctorId) &&
             a.appointment_date === appointmentDate &&
             a.appointment_time === formattedTime &&
             a.status !== 'CANCELLED'
      );
      if (slotConflict) {
        return res.status(400).json({ message: 'This time slot is already booked for the selected doctor.' });
      }

      const newId = memoryStore.appointments.length + 1;
      const newAppt = {
        id: newId,
        patient_id: Number(patientId),
        doctor_id: Number(doctorId),
        appointment_date: appointmentDate,
        appointment_time: formattedTime,
        reason: reason || '',
        status: 'PENDING',
      };
      memoryStore.appointments.push(newAppt);

      const p = memoryStore.patients.find(pat => pat.id === Number(patientId));
      const d = memoryStore.doctors.find(doc => doc.id === Number(doctorId));
      const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
      return res.json(mapAppointment({ ...newAppt, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name }));
    }
  } catch (err) {
    console.error('[APPOINTMENTS] Booking error:', err);
    return res.status(500).json({ message: 'Failed to book appointment' });
  }
});

// PATCH /api/appointments/:id/status (ADMIN or DOCTOR)
router.patch('/:id/status', authenticate, authorize('ADMIN', 'DOCTOR'), async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!status) return res.status(400).json({ message: 'Status is required' });

  const pool = await getPool();

  try {
    if (pool) {
      await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
      const [updated] = await pool.query(`${APPT_SELECT_SQL} WHERE a.id = ?`, [id]);
      if (updated.length === 0) return res.status(404).json({ message: 'Appointment not found' });
      return res.json(mapAppointment(updated[0]));
    } else {
      const a = memoryStore.appointments.find(appt => appt.id === id);
      if (!a) return res.status(404).json({ message: 'Appointment not found' });
      a.status = status;

      const p = memoryStore.patients.find(pat => pat.id === a.patient_id);
      const d = memoryStore.doctors.find(doc => doc.id === a.doctor_id);
      const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
      return res.json(mapAppointment({ ...a, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name }));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update appointment status' });
  }
});

// DELETE /api/appointments/:id (Cancel)
router.delete('/:id', authenticate, async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      await pool.query("UPDATE appointments SET status = 'CANCELLED' WHERE id = ?", [id]);
      return res.status(204).send();
    } else {
      const a = memoryStore.appointments.find(appt => appt.id === id);
      if (a) a.status = 'CANCELLED';
      return res.status(204).send();
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to cancel appointment' });
  }
});

export default router;
