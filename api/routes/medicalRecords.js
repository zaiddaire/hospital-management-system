import express from 'express';
import { getPool, memoryStore, initializeDatabase } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

function mapRecord(rec, prescriptions = []) {
  return {
    id: rec.id,
    patientId: rec.patient_id,
    patientName: rec.patient_name || '',
    doctorId: rec.doctor_id,
    doctorName: rec.doctor_name || '',
    appointmentId: rec.appointment_id || null,
    visitDate: rec.visit_date ? String(rec.visit_date).split('T')[0] : null,
    symptoms: rec.symptoms || '',
    diagnosis: rec.diagnosis || '',
    treatmentNotes: rec.treatment_notes || '',
    prescriptions: prescriptions.map(p => ({
      id: p.id,
      medicalRecordId: p.medical_record_id,
      patientId: p.patient_id,
      doctorId: p.doctor_id,
      medicineName: p.medicine_name,
      dosage: p.dosage,
      frequency: p.frequency,
      duration: p.duration,
      instructions: p.instructions,
      prescriptionDate: p.prescription_date ? String(p.prescription_date).split('T')[0] : null,
    })),
  };
}

const RECORD_SELECT_SQL = `
  SELECT m.*, p.full_name as patient_name, d.full_name as doctor_name
  FROM medical_records m
  JOIN patients p ON m.patient_id = p.id
  JOIN doctors d ON m.doctor_id = d.id
`;

// GET /api/medical-records (ADMIN only)
router.get('/', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();

  try {
    if (pool) {
      const [records] = await pool.query(`${RECORD_SELECT_SQL} ORDER BY m.visit_date DESC`);
      const [prescriptions] = await pool.query('SELECT * FROM prescriptions');

      const result = records.map(r => {
        const prescs = prescriptions.filter(p => p.medical_record_id === r.id);
        return mapRecord(r, prescs);
      });
      return res.json(result);
    } else {
      const result = memoryStore.medical_records.map(r => {
        const p = memoryStore.patients.find(pat => pat.id === r.patient_id);
        const d = memoryStore.doctors.find(doc => doc.id === r.doctor_id);
        const prescs = memoryStore.prescriptions.filter(pr => pr.medical_record_id === r.id);
        return mapRecord({ ...r, patient_name: p?.full_name, doctor_name: d?.full_name }, prescs);
      });
      return res.json(result);
    }
  } catch (err) {
    console.error('[RECORDS] Error:', err);
    return res.status(500).json({ message: 'Failed to fetch medical records' });
  }
});

