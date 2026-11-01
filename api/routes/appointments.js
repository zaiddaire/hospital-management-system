import express from 'express';
import { getPool, memoryStore, initializeDatabase, saveMemoryStore, formatDate } from '../db.js';
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
    appointmentDate: formatDate(row.appointment_date),
    appointmentTime: row.appointment_time || '',
    reason: row.reason || '',
    status: row.status || 'PENDING',
  };
}

function mapHistory(row) {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    oldAppointmentDate: formatDate(row.old_appointment_date) || '',
    oldAppointmentTime: row.old_appointment_time || '',
    newAppointmentDate: formatDate(row.new_appointment_date) || '',
    newAppointmentTime: row.new_appointment_time || '',
    changedByUserId: row.changed_by_user_id,
    changedByRole: row.changed_by_role,
    changedByName: row.changed_by_name || '',
    reason: row.reason || '',
    previousStatus: row.previous_status || '',
    newStatus: row.new_status || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

const APPT_SELECT_SQL = `
  SELECT a.*, p.full_name as patient_name, d.full_name as doctor_name, dep.name as department_name
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  JOIN doctors d ON a.doctor_id = d.id
  LEFT JOIN departments dep ON d.department_id = dep.id
`;

// Helper: parse doctor availability schedule e.g. "Mon-Fri 9:00 AM - 1:00 PM"
export function parseAvailability(availStr) {
  if (!availStr) availStr = 'Mon-Fri 9:00 AM - 5:00 PM';
  const daysMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
  
  const dayMatch = availStr.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*-\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
  let workingDays = [1, 2, 3, 4, 5];
  if (dayMatch) {
    const startD = daysMap[dayMatch[1].toLowerCase()];
    const endD = daysMap[dayMatch[2].toLowerCase()];
    workingDays = [];
    let cur = startD;
    while (true) {
      workingDays.push(cur);
      if (cur === endD) break;
      cur = (cur + 1) % 7;
    }
  }

  const timeMatches = [...availStr.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  let startMinutes = 9 * 60;
  let endMinutes = 17 * 60;

  if (timeMatches.length >= 2) {
    function toMins(m) {
      let h = parseInt(m[1], 10);
      const mins = m[2] ? parseInt(m[2], 10) : 0;
      const meridiem = m[3].toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      return h * 60 + mins;
    }
    startMinutes = toMins(timeMatches[0]);
    endMinutes = toMins(timeMatches[1]);
  }

  return { workingDays, startMinutes, endMinutes };
}

// Helper: calculate doctor available slots on target date
export function getDoctorAvailableSlots(doctor, targetDateStr, existingAppointments, excludeAppointmentId = null) {
  const parts = targetDateStr.split('-');
  if (parts.length !== 3) {
    return { error: 'Invalid date format. Expected YYYY-MM-DD' };
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const targetDate = new Date(year, month, day);

  const dayOfWeekIndex = targetDate.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[dayOfWeekIndex];

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isPastDate = targetDateStr < todayStr;
  const isToday = targetDateStr === todayStr;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const availability = doctor.availability || 'Mon-Fri 9:00 AM - 5:00 PM';
  const { workingDays, startMinutes, endMinutes } = parseAvailability(availability);
  const isWorkingDay = workingDays.includes(dayOfWeekIndex);

  if (!isWorkingDay) {
    return {
      doctorId: doctor.id,
      doctorName: doctor.fullName || doctor.full_name,
      date: targetDateStr,
      dayOfWeek: dayName,
      isWorkingDay: false,
      availability,
      message: `Dr. ${doctor.fullName || doctor.full_name} does not practice on ${dayName}s. (${availability})`,
      slots: [],
    };
  }

  const slots = [];
  for (let mins = startMinutes; mins < endMinutes; mins += 30) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayTime = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;

    let available = true;
    let reason = '';
    let booked = false;

    if (isPastDate) {
      available = false;
      reason = 'Date is in the past';
    } else if (isToday && mins <= currentMinutes) {
      available = false;
      reason = 'Time has already passed today';
    }

    const normalizeTime = t => String(t || '').trim().slice(0, 5);

    const conflict = existingAppointments.find(a => {
      if (excludeAppointmentId && Number(a.id) === Number(excludeAppointmentId)) {
        return false;
      }
      const aDocId = a.doctor_id !== undefined ? a.doctor_id : a.doctorId;
      const aDate = formatDate(a.appointment_date !== undefined ? a.appointment_date : a.appointmentDate);
      const aTime = a.appointment_time !== undefined ? a.appointment_time : a.appointmentTime;
      const aStatus = a.status;

      if (Number(aDocId) !== Number(doctor.id)) return false;
      if (aDate !== targetDateStr) return false;
      if (aStatus === 'CANCELLED') return false;

      return aTime && (normalizeTime(aTime) === normalizeTime(timeStr));
    });

    if (conflict) {
      available = false;
      booked = true;
      reason = 'Slot is already booked';
    }

    slots.push({
      time: timeStr,
      displayTime,
      available,
      booked,
      reason: reason || (available ? 'Available' : 'Unavailable'),
    });
  }

  return {
    doctorId: doctor.id,
    doctorName: doctor.fullName || doctor.full_name,
    date: targetDateStr,
    dayOfWeek: dayName,
    isWorkingDay: true,
    availability,
    message: isPastDate ? 'Selected date is in the past' : (slots.some(s => s.available) ? 'Slots available' : 'All slots booked for this date'),
    slots,
  };
}

// GET /api/appointments (ADMIN, DOCTOR, or PATIENT)
router.get('/', authenticate, async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();
  const user = req.user;

  try {
    if (pool) {
      if (user.role === 'ADMIN') {
        const [rows] = await pool.query(`${APPT_SELECT_SQL} ORDER BY a.appointment_date DESC, a.appointment_time DESC`);
        return res.json(rows.map(mapAppointment));
      } else if (user.role === 'DOCTOR') {
        const [docs] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [user.userId]);
        const doctorId = docs.length > 0 ? docs[0].id : 0;
        const [rows] = await pool.query(`${APPT_SELECT_SQL} WHERE a.doctor_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC`, [doctorId]);
        return res.json(rows.map(mapAppointment));
      } else if (user.role === 'PATIENT') {
        const [pats] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [user.userId]);
        const patientId = pats.length > 0 ? pats[0].id : 0;
        const [rows] = await pool.query(`${APPT_SELECT_SQL} WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC`, [patientId]);
        return res.json(rows.map(mapAppointment));
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      if (user.role === 'ADMIN') {
        const rows = memoryStore.appointments.map(a => {
          const p = memoryStore.patients.find(pat => pat.id === a.patient_id);
          const d = memoryStore.doctors.find(doc => doc.id === a.doctor_id);
          const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
          return mapAppointment({ ...a, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name });
        });
        return res.json(rows);
      } else if (user.role === 'DOCTOR') {
        const doc = memoryStore.doctors.find(d => d.user_id === user.userId);
        const doctorId = doc ? doc.id : 0;
        const rows = memoryStore.appointments
          .filter(a => a.doctor_id === doctorId)
          .map(a => {
            const p = memoryStore.patients.find(pat => pat.id === a.patient_id);
            const d = memoryStore.doctors.find(doctor => doctor.id === a.doctor_id);
            const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
            return mapAppointment({ ...a, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name });
          });
        return res.json(rows);
      } else if (user.role === 'PATIENT') {
        const pat = memoryStore.patients.find(p => p.user_id === user.userId);
        const patientId = pat ? pat.id : 0;
        const rows = memoryStore.appointments
          .filter(a => a.patient_id === patientId)
          .map(a => {
            const p = memoryStore.patients.find(patient => patient.id === a.patient_id);
            const d = memoryStore.doctors.find(doctor => doctor.id === a.doctor_id);
            const dep = d ? memoryStore.departments.find(dept => dept.id === d.department_id) : null;
            return mapAppointment({ ...a, patient_name: p?.full_name, doctor_name: d?.full_name, department_name: dep?.name });
          });
        return res.json(rows);
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
  } catch (err) {
    console.error('[APPOINTMENTS] Error:', err);
    return res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/available-slots?doctorId=...&date=... (Authenticated)
router.get('/available-slots', authenticate, async (req, res) => {
  await initializeDatabase();
  const doctorId = Number(req.query.doctorId);
  const dateStr = req.query.date;
  const excludeAppointmentId = req.query.excludeAppointmentId ? Number(req.query.excludeAppointmentId) : null;

  if (!doctorId || !dateStr) {
    return res.status(400).json({ message: 'doctorId and date query parameters are required' });
  }

  const pool = await getPool();

  try {
    let doctor = null;
    let existingAppointments = [];

    if (pool) {
      const [docRows] = await pool.query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
      if (docRows.length === 0) return res.status(404).json({ message: 'Doctor not found' });
      doctor = docRows[0];

      const [apptRows] = await pool.query(
        'SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != "CANCELLED"',
        [doctorId, dateStr]
      );
      existingAppointments = apptRows;
    } else {
      doctor = memoryStore.doctors.find(d => d.id === doctorId);
      if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

      existingAppointments = memoryStore.appointments.filter(
        a => a.doctor_id === doctorId && a.appointment_date === dateStr && a.status !== 'CANCELLED'
      );
    }

    const result = getDoctorAvailableSlots(doctor, dateStr, existingAppointments, excludeAppointmentId);
    return res.json(result);
  } catch (err) {
    console.error('[APPOINTMENTS] Available slots error:', err);
    return res.status(500).json({ message: 'Failed to retrieve available slots' });
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

// GET /api/appointments/:id/history (Reschedule audit trail)
router.get('/:id/history', authenticate, async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(
        'SELECT * FROM appointment_reschedule_history WHERE appointment_id = ? ORDER BY created_at DESC',
        [id]
      );
      return res.json(rows.map(mapHistory));
    } else {
      const rows = (memoryStore.appointment_history || [])
        .filter(h => Number(h.appointment_id) === id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return res.json(rows.map(mapHistory));
    }
  } catch (err) {
    console.error('[APPOINTMENTS] History error:', err);
    return res.status(500).json({ message: 'Failed to fetch appointment history' });
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

// POST /api/appointments/:id/reschedule (Reschedule an appointment)
router.post('/:id/reschedule', authenticate, async (req, res) => {
  await initializeDatabase();
  const id = Number(req.params.id);
  let { newDate, newTime, reason } = req.body;
  const user = req.user;

  if (!newDate || !newTime) {
    return res.status(400).json({ message: 'New appointment date and time are required' });
  }

  // Format time as HH:mm:ss
  let formattedTime = String(newTime).trim();
  if (formattedTime.length === 5) formattedTime += ':00';

  // Prevent booking in the past
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (newDate < todayStr) {
    return res.status(400).json({ message: 'Cannot reschedule to a past date.' });
  }
  if (newDate === todayStr) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = formattedTime.split(':').map(Number);
    if ((h * 60 + m) <= currentMinutes) {
      return res.status(400).json({ message: 'Cannot reschedule to a past time slot today.' });
    }
  }

  const pool = await getPool();

  try {
    if (pool) {
      // 1. Fetch appointment with patient user_id
      const [apptRows] = await pool.query(
        `SELECT a.*, p.user_id as patient_user_id, p.full_name as patient_name,
                d.full_name as doctor_name, d.availability as doctor_availability,
                dep.name as department_name
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         JOIN doctors d ON a.doctor_id = d.id
         LEFT JOIN departments dep ON d.department_id = dep.id
         WHERE a.id = ?`,
        [id]
      );

      if (apptRows.length === 0) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      const appt = apptRows[0];

      // 2. Permission check
      if (user.role === 'PATIENT') {
        if (appt.patient_user_id !== user.userId) {
          return res.status(403).json({ message: 'Access denied: You can only reschedule your own appointments.' });
        }
      } else if (user.role === 'DOCTOR') {
        const [docs] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [user.userId]);
        const doctorId = docs.length > 0 ? docs[0].id : 0;
        if (appt.doctor_id !== doctorId) {
          return res.status(403).json({ message: 'Access denied: You are not the assigned doctor for this appointment.' });
        }
      } else if (user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // 3. Status workflow check: Completed and Cancelled cannot be rescheduled
      if (appt.status === 'COMPLETED') {
        return res.status(400).json({ message: 'Completed appointments cannot be rescheduled.' });
      }
      if (appt.status === 'CANCELLED') {
        return res.status(400).json({ message: 'Cancelled appointments cannot be rescheduled.' });
      }

      // Check doctor availability schedule
      if (appt.doctor_availability) {
        const { workingDays } = parseAvailability(appt.doctor_availability);
        const parts = newDate.split('-').map(Number);
        const dayOfWeekIndex = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
        if (!workingDays.includes(dayOfWeekIndex)) {
          return res.status(400).json({ message: `Dr. ${appt.doctor_name} does not practice on this day.` });
        }
      }

      // 4. Safe transaction with row locking to prevent double booking race conditions
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Lock existing slots for this doctor on requested date and time
        const [conflictRows] = await conn.query(
          `SELECT id FROM appointments
           WHERE doctor_id = ? AND appointment_date = ? AND TIME_FORMAT(appointment_time, '%H:%i') = TIME_FORMAT(?, '%H:%i') AND status != 'CANCELLED' AND id != ?
           FOR UPDATE`,
          [appt.doctor_id, newDate, formattedTime, id]
        );

        if (conflictRows.length > 0) {
          await conn.rollback();
          return res.status(409).json({ message: 'This appointment slot is already booked for the selected doctor. Please choose another slot.' });
        }

        const oldDate = formatDate(appt.appointment_date) || '';
        const oldTime = appt.appointment_time;

        // Perform update
        await conn.query(
          'UPDATE appointments SET appointment_date = ?, appointment_time = ?, updated_at = NOW() WHERE id = ?',
          [newDate, formattedTime, id]
        );

        // Record in audit history table
        await conn.query(
          `INSERT INTO appointment_reschedule_history
           (appointment_id, patient_id, doctor_id, old_appointment_date, old_appointment_time, new_appointment_date, new_appointment_time, changed_by_user_id, changed_by_role, changed_by_name, reason, previous_status, new_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, appt.patient_id, appt.doctor_id,
            oldDate, oldTime, newDate, formattedTime,
            user.userId, user.role, user.fullName || user.username,
            reason || 'Rescheduled by user',
            appt.status, appt.status
          ]
        );

        await conn.commit();

        const [updatedRows] = await pool.query(`${APPT_SELECT_SQL} WHERE a.id = ?`, [id]);
        return res.json(mapAppointment(updatedRows[0]));
      } catch (txErr) {
        await conn.rollback();
        throw txErr;
      } finally {
        conn.release();
      }

    } else {
      // Memory store execution
      const appt = memoryStore.appointments.find(a => a.id === id);
      if (!appt) return res.status(404).json({ message: 'Appointment not found' });

      const patient = memoryStore.patients.find(p => p.id === appt.patient_id);
      const doctor = memoryStore.doctors.find(d => d.id === appt.doctor_id);

      // Permission check
      if (user.role === 'PATIENT') {
        if (!patient || patient.user_id !== user.userId) {
          return res.status(403).json({ message: 'Access denied: You can only reschedule your own appointments.' });
        }
      } else if (user.role === 'DOCTOR') {
        const doc = memoryStore.doctors.find(d => d.user_id === user.userId);
        if (!doc || appt.doctor_id !== doc.id) {
          return res.status(403).json({ message: 'Access denied: You are not the assigned doctor for this appointment.' });
        }
      } else if (user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Status check
      if (appt.status === 'COMPLETED') {
        return res.status(400).json({ message: 'Completed appointments cannot be rescheduled.' });
      }
      if (appt.status === 'CANCELLED') {
        return res.status(400).json({ message: 'Cancelled appointments cannot be rescheduled.' });
      }

      // Check doctor availability schedule
      if (doctor) {
        const slotsCheck = getDoctorAvailableSlots(doctor, newDate, memoryStore.appointments, id);
        if (!slotsCheck.isWorkingDay) {
          return res.status(400).json({ message: slotsCheck.message });
        }
      }

      // Check slot conflict atomically
      const normalizeTime = t => String(t || '').trim().slice(0, 5);
      const slotConflict = memoryStore.appointments.some(
        a => Number(a.id) !== id &&
             Number(a.doctor_id) === Number(appt.doctor_id) &&
             formatDate(a.appointment_date) === newDate &&
             normalizeTime(a.appointment_time) === normalizeTime(formattedTime) &&
             a.status !== 'CANCELLED'
      );

      if (slotConflict) {
        return res.status(409).json({ message: 'This appointment slot is already booked for the selected doctor. Please choose another slot.' });
      }

      const oldDate = formatDate(appt.appointment_date) || '';
      const oldTime = appt.appointment_time;

      // Update appointment
      appt.appointment_date = newDate;
      appt.appointment_time = formattedTime;

      // Record audit history
      if (!memoryStore.appointment_history) memoryStore.appointment_history = [];
      const historyRecord = {
        id: memoryStore.appointment_history.length + 1,
        appointment_id: id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        old_appointment_date: oldDate,
        old_appointment_time: oldTime,
        new_appointment_date: newDate,
        new_appointment_time: formattedTime,
        changed_by_user_id: user.userId,
        changed_by_role: user.role,
        changed_by_name: user.fullName || user.username,
        reason: reason || 'Rescheduled by user',
        previous_status: appt.status,
        new_status: appt.status,
        created_at: new Date().toISOString(),
      };
      memoryStore.appointment_history.push(historyRecord);

      // Persist to disk
      saveMemoryStore();

      const dep = doctor ? memoryStore.departments.find(dept => dept.id === doctor.department_id) : null;
      return res.json(mapAppointment({
        ...appt,
        patient_name: patient?.full_name,
        doctor_name: doctor?.full_name,
        department_name: dep?.name,
      }));
    }
  } catch (err) {
    console.error('[APPOINTMENTS] Reschedule error:', err);
    return res.status(500).json({ message: 'Failed to reschedule appointment' });
  }
});

// POST /api/appointments (Book appointment)
router.post('/', authenticate, async (req, res) => {
  await initializeDatabase();
  let { patientId, doctorId, appointmentDate, appointmentTime, reason } = req.body;
  const user = req.user;

  const pool = await getPool();

  // Auto-resolve patientId for PATIENT role from their JWT
  if (!patientId && user.role === 'PATIENT') {
    try {
      if (pool) {
        const [pats] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [user.userId]);
        if (pats.length > 0) patientId = pats[0].id;
      } else {
        const pat = memoryStore.patients.find(p => p.user_id === user.userId);
        if (pat) patientId = pat.id;
      }
    } catch (_) {}
  }

  if (!patientId || !doctorId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ message: 'Patient, Doctor, Date, and Time are required' });
  }

  // Format time as HH:mm:ss
  let formattedTime = String(appointmentTime).trim();
  if (formattedTime.length === 5) formattedTime += ':00';

  // Prevent past date/time booking
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (appointmentDate < todayStr) {
    return res.status(400).json({ message: 'Cannot book an appointment on a past date.' });
  }
  if (appointmentDate === todayStr) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = formattedTime.split(':').map(Number);
    if ((h * 60 + m) <= currentMinutes) {
      return res.status(400).json({ message: 'Cannot book an appointment at a past time slot today.' });
    }
  }

  try {
    if (pool) {
      // Check for slot conflict on doctor
      const [existing] = await pool.query(
        `SELECT id FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND TIME_FORMAT(appointment_time, '%H:%i') = TIME_FORMAT(?, '%H:%i') AND status != 'CANCELLED'`,
        [doctorId, appointmentDate, formattedTime]
      );

      if (existing.length > 0) {
        return res.status(409).json({ message: 'This time slot is already booked for the selected doctor.' });
      }

      const [insert] = await pool.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
         VALUES (?, ?, ?, ?, ?, 'PENDING')`,
        [patientId, doctorId, appointmentDate, formattedTime, reason || '']
      );

      const [created] = await pool.query(`${APPT_SELECT_SQL} WHERE a.id = ?`, [insert.insertId]);
      return res.status(200).json(mapAppointment(created[0]));
    } else {
      const normalizeTime = t => String(t || '').trim().slice(0, 5);
      const slotConflict = memoryStore.appointments.some(
        a => Number(a.doctor_id) === Number(doctorId) &&
             formatDate(a.appointment_date) === appointmentDate &&
             normalizeTime(a.appointment_time) === normalizeTime(formattedTime) &&
             a.status !== 'CANCELLED'
      );
      if (slotConflict) {
        return res.status(409).json({ message: 'This time slot is already booked for the selected doctor.' });
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
      saveMemoryStore();

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
      saveMemoryStore();

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
  const user = req.user;

  try {
    if (pool) {
      const [existing] = await pool.query('SELECT id FROM appointments WHERE id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ message: 'Appointment not found' });

      // Permission check if patient
      if (user.role === 'PATIENT') {
        const [rows] = await pool.query(
          'SELECT a.id FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.id = ? AND p.user_id = ?',
          [id, user.userId]
        );
        if (rows.length === 0) {
          return res.status(403).json({ message: 'Access denied: You can only cancel your own appointments.' });
        }
      }

      await pool.query("UPDATE appointments SET status = 'CANCELLED' WHERE id = ?", [id]);
      return res.status(204).send();
    } else {
      const a = memoryStore.appointments.find(appt => Number(appt.id) === id);
      if (!a) return res.status(404).json({ message: 'Appointment not found' });

      if (user.role === 'PATIENT') {
        const pat = memoryStore.patients.find(p => Number(p.id) === Number(a.patient_id));
        if (!pat || Number(pat.user_id) !== Number(user.userId)) {
          return res.status(403).json({ message: 'Access denied: You can only cancel your own appointments.' });
        }
      }
      a.status = 'CANCELLED';
      saveMemoryStore();
      return res.status(204).send();
    }
  } catch (err) {
    console.error('[APPOINTMENTS] Cancel error:', err);
    return res.status(500).json({ message: 'Failed to cancel appointment' });
  }
});

export default router;
