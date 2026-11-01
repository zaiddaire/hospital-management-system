import app from '../api/index.js';
import { initializeDatabase, memoryStore } from '../api/db.js';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

function createMockReqRes(method, path, body = null, headers = {}) {
  const payload = body ? JSON.stringify(body) : '';
  const req = new Readable();
  req._read = () => {};
  req.method = method;
  req.url = path;
  req.headers = {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    ...headers
  };
  req.connection = {};

  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.getHeader = (k) => res.headers[k.toLowerCase()];
  res.removeHeader = (k) => { delete res.headers[k.toLowerCase()]; };
  res.writeHead = (status, hdrs) => {
    res.statusCode = status;
    if (hdrs) Object.assign(res.headers, hdrs);
  };

  let chunks = [];
  res.write = (chunk) => { chunks.push(Buffer.from(chunk)); };
  res.end = (chunk) => {
    if (chunk) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString('utf8');
    let data = raw;
    try { data = JSON.parse(raw); } catch (e) {}
    res.emit('finish', { status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data });
  };

  process.nextTick(() => {
    if (payload) req.push(payload);
    req.push(null);
  });

  return { req, res };
}

function request(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const headers = {};
    if (token) headers['authorization'] = `Bearer ${token}`;
    const fullPath = path.startsWith('/api') ? path : `/api${path}`;
    const { req, res } = createMockReqRes(method, fullPath, body, headers);
    res.on('finish', resolve);
    app(req, res);
  });
}

