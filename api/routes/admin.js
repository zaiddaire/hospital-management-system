import express from 'express';
import { getPool, memoryStore, initializeDatabase } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin/dashboard (ADMIN only)
router.get('/dashboard', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();

  try {
    if (pool) {
      const [[{ totalDoctors }]] = await pool.query('SELECT COUNT(*) as totalDoctors FROM doctors WHERE is_active = true');
      const [[{ totalPatients }]] = await pool.query('SELECT COUNT(*) as totalPatients FROM patients');
      const [[{ totalAppointments }]] = await pool.query('SELECT COUNT(*) as totalAppointments FROM appointments');
      const [[{ pendingAppointments }]] = await pool.query("SELECT COUNT(*) as pendingAppointments FROM appointments WHERE status = 'PENDING'");
      const [[{ completedAppointments }]] = await pool.query("SELECT COUNT(*) as completedAppointments FROM appointments WHERE status = 'COMPLETED'");
      const [[{ totalDepartments }]] = await pool.query('SELECT COUNT(*) as totalDepartments FROM departments WHERE is_active = true');
      const [[{ todayRevenue }]] = await pool.query("SELECT COALESCE(SUM(amount),0) as todayRevenue FROM bills WHERE payment_status = 'PAID' AND DATE(bill_date) = CURDATE()");

      return res.json({
        totalDoctors: Number(totalDoctors),
        totalPatients: Number(totalPatients),
        totalAppointments: Number(totalAppointments),
        pendingAppointments: Number(pendingAppointments),
        completedAppointments: Number(completedAppointments),
        totalDepartments: Number(totalDepartments),
        todayRevenue: Number(todayRevenue),
      });
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRevenue = memoryStore.bills
        .filter(b => b.payment_status === 'PAID' && b.bill_date === todayStr)
        .reduce((sum, b) => sum + Number(b.amount || 0), 0);
      return res.json({
        totalDoctors: memoryStore.doctors.filter(d => d.is_active).length,
        totalPatients: memoryStore.patients.length,
        totalAppointments: memoryStore.appointments.length,
        pendingAppointments: memoryStore.appointments.filter(a => a.status === 'PENDING').length,
        completedAppointments: memoryStore.appointments.filter(a => a.status === 'COMPLETED').length,
        totalDepartments: memoryStore.departments.filter(d => d.is_active).length,
        todayRevenue,
      });
    }

  } catch (err) {
    console.error('[ADMIN] Dashboard stats error:', err);
    return res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

// GET /api/admin/doctors (ADMIN only)
router.get('/doctors', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`
        SELECT d.*, u.username, u.email, dep.name as department_name
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dep ON d.department_id = dep.id
        ORDER BY d.id ASC
      `);
      return res.json(rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        email: r.email,
        departmentId: r.department_id,
        departmentName: r.department_name || '',
        fullName: r.full_name,
        dateOfBirth: r.date_of_birth ? String(r.date_of_birth).split('T')[0] : null,
        gender: r.gender,
        phone: r.phone,
        specialization: r.specialization,
        qualification: r.qualification,
        experienceYears: r.experience_years || 0,
        consultationFee: Number(r.consultation_fee) || 0,
        availability: r.availability || 'Mon-Fri 9AM-5PM',
        isActive: Boolean(r.is_active),
      })));
    } else {
      const rows = memoryStore.doctors.map(d => {
        const u = memoryStore.users.find(user => user.id === d.user_id);
        const dept = memoryStore.departments.find(dep => dep.id === d.department_id);
        return {
          id: d.id,
          userId: d.user_id,
          username: u?.username,
          email: u?.email,
          departmentId: d.department_id,
          departmentName: dept?.name || '',
          fullName: d.full_name,
          dateOfBirth: d.date_of_birth || null,
          gender: d.gender,
          phone: d.phone,
          specialization: d.specialization,
          qualification: d.qualification,
          experienceYears: d.experience_years || 0,
          consultationFee: Number(d.consultation_fee) || 0,
          availability: d.availability || 'Mon-Fri 9AM-5PM',
          isActive: Boolean(d.is_active),
        };
      });
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch doctors' });
  }
});

// GET /api/admin/patients (ADMIN only)
router.get('/patients', authenticate, authorize('ADMIN'), async (req, res) => {
  await initializeDatabase();
  const pool = await getPool();

  try {
    if (pool) {
      const [rows] = await pool.query(`
        SELECT p.*, u.username, u.email
        FROM patients p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.id ASC
      `);
      return res.json(rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        email: r.email,
        fullName: r.full_name,
        dateOfBirth: r.date_of_birth ? String(r.date_of_birth).split('T')[0] : null,
        gender: r.gender,
        bloodGroup: r.blood_group,
        phone: r.phone,
        address: r.address,
        emergencyContact: r.emergency_contact,
      })));
    } else {
      const rows = memoryStore.patients.map(p => {
        const u = memoryStore.users.find(user => user.id === p.user_id);
        return {
          id: p.id,
          userId: p.user_id,
          username: u?.username,
          email: u?.email,
          fullName: p.full_name,
          dateOfBirth: p.date_of_birth || null,
          gender: p.gender,
          bloodGroup: p.blood_group,
          phone: p.phone,
          address: p.address,
          emergencyContact: p.emergency_contact,
        };
      });
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch patients' });
  }
});

export default router;