// GET /api/medical-records/doctor/:doctorId (ADMIN or DOCTOR)
router.get('/doctor/:doctorId', authenticate, authorize('ADMIN', 'DOCTOR'), async (req, res) => {
  await initializeDatabase();
  const doctorId = Number(req.params.doctorId);
  const pool = await getPool();

  try {
    if (pool) {
      const [records] = await pool.query(`${RECORD_SELECT_SQL} WHERE m.doctor_id = ? ORDER BY m.visit_date DESC`, [doctorId]);
      const [prescriptions] = await pool.query('SELECT * FROM prescriptions WHERE doctor_id = ?', [doctorId]);

      const result = records.map(r => {
        const prescs = prescriptions.filter(p => p.medical_record_id === r.id);
        return mapRecord(r, prescs);
      });
      return res.json(result);
    } else {
      const result = memoryStore.medical_records
        .filter(r => r.doctor_id === doctorId)
        .map(r => {
          const p = memoryStore.patients.find(pat => pat.id === r.patient_id);
          const d = memoryStore.doctors.find(doc => doc.id === r.doctor_id);
          const prescs = memoryStore.prescriptions.filter(pr => pr.medical_record_id === r.id);
          return mapRecord({ ...r, patient_name: p?.full_name, doctor_name: d?.full_name }, prescs);
        });
      return res.json(result);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch doctor records' });
  }
});

// GET /api/medical-records/patient/:patientId
router.get('/patient/:patientId', authenticate, async (req, res) => {
  await initializeDatabase();
  const patientId = Number(req.params.patientId);
  const pool = await getPool();

  try {
    if (pool) {
      const [records] = await pool.query(`${RECORD_SELECT_SQL} WHERE m.patient_id = ? ORDER BY m.visit_date DESC`, [patientId]);
      const [prescriptions] = await pool.query('SELECT * FROM prescriptions WHERE patient_id = ?', [patientId]);

      const result = records.map(r => {
        const prescs = prescriptions.filter(p => p.medical_record_id === r.id);
        return mapRecord(r, prescs);
      });
      return res.json(result);
    } else {
      const result = memoryStore.medical_records
        .filter(r => r.patient_id === patientId)
        .map(r => {
          const p = memoryStore.patients.find(pat => pat.id === r.patient_id);
          const d = memoryStore.doctors.find(doc => doc.id === r.doctor_id);
          const prescs = memoryStore.prescriptions.filter(pr => pr.medical_record_id === r.id);
          return mapRecord({ ...r, patient_name: p?.full_name, doctor_name: d?.full_name }, prescs);
        });
      return res.json(result);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch patient records' });
  }
});

// GET /api/medical-records/:id
router.get('/:id', authenticate, async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`${RECORD_SELECT_SQL} WHERE m.id = ?`, [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Medical record not found' });
      const [prescriptions] = await pool.query('SELECT * FROM prescriptions WHERE medical_record_id = ?', [id]);
      return res.json(mapRecord(rows[0], prescriptions));
    } else {
      const r = memoryStore.medical_records.find(rec => rec.id === id);
      if (!r) return res.status(404).json({ message: 'Medical record not found' });
      const p = memoryStore.patients.find(pat => pat.id === r.patient_id);
      const d = memoryStore.doctors.find(doc => doc.id === r.doctor_id);
      const prescs = memoryStore.prescriptions.filter(pr => pr.medical_record_id === r.id);
      return res.json(mapRecord({ ...r, patient_name: p?.full_name, doctor_name: d?.full_name }, prescs));
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch record' });
  }
});

// POST /api/medical-records (ADMIN or DOCTOR)
router.post('/', authenticate, authorize('ADMIN', 'DOCTOR'), async (req, res) => {
  await initializeDatabase();
  const { patientId, doctorId, appointmentId, visitDate, symptoms, diagnosis, treatmentNotes, prescriptions } = req.body;

  if (!patientId || !doctorId || !diagnosis) {
    return res.status(400).json({ message: 'Patient, Doctor, and Diagnosis are required' });
  }

  const dateVal = visitDate || new Date().toISOString().split('T')[0];
  const pool = await getPool();

  try {
    if (pool) {
      const [mRes] = await pool.query(
        `INSERT INTO medical_records (patient_id, doctor_id, appointment_id, visit_date, symptoms, diagnosis, treatment_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [patientId, doctorId, appointmentId || null, dateVal, symptoms || '', diagnosis, treatmentNotes || '']
      );
      const recordId = mRes.insertId;

      const createdPrescriptions = [];
      if (Array.isArray(prescriptions)) {
        for (const p of prescriptions) {
          if (!p.medicineName) continue;
          const [pRes] = await pool.query(
            `INSERT INTO prescriptions (medical_record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions, prescription_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [recordId, patientId, doctorId, p.medicineName, p.dosage || '', p.frequency || '', p.duration || '', p.instructions || '', dateVal]
          );
          createdPrescriptions.push({ ...p, id: pRes.insertId, medical_record_id: recordId, patient_id: patientId, doctor_id: doctorId, prescription_date: dateVal });
        }
      }

      // If tied to an appointment, mark appointment COMPLETED
      if (appointmentId) {
        await pool.query("UPDATE appointments SET status = 'COMPLETED' WHERE id = ?", [appointmentId]);
      }

      const [created] = await pool.query(`${RECORD_SELECT_SQL} WHERE m.id = ?`, [recordId]);
      return res.status(200).json(mapRecord(created[0], createdPrescriptions));
    } else {
      const recordId = memoryStore.medical_records.length + 1;
      const newRec = {
        id: recordId,
        patient_id: Number(patientId),
        doctor_id: Number(doctorId),
        appointment_id: appointmentId ? Number(appointmentId) : null,
        visit_date: dateVal,
        symptoms: symptoms || '',
        diagnosis,
        treatment_notes: treatmentNotes || '',
      };
      memoryStore.medical_records.push(newRec);

      const createdPrescriptions = [];
      if (Array.isArray(prescriptions)) {
        for (const p of prescriptions) {
          if (!p.medicineName) continue;
          const presId = memoryStore.prescriptions.length + 1;
          const newPres = {
            id: presId,
            medical_record_id: recordId,
            patient_id: Number(patientId),
            doctor_id: Number(doctorId),
            medicine_name: p.medicineName,
            dosage: p.dosage || '',
            frequency: p.frequency || '',
            duration: p.duration || '',
            instructions: p.instructions || '',
            prescription_date: dateVal,
          };
          memoryStore.prescriptions.push(newPres);
          createdPrescriptions.push(newPres);
        }
      }

      if (appointmentId) {
        const appt = memoryStore.appointments.find(a => a.id === Number(appointmentId));
        if (appt) appt.status = 'COMPLETED';
      }

      const p = memoryStore.patients.find(pat => pat.id === Number(patientId));
      const d = memoryStore.doctors.find(doc => doc.id === Number(doctorId));
      return res.json(mapRecord({ ...newRec, patient_name: p?.full_name, doctor_name: d?.full_name }, createdPrescriptions));
    }
  } catch (err) {
    console.error('[RECORDS] Create error:', err);
    return res.status(500).json({ message: 'Failed to create medical record' });
  }
});

export default router;