const results = [];
function record(suite, testName, passed, details = '') {
  results.push({ suite, testName, passed, details });
  const symbol = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${symbol}: [${suite}] ${testName} ${details ? '— ' + details : ''}`);
}

async function runTests() {
  console.log('🚀 Starting MedCore HMS Comprehensive Test Suite...');
  await initializeDatabase();

  try {
    // 1. Health Check
    const health = await request('GET', '/health');
    record('System Health', 'Health endpoint returns UP', health.status === 200 && health.data?.status === 'UP');

    // 2. Authentication
    const adminLogin = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    const adminToken = adminLogin.data?.token;
    record('Authentication', 'Admin login with JWT', Boolean(adminToken), `Role: ${adminLogin.data?.role}`);

    const docLogin = await request('POST', '/auth/login', { username: 'dr.sharma', password: 'doctor123' });
    const doctorToken = docLogin.data?.token;
    record('Authentication', 'Doctor login with JWT', Boolean(doctorToken), `Role: ${docLogin.data?.role}`);

    const patLogin = await request('POST', '/auth/login', { username: 'rahul.kumar', password: 'patient123' });
    const rahulToken = patLogin.data?.token;
    record('Authentication', 'Existing patient login with JWT', Boolean(rahulToken), `Role: ${patLogin.data?.role}`);

    // Register a new test patient
    const testPatientUsername = `pat_${Date.now()}`;
    const registerRes = await request('POST', '/auth/register', {
      username: testPatientUsername,
      email: `${testPatientUsername}@hospital.com`,
      password: 'password123',
      fullName: 'Aarav Patel',
      phone: '9876543210',
      gender: 'MALE',
      bloodGroup: 'O_POSITIVE',
      address: '42 Marine Drive, Mumbai',
    });
    record('Authentication', 'Patient registration & auto-login', registerRes.status === 200 && Boolean(registerRes.data?.token));
    const patientToken = registerRes.data?.token;
    const patientUserId = registerRes.data?.userId;

    // Retrieve Patient profile
    const patProfileRes = await request('GET', `/patients/user/${patientUserId}`, null, patientToken);
    const patientId = patProfileRes.data?.id;
    record('Patient Profile', 'Get Patient profile by userId', patProfileRes.status === 200 && Boolean(patientId), `Patient ID: ${patientId}`);

    // Retrieve Doctors list
    const docsRes = await request('GET', '/doctors', null, patientToken);
    record('Doctors Directory', 'List doctors', docsRes.status === 200 && docsRes.data.length > 0, `Total doctors: ${docsRes.data?.length}`);
    const selectedDoctor = docsRes.data[0];

    // 3. Available Slots Calculation
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7)); // Next Monday
    const nextMondayStr = targetDate.toISOString().split('T')[0];

    const slotsRes = await request('GET', `/appointments/available-slots?doctorId=${selectedDoctor.id}&date=${nextMondayStr}`, null, patientToken);
    record('Appointment Slots', 'Fetch available slots for doctor on Monday', slotsRes.status === 200 && Array.isArray(slotsRes.data?.slots) && slotsRes.data.slots.length > 0, `${slotsRes.data?.slots?.length} slots generated`);

    const availableSlots = (slotsRes.data?.slots || []).filter(s => s.available);
    record('Appointment Slots', 'Doctor has genuine available slots', availableSlots.length >= 2, `Available slots: ${availableSlots.length}`);

    const slot1 = availableSlots[0].time;
    const slot2 = availableSlots[1].time;

    // 4. Book Appointment
    const bookRes = await request('POST', '/appointments', {
      patientId,
      doctorId: selectedDoctor.id,
      appointmentDate: nextMondayStr,
      appointmentTime: slot1,
      reason: 'Persistent mild cough and fever',
    }, patientToken);

    record('Appointment Booking', 'Book initial appointment', bookRes.status === 200 && Boolean(bookRes.data?.id), `Appt ID: ${bookRes.data?.id} at ${slot1}`);
    const apptId = bookRes.data?.id;

    // 5. Double Booking Prevention Test on Booking
    const doubleBookRes = await request('POST', '/appointments', {
      patientId,
      doctorId: selectedDoctor.id,
      appointmentDate: nextMondayStr,
      appointmentTime: slot1,
      reason: 'Attempting conflict',
    }, patientToken);
    record('Slot Conflict Protection', 'Double-booking same slot returns 409 Conflict', doubleBookRes.status === 409, `Response: ${doubleBookRes.data?.message}`);

    // 6. Slots check with excludeAppointmentId
    const slotsExcludeRes = await request('GET', `/appointments/available-slots?doctorId=${selectedDoctor.id}&date=${nextMondayStr}&excludeAppointmentId=${apptId}`, null, patientToken);
    const slot1InExclude = (slotsExcludeRes.data?.slots || []).find(s => s.time === slot1);
    record('Appointment Slots', 'Exclude appointment ID frees own slot during reschedule planning', slot1InExclude?.available === true);

    // 7. Reschedule to a Sunday (non-working day check)
    const targetSunday = new Date();
    targetSunday.setDate(today.getDate() + ((0 + 7 - today.getDay()) % 7 || 7)); // Next Sunday
    const nextSundayStr = targetSunday.toISOString().split('T')[0];

    const sundayReschedule = await request('POST', `/appointments/${apptId}/reschedule`, {
      newDate: nextSundayStr,
      newTime: slot2,
      reason: 'Should fail - Sunday',
    }, patientToken);
    record('Reschedule Validation', 'Cannot reschedule on doctor non-working day', sundayReschedule.status === 400);

    // 8. Reschedule to Past Date
    const pastReschedule = await request('POST', `/appointments/${apptId}/reschedule`, {
      newDate: '2020-01-01',
      newTime: '10:00:00',
      reason: 'Should fail - past date',
    }, patientToken);
    record('Reschedule Validation', 'Cannot reschedule to past date', pastReschedule.status === 400);

    // 9. Patient Ownership Check (unauthorized user reschedule)
    const unauthorizedReschedule = await request('POST', `/appointments/${apptId}/reschedule`, {
      newDate: nextMondayStr,
      newTime: slot2,
      reason: 'Unauthorized attempt by different patient',
    }, rahulToken);
    record('Reschedule Security', 'Unauthorized patient cannot reschedule another patient appointment (403 Forbidden)', unauthorizedReschedule.status === 403);

    // 10. Genuine Successful Reschedule
    const rescheduleRes = await request('POST', `/appointments/${apptId}/reschedule`, {
      newDate: nextMondayStr,
      newTime: slot2,
      reason: 'Work schedule change, need later slot',
    }, patientToken);

    record('Appointment Reschedule', 'Reschedule appointment successfully', rescheduleRes.status === 200 && rescheduleRes.data?.appointmentTime?.slice(0, 5) === slot2.slice(0, 5), `New Time: ${rescheduleRes.data?.appointmentTime}`);

    // 11. Reschedule Double Booking Prevention
    const currentSlotsRes = await request('GET', `/appointments/available-slots?doctorId=${selectedDoctor.id}&date=${nextMondayStr}`, null, patientToken);
    const currentlyAvailable = (currentSlotsRes.data?.slots || []).filter(s => s.available);
    const freeSlot = currentlyAvailable[0]?.time;

    const book2Res = await request('POST', '/appointments', {
      patientId,
      doctorId: selectedDoctor.id,
      appointmentDate: nextMondayStr,
      appointmentTime: freeSlot,
      reason: 'Second consultation',
    }, patientToken);
    const appt2Id = book2Res.data?.id;

    // Try to reschedule appt2 into slot2 (which appt 1 is now occupying!)
    const conflictReschedule = await request('POST', `/appointments/${appt2Id}/reschedule`, {
      newDate: nextMondayStr,
      newTime: slot2,
      reason: 'Should conflict with appt 1',
    }, patientToken);
    record('Reschedule Conflict Protection', 'Rescheduling into an already booked slot returns 409 Conflict', conflictReschedule.status === 409);

    // 12. Audit Trail Verification
    const historyRes = await request('GET', `/appointments/${apptId}/history`, null, patientToken);
    record('Audit Trail', 'Retrieve appointment reschedule audit history', historyRes.status === 200 && Array.isArray(historyRes.data) && historyRes.data.length > 0, `History records: ${historyRes.data?.length}`);

    const latestAudit = historyRes.data?.[0];
    const auditVerified =
      latestAudit &&
      Number(latestAudit.appointmentId) === Number(apptId) &&
      latestAudit.newAppointmentDate === nextMondayStr &&
      latestAudit.newAppointmentTime?.slice(0, 5) === slot2.slice(0, 5) &&
      latestAudit.changedByRole === 'PATIENT';
    record('Audit Trail', 'Audit trail accurately captures old & new schedules and user metadata', Boolean(auditVerified), `Changed by: ${latestAudit?.changedByName} (${latestAudit?.changedByRole})`);

    // 13. Terminal Visibility Verification
    // Patient terminal
    const patApptsRes = await request('GET', `/appointments/patient/${patientId}`, null, patientToken);
    const patAppt = patApptsRes.data?.find(a => Number(a.id) === Number(apptId));
    record('Patient Terminal', 'Patient sees updated rescheduled appointment', patAppt && patAppt.appointmentTime?.slice(0, 5) === slot2.slice(0, 5));

    // Doctor terminal
    const docApptsRes = await request('GET', `/appointments/doctor/${selectedDoctor.id}`, null, doctorToken);
    const docAppt = docApptsRes.data?.find(a => Number(a.id) === Number(apptId));
    record('Doctor Terminal', 'Doctor sees updated rescheduled appointment', docAppt && docAppt.appointmentTime?.slice(0, 5) === slot2.slice(0, 5));

    // Admin terminal
    const adminApptsRes = await request('GET', '/appointments', null, adminToken);
    const adminAppt = adminApptsRes.data?.find(a => Number(a.id) === Number(apptId));
    record('Admin Terminal', 'Admin sees updated rescheduled appointment', adminAppt && adminAppt.appointmentTime?.slice(0, 5) === slot2.slice(0, 5));

    // 14. Doctor Status Workflow: Confirm & Complete
    const confirmRes = await request('PATCH', `/appointments/${apptId}/status`, { status: 'CONFIRMED' }, doctorToken);
    record('Appointment Status', 'Doctor can confirm appointment', confirmRes.status === 200 && confirmRes.data?.status === 'CONFIRMED');

    const completeRes = await request('PATCH', `/appointments/${apptId}/status`, { status: 'COMPLETED' }, doctorToken);
    record('Appointment Status', 'Doctor can complete appointment', completeRes.status === 200 && completeRes.data?.status === 'COMPLETED');

    // Reschedule on COMPLETED appointment should be rejected
    const completedReschedule = await request('POST', `/appointments/${apptId}/reschedule`, {
      newDate: nextMondayStr,
      newTime: slot1,
      reason: 'Should fail - already completed',
    }, patientToken);
    record('Reschedule Rules', 'Completed appointments cannot be rescheduled (400)', completedReschedule.status === 400);

    // 15. Medical Records & Prescriptions
    const medRecRes = await request('POST', '/medical-records', {
      patientId,
      doctorId: selectedDoctor.id,
      appointmentId: apptId,
      visitDate: nextMondayStr,
      symptoms: 'Mild fever, dry cough',
      diagnosis: 'Upper Respiratory Tract Infection',
      treatmentNotes: 'Rest, hydrate, prescribed antipyretic',
      prescriptions: [
        { medicineName: 'Paracetamol 500mg', dosage: '1 tab', frequency: 'Three times daily', duration: '3 days', instructions: 'After food' }
      ]
    }, doctorToken);
    record('Medical Records', 'Doctor can create medical record with prescription', medRecRes.status === 200 && Boolean(medRecRes.data?.id));

    // Patient views medical record
    const patRecordsRes = await request('GET', `/medical-records/patient/${patientId}`, null, patientToken);
    record('Medical Records', 'Patient can view their own medical records & prescriptions', patRecordsRes.status === 200 && patRecordsRes.data?.length > 0);

    // 16. Billing & Invoices
    const billRes = await request('POST', '/bills', {
      patientId,
      appointmentId: apptId,
      description: 'Consultation & Prescription Fee',
      amount: selectedDoctor.consultationFee || 500,
    }, adminToken);
    record('Billing Management', 'Admin can generate patient invoice', billRes.status === 200 && Boolean(billRes.data?.id));
    const billId = billRes.data?.id;

    // Toggle Payment status
    const payRes = await request('PATCH', `/bills/${billId}/payment`, { status: 'PAID' }, adminToken);
    record('Billing Management', 'Admin can toggle bill payment status to PAID', payRes.status === 200 && payRes.data?.paymentStatus === 'PAID');

    // Patient views bills
    const patBillsRes = await request('GET', `/bills/patient/${patientId}`, null, patientToken);
    record('Billing Management', 'Patient can view their own bills', patBillsRes.status === 200 && patBillsRes.data?.length > 0);

    // 17. Departments Management
    const deptRes = await request('GET', '/departments', null, adminToken);
    record('Departments', 'List active departments', deptRes.status === 200 && deptRes.data?.length > 0);

    const createDeptRes = await request('POST', '/departments', { name: `Dept_${Date.now()}`, description: 'Specialized diagnostic unit' }, adminToken);
    record('Departments', 'Admin can create department', createDeptRes.status === 200 && Boolean(createDeptRes.data?.id));

    // 18. Patients Profile Update
    const updatePatRes = await request('PUT', `/patients/${patientId}`, {
      phone: '9998887776',
      address: 'Updated Address 101, Mumbai',
      emergencyContact: 'Jane Doe 911',
    }, patientToken);
    record('Patient Profile', 'Patient can update contact & emergency details', updatePatRes.status === 200 && updatePatRes.data?.phone === '9998887776');

    // 19. Appointment Cancellation
    const cancelRes = await request('DELETE', `/appointments/${appt2Id}`, null, patientToken);
    console.log('CANCEL RES RESULT:', cancelRes.status, cancelRes.data);
    record('Appointment Cancellation', 'Patient can cancel their pending appointment', cancelRes.status === 204);

    // Verify status is CANCELLED
    const cancelledApptCheck = await request('GET', `/appointments/${appt2Id}`, null, patientToken);
    record('Appointment Cancellation', 'Cancelled appointment status is updated to CANCELLED', cancelledApptCheck.data?.status === 'CANCELLED');

    // Cannot reschedule CANCELLED appointment
    const cancelReschedule = await request('POST', `/appointments/${appt2Id}/reschedule`, {
      newDate: nextMondayStr,
      newTime: slot1,
      reason: 'Should fail - cancelled',
    }, patientToken);
    record('Reschedule Rules', 'Cancelled appointments cannot be rescheduled (400)', cancelReschedule.status === 400);

    // 20. Admin Dashboard Statistics
    const dashRes = await request('GET', '/admin/dashboard', null, adminToken);
    record('Admin Dashboard', 'Admin dashboard statistics calculate accurately', dashRes.status === 200 && dashRes.data?.totalDoctors > 0 && dashRes.data?.totalPatients > 0);

    // 21. Persistent Disk Storage Verification
    const dataFilePath = path.join(process.cwd(), 'api', 'data', 'hospital_data.json');
    const diskExists = fs.existsSync(dataFilePath);
    if (diskExists) {
      const diskContent = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      const foundInDisk = (diskContent.appointments || []).some(a => Number(a.id) === Number(apptId) && a.appointment_time?.slice(0, 5) === slot2.slice(0, 5));
      const historyInDisk = (diskContent.appointment_history || []).some(h => Number(h.appointment_id) === Number(apptId));
      record('Data Persistence', 'Rescheduled appointment saved permanently on disk', foundInDisk);
      record('Data Persistence', 'Reschedule audit history saved permanently on disk', historyInDisk);
    } else {
      record('Data Persistence', 'Disk file persistence', false, 'Data file not found');
    }

  } catch (err) {
    console.error('Test execution error:', err);
    record('Execution', 'Test script execution without crashing', false, err.message);
  } finally {
    console.log('\n====================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('====================================\n');
    if (failed > 0) process.exit(1);
  }
}

runTests();
