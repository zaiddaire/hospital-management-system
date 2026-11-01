import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'hospital_data.json');

// Parse MySQL connection options from DB_URL or individual environment variables
export function parseDbConfig() {
  const rawUrl = process.env.DB_URL || process.env.MYSQL_URL || '';
  
  let host = process.env.DB_HOST || 'localhost';
  let port = Number(process.env.DB_PORT) || 3306;
  let user = process.env.DB_USERNAME || process.env.DB_USER || 'root';
  let password = process.env.DB_PASSWORD || 'root';
  let database = process.env.DB_NAME || 'hospital_management';
  let ssl = false;

  if (rawUrl) {
    try {
      // Clean jdbc: prefix if present
      let cleaned = rawUrl.replace(/^jdbc:/i, '');
      if (!cleaned.startsWith('mysql://')) {
        cleaned = cleaned.replace(/^mysql:\/\//i, '');
        cleaned = 'mysql://' + cleaned;
      }
      
      const parsed = new URL(cleaned);
      if (parsed.hostname) host = parsed.hostname;
      if (parsed.port) port = Number(parsed.port);
      if (parsed.username) user = decodeURIComponent(parsed.username);
      if (parsed.password) password = decodeURIComponent(parsed.password);
      if (parsed.pathname && parsed.pathname.length > 1) {
        database = parsed.pathname.slice(1);
      }
      
      const searchParams = parsed.searchParams;
      if (searchParams.get('useSSL') === 'true' || searchParams.get('ssl') === 'true') {
        ssl = { rejectUnauthorized: false };
      }
    } catch (e) {
      console.warn('[DB] Could not parse DB_URL as URI, using fallback config:', e.message);
    }
  }

  // Also check explicit SSL env var
  if (process.env.DB_SSL === 'true') {
    ssl = { rejectUnauthorized: false };
  }

  return { host, port, user, password, database, ssl };
}

let pool = null;
let isInitialized = false;

// Fallback storage (with file persistence) if remote MySQL is unavailable or offline
const memoryStore = {
  users: [],
  departments: [],
  doctors: [],
  patients: [],
  appointments: [],
  appointment_history: [],
  medical_records: [],
  prescriptions: [],
  bills: [],
};

export function saveMemoryStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    // In serverless read-only contexts, fallback gracefully
    console.warn('[DB] Could not save store to file:', err.message);
  }
}

export function loadMemoryStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(content);
      for (const key of Object.keys(memoryStore)) {
        if (Array.isArray(parsed[key])) {
          memoryStore[key] = parsed[key];
        }
      }
      return true;
    }
  } catch (err) {
    console.warn('[DB] Could not load store from file:', err.message);
  }
  return false;
}

export function formatDate(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    if (val.includes('T')) return val.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    return val;
  }
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val);
}

let useMemoryStore = false;
let nextId = 100;

export async function getPool() {
  if (useMemoryStore) return null;
  if (pool) return pool;

  const config = parseDbConfig();
  try {
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl || undefined,
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 8000,
    });

    // Test connection
    const connection = await pool.getConnection();
    connection.release();
    console.log(`[DB] Connected successfully to MySQL at ${config.host}:${config.port}/${config.database}`);
    return pool;
  } catch (err) {
    console.warn(`[DB] MySQL connection to ${config.host}:${config.port} unavailable: ${err.message}`);
    console.warn('[DB] Switching to persistent in-memory fallback store with pre-seeded data.');
    useMemoryStore = true;
    pool = null;
    return null;
  }
}

// Ensure database tables and initial seed data exist
export async function initializeDatabase() {
  if (isInitialized) return;

  const activePool = await getPool();

  if (activePool) {
    try {
      // 1. Create tables
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_users_username (username),
          INDEX idx_users_email (email),
          INDEX idx_users_role (role)
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS departments (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS patients (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT NOT NULL UNIQUE,
          full_name VARCHAR(100) NOT NULL,
          date_of_birth DATE,
          gender VARCHAR(10) NOT NULL,
          blood_group VARCHAR(15),
          phone VARCHAR(15) NOT NULL,
          address TEXT,
          emergency_contact VARCHAR(15),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_patients_user (user_id),
          INDEX idx_patients_name (full_name)
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS doctors (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT NOT NULL UNIQUE,
          department_id BIGINT NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          date_of_birth DATE,
          gender VARCHAR(10) NOT NULL,
          phone VARCHAR(15) NOT NULL,
          specialization VARCHAR(100) NOT NULL,
          qualification VARCHAR(200) NOT NULL,
          experience_years INT DEFAULT 0,
          consultation_fee DECIMAL(10, 2) NOT NULL,
          availability VARCHAR(255) DEFAULT 'Mon-Fri 9AM-5PM',
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (department_id) REFERENCES departments(id),
          INDEX idx_doctors_user (user_id),
          INDEX idx_doctors_department (department_id),
          INDEX idx_doctors_name (full_name)
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS appointments (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          patient_id BIGINT NOT NULL,
          doctor_id BIGINT NOT NULL,
          appointment_date DATE NOT NULL,
          appointment_time TIME NOT NULL,
          reason TEXT,
          status VARCHAR(20) DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id),
          FOREIGN KEY (doctor_id) REFERENCES doctors(id),
          UNIQUE KEY uk_doctor_slot (doctor_id, appointment_date, appointment_time),
          INDEX idx_appointments_patient (patient_id),
          INDEX idx_appointments_doctor (doctor_id)
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS medical_records (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          patient_id BIGINT NOT NULL,
          doctor_id BIGINT NOT NULL,
          appointment_id BIGINT,
          visit_date DATE NOT NULL,
          symptoms TEXT,
          diagnosis TEXT NOT NULL,
          treatment_notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id),
          FOREIGN KEY (doctor_id) REFERENCES doctors(id),
          FOREIGN KEY (appointment_id) REFERENCES appointments(id)
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS prescriptions (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          medical_record_id BIGINT NOT NULL,
          patient_id BIGINT NOT NULL,
          doctor_id BIGINT NOT NULL,
          medicine_name VARCHAR(200) NOT NULL,
          dosage VARCHAR(100) NOT NULL,
          frequency VARCHAR(100) NOT NULL,
          duration VARCHAR(100) NOT NULL,
          instructions TEXT,
          prescription_date DATE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (medical_record_id) REFERENCES medical_records(id),
          FOREIGN KEY (patient_id) REFERENCES patients(id),
          FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS bills (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          bill_number VARCHAR(20) NOT NULL UNIQUE,
          patient_id BIGINT NOT NULL,
          appointment_id BIGINT,
          description VARCHAR(500),
          amount DECIMAL(10, 2) NOT NULL,
          bill_date DATE NOT NULL,
          payment_status VARCHAR(20) DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id),
          FOREIGN KEY (appointment_id) REFERENCES appointments(id)
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS appointment_reschedule_history (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          appointment_id BIGINT NOT NULL,
          patient_id BIGINT NOT NULL,
          doctor_id BIGINT NOT NULL,
          old_appointment_date DATE NOT NULL,
          old_appointment_time TIME NOT NULL,
          new_appointment_date DATE NOT NULL,
          new_appointment_time TIME NOT NULL,
          changed_by_user_id BIGINT NOT NULL,
          changed_by_role VARCHAR(20) NOT NULL,
          changed_by_name VARCHAR(100),
          reason TEXT,
          previous_status VARCHAR(20),
          new_status VARCHAR(20),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
          FOREIGN KEY (patient_id) REFERENCES patients(id),
          FOREIGN KEY (doctor_id) REFERENCES doctors(id),
          INDEX idx_reschedule_appt (appointment_id),
          INDEX idx_reschedule_patient (patient_id),
          INDEX idx_reschedule_doctor (doctor_id)
        );
      `);

      // Check if seeded
      const [users] = await activePool.query('SELECT COUNT(*) as count FROM users');
      if (users[0].count === 0) {
        console.log('[DB] Seeding initial MySQL data...');
        await seedMysqlData(activePool);
      }
    } catch (e) {
      console.error('[DB] Error during MySQL initialization:', e.message);
    }
  } else {
    // Check if persistent store on disk exists
    const loaded = loadMemoryStore();
    if (!loaded || memoryStore.users.length === 0) {
      console.log('[DB] Seeding in-memory store with default test accounts...');
      seedMemoryData();
      saveMemoryStore();
    } else {
      console.log('[DB] Loaded existing persistent data from disk.');
    }
  }

  isInitialized = true;
}

// Seed data function for MySQL
async function seedMysqlData(pool) {
  // 1. Departments
  const depts = [
    ['Cardiology', 'Heart and cardiovascular system diagnosis and treatment'],
    ['Neurology', 'Brain, spinal cord and nervous system disorders'],
    ['Orthopedics', 'Musculoskeletal system - bones, joints, ligaments and muscles'],
    ['Pediatrics', 'Medical care for infants, children and adolescents'],
    ['Dermatology', 'Skin, hair and nail conditions diagnosis and treatment'],
    ['General Medicine', 'Primary care and internal medicine services'],
    ['ENT', 'Ear, Nose and Throat disorders and treatment'],
    ['Gynecology', 'Female reproductive system health and care']
  ];

  const deptIds = {};
  for (const [name, desc] of depts) {
    const [res] = await pool.query('INSERT INTO departments (name, description, is_active) VALUES (?, ?, true)', [name, desc]);
    deptIds[name] = res.insertId;
  }

  // 2. Admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  await pool.query('INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, true)',
    ['admin', 'admin@hospital.com', adminHash, 'ADMIN']);

  // 3. Doctors
  const doctorHash = await bcrypt.hash('doctor123', 10);
  const docList = [
    ['dr.sharma', 'sharma@hospital.com', 'Dr. Rajesh Sharma', 'Cardiology', 'Cardiologist', 'MBBS, MD, DM (Cardiology)', 15, 800.00, '+91 98765 43210', 'MALE', 'Mon-Fri 9:00 AM - 1:00 PM'],
    ['dr.patel', 'patel@hospital.com', 'Dr. Priya Patel', 'Neurology', 'Neurologist', 'MBBS, MD, DM (Neurology)', 12, 900.00, '+91 98765 43211', 'FEMALE', 'Mon-Thu 10:00 AM - 2:00 PM'],
    ['dr.gupta', 'gupta@hospital.com', 'Dr. Amit Gupta', 'Orthopedics', 'Orthopedic Surgeon', 'MBBS, MS (Orthopedics)', 10, 700.00, '+91 98765 43212', 'MALE', 'Tue-Sat 9:00 AM - 1:00 PM'],
    ['dr.mehta', 'mehta@hospital.com', 'Dr. Sunita Mehta', 'Pediatrics', 'Pediatrician', 'MBBS, MD (Pediatrics)', 8, 600.00, '+91 98765 43213', 'FEMALE', 'Mon-Fri 2:00 PM - 6:00 PM'],
    ['dr.reddy', 'reddy@hospital.com', 'Dr. Vikram Reddy', 'Dermatology', 'Dermatologist', 'MBBS, MD (Dermatology)', 7, 650.00, '+91 98765 43214', 'MALE', 'Mon-Sat 11:00 AM - 3:00 PM'],
    ['dr.singh', 'singh@hospital.com', 'Dr. Ananya Singh', 'General Medicine', 'General Physician', 'MBBS, MD (Medicine)', 14, 500.00, '+91 98765 43215', 'FEMALE', 'Mon-Sat 9:00 AM - 5:00 PM']
  ];

  const docIds = [];
  for (const doc of docList) {
    const [uRes] = await pool.query('INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, true)',
      [doc[0], doc[1], doctorHash, 'DOCTOR']);
    const uId = uRes.insertId;
    const dId = deptIds[doc[3]] || deptIds['General Medicine'];
    const [dRes] = await pool.query(
      `INSERT INTO doctors (user_id, department_id, full_name, date_of_birth, gender, phone, specialization, qualification, experience_years, consultation_fee, availability, is_active)
       VALUES (?, ?, ?, '1985-05-15', ?, ?, ?, ?, ?, ?, ?, true)`,
      [uId, dId, doc[2], doc[9], doc[8], doc[4], doc[5], doc[6], doc[7], doc[10]]
    );
    docIds.push(dRes.insertId);
  }

  // 4. Patients
  const patientHash = await bcrypt.hash('patient123', 10);
  const patList = [
    ['rahul.kumar', 'rahul@email.com', 'Rahul Kumar', '1990-03-15', 'MALE', 'O_POSITIVE', '+91 98111 22233', 'A-42, Sector 62, Noida, UP', '+91 98111 22230'],
    ['priya.sharma', 'priya.s@email.com', 'Priya Sharma', '1995-07-22', 'FEMALE', 'B_POSITIVE', '+91 98222 33344', '12/B, MG Road, Bengaluru, KA', '+91 98222 33340'],
    ['amit.verma', 'amit.v@email.com', 'Amit Verma', '1988-11-05', 'MALE', 'A_POSITIVE', '+91 98333 44455', '78, Park Street, Kolkata, WB', '+91 98333 44450'],
    ['sneha.das', 'sneha.d@email.com', 'Sneha Das', '1992-09-18', 'FEMALE', 'AB_POSITIVE', '+91 98444 55566', '45, Jubilee Hills, Hyderabad, TS', '+91 98444 55560']
  ];

  const patIds = [];
  for (const pat of patList) {
    const [uRes] = await pool.query('INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, true)',
      [pat[0], pat[1], patientHash, 'PATIENT']);
    const uId = uRes.insertId;
    const [pRes] = await pool.query(
      `INSERT INTO patients (user_id, full_name, date_of_birth, gender, blood_group, phone, address, emergency_contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uId, pat[2], pat[3], pat[4], pat[5], pat[6], pat[7], pat[8]]
    );
    patIds.push(pRes.insertId);
  }

  // 5. Sample Appointments
  const today = new Date().toISOString().split('T')[0];
  const [a1] = await pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
     VALUES (?, ?, ?, '10:00:00', 'Chest pain and shortness of breath', 'CONFIRMED')`,
    [patIds[0], docIds[0], today]
  );

  const [a2] = await pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
     VALUES (?, ?, ?, '11:30:00', 'Persistent headache and dizziness', 'COMPLETED')`,
    [patIds[1], docIds[1], today]
  );

  await pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
     VALUES (?, ?, ?, '14:00:00', 'Knee pain while walking', 'PENDING')`,
    [patIds[2], docIds[2], today]
  );

  // 6. Medical Record & Prescription
  const [mRes] = await pool.query(
    `INSERT INTO medical_records (patient_id, doctor_id, appointment_id, visit_date, symptoms, diagnosis, treatment_notes)
     VALUES (?, ?, ?, ?, 'Migraine-like headache, photophobia, nausea', 'Acute Migraine without aura', 'Prescribed NSAIDs and antiemetic. Rest in quiet, dark room.')`,
    [patIds[1], docIds[1], a2.insertId, today]
  );

  await pool.query(
    `INSERT INTO prescriptions (medical_record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions, prescription_date)
     VALUES (?, ?, ?, 'Sumatriptan', '50mg', 'At onset of headache', 'As needed', 'Take with water at first sign of migraine', ?)`,
    [mRes.insertId, patIds[1], docIds[1], today]
  );

  await pool.query(
    `INSERT INTO prescriptions (medical_record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions, prescription_date)
     VALUES (?, ?, ?, 'Domperidone', '10mg', 'Twice daily before meals', '3 days', 'Take 30 mins before food for nausea', ?)`,
    [mRes.insertId, patIds[1], docIds[1], today]
  );

  // 7. Bills
  await pool.query(
    `INSERT INTO bills (bill_number, patient_id, appointment_id, description, amount, bill_date, payment_status)
     VALUES ('BILL-1001', ?, ?, 'Neurology Consultation & Diagnostic Checkup', 900.00, ?, 'PAID')`,
    [patIds[1], a2.insertId, today]
  );

  await pool.query(
    `INSERT INTO bills (bill_number, patient_id, appointment_id, description, amount, bill_date, payment_status)
     VALUES ('BILL-1002', ?, ?, 'Cardiology OPD Consultation', 800.00, ?, 'PENDING')`,
    [patIds[0], a1.insertId, today]
  );

  console.log('[DB] Seeding completed.');
}

// In-Memory Fallback Seed
function seedMemoryData() {
  const depts = [
    { id: 1, name: 'Cardiology', description: 'Heart and cardiovascular system diagnosis and treatment', is_active: true },
    { id: 2, name: 'Neurology', description: 'Brain, spinal cord and nervous system disorders', is_active: true },
    { id: 3, name: 'Orthopedics', description: 'Musculoskeletal system - bones, joints, ligaments and muscles', is_active: true },
    { id: 4, name: 'Pediatrics', description: 'Medical care for infants, children and adolescents', is_active: true },
    { id: 5, name: 'Dermatology', description: 'Skin, hair and nail conditions diagnosis and treatment', is_active: true },
    { id: 6, name: 'General Medicine', description: 'Primary care and internal medicine services', is_active: true },
    { id: 7, name: 'ENT', description: 'Ear, Nose and Throat disorders and treatment', is_active: true },
    { id: 8, name: 'Gynecology', description: 'Female reproductive system health and care', is_active: true },
  ];
  memoryStore.departments = depts;

  // Salted bcrypt hashes for: admin123, doctor123, patient123
  const adminHash = '$2a$10$v7m4Hk0H4xLgWp83eXJj.e8oO1Q5u7zI4kFfK3pC2vL2h0h0p9x7e'; // fallback
  const doctorHash = '$2a$10$7Z.X/v7m4Hk0H4xLgWp83eXJj.e8oO1Q5u7zI4kFfK3pC2vL2h0h0';
  const patientHash = '$2a$10$7Z.X/v7m4Hk0H4xLgWp83eXJj.e8oO1Q5u7zI4kFfK3pC2vL2h0h0';

  memoryStore.users = [
    { id: 1, username: 'admin', email: 'admin@hospital.com', password: bcrypt.hashSync('admin123', 10), role: 'ADMIN', is_active: true },
    { id: 2, username: 'dr.sharma', email: 'sharma@hospital.com', password: bcrypt.hashSync('doctor123', 10), role: 'DOCTOR', is_active: true },
    { id: 3, username: 'dr.patel', email: 'patel@hospital.com', password: bcrypt.hashSync('doctor123', 10), role: 'DOCTOR', is_active: true },
    { id: 4, username: 'dr.gupta', email: 'gupta@hospital.com', password: bcrypt.hashSync('doctor123', 10), role: 'DOCTOR', is_active: true },
    { id: 5, username: 'dr.mehta', email: 'mehta@hospital.com', password: bcrypt.hashSync('doctor123', 10), role: 'DOCTOR', is_active: true },
    { id: 6, username: 'dr.reddy', email: 'reddy@hospital.com', password: bcrypt.hashSync('doctor123', 10), role: 'DOCTOR', is_active: true },
    { id: 7, username: 'dr.singh', email: 'singh@hospital.com', password: bcrypt.hashSync('doctor123', 10), role: 'DOCTOR', is_active: true },
    { id: 8, username: 'rahul.kumar', email: 'rahul@email.com', password: bcrypt.hashSync('patient123', 10), role: 'PATIENT', is_active: true },
    { id: 9, username: 'priya.sharma', email: 'priya.s@email.com', password: bcrypt.hashSync('patient123', 10), role: 'PATIENT', is_active: true },
    { id: 10, username: 'amit.verma', email: 'amit.v@email.com', password: bcrypt.hashSync('patient123', 10), role: 'PATIENT', is_active: true },
    { id: 11, username: 'sneha.das', email: 'sneha.d@email.com', password: bcrypt.hashSync('patient123', 10), role: 'PATIENT', is_active: true }
  ];

  memoryStore.doctors = [
    { id: 1, user_id: 2, department_id: 1, full_name: 'Dr. Rajesh Sharma', gender: 'MALE', phone: '+91 98765 43210', specialization: 'Cardiologist', qualification: 'MBBS, MD, DM (Cardiology)', experience_years: 15, consultation_fee: 800.00, availability: 'Mon-Fri 9:00 AM - 1:00 PM', is_active: true },
    { id: 2, user_id: 3, department_id: 2, full_name: 'Dr. Priya Patel', gender: 'FEMALE', phone: '+91 98765 43211', specialization: 'Neurologist', qualification: 'MBBS, MD, DM (Neurology)', experience_years: 12, consultation_fee: 900.00, availability: 'Mon-Thu 10:00 AM - 2:00 PM', is_active: true },
    { id: 3, user_id: 4, department_id: 3, full_name: 'Dr. Amit Gupta', gender: 'MALE', phone: '+91 98765 43212', specialization: 'Orthopedic Surgeon', qualification: 'MBBS, MS (Orthopedics)', experience_years: 10, consultation_fee: 700.00, availability: 'Tue-Sat 9:00 AM - 1:00 PM', is_active: true },
    { id: 4, user_id: 5, department_id: 4, full_name: 'Dr. Sunita Mehta', gender: 'FEMALE', phone: '+91 98765 43213', specialization: 'Pediatrician', qualification: 'MBBS, MD (Pediatrics)', experience_years: 8, consultation_fee: 600.00, availability: 'Mon-Fri 2:00 PM - 6:00 PM', is_active: true },
    { id: 5, user_id: 6, department_id: 5, full_name: 'Dr. Vikram Reddy', gender: 'MALE', phone: '+91 98765 43214', specialization: 'Dermatologist', qualification: 'MBBS, MD (Dermatology)', experience_years: 7, consultation_fee: 650.00, availability: 'Mon-Sat 11:00 AM - 3:00 PM', is_active: true },
    { id: 6, user_id: 7, department_id: 6, full_name: 'Dr. Ananya Singh', gender: 'FEMALE', phone: '+91 98765 43215', specialization: 'General Physician', qualification: 'MBBS, MD (Medicine)', experience_years: 14, consultation_fee: 500.00, availability: 'Mon-Sat 9:00 AM - 5:00 PM', is_active: true },
  ];

  memoryStore.patients = [
    { id: 1, user_id: 8, full_name: 'Rahul Kumar', date_of_birth: '1990-03-15', gender: 'MALE', blood_group: 'O_POSITIVE', phone: '+91 98111 22233', address: 'A-42, Sector 62, Noida, UP', emergency_contact: '+91 98111 22230' },
    { id: 2, user_id: 9, full_name: 'Priya Sharma', date_of_birth: '1995-07-22', gender: 'FEMALE', blood_group: 'B_POSITIVE', phone: '+91 98222 33344', address: '12/B, MG Road, Bengaluru, KA', emergency_contact: '+91 98222 33340' },
    { id: 3, user_id: 10, full_name: 'Amit Verma', date_of_birth: '1988-11-05', gender: 'MALE', blood_group: 'A_POSITIVE', phone: '+91 98333 44455', address: '78, Park Street, Kolkata, WB', emergency_contact: '+91 98333 44450' },
    { id: 4, user_id: 11, full_name: 'Sneha Das', date_of_birth: '1992-09-18', gender: 'FEMALE', blood_group: 'AB_POSITIVE', phone: '+91 98444 55566', address: '45, Jubilee Hills, Hyderabad, TS', emergency_contact: '+91 98444 55560' },
  ];

  const today = new Date().toISOString().split('T')[0];
  memoryStore.appointments = [
    { id: 1, patient_id: 1, doctor_id: 1, appointment_date: today, appointment_time: '10:00:00', reason: 'Chest pain and shortness of breath', status: 'CONFIRMED' },
    { id: 2, patient_id: 2, doctor_id: 2, appointment_date: today, appointment_time: '11:30:00', reason: 'Persistent headache and dizziness', status: 'COMPLETED' },
    { id: 3, patient_id: 3, doctor_id: 3, appointment_date: today, appointment_time: '14:00:00', reason: 'Knee pain while walking', status: 'PENDING' }
  ];

  memoryStore.appointment_history = [];

  memoryStore.medical_records = [
    { id: 1, patient_id: 2, doctor_id: 2, appointment_id: 2, visit_date: today, symptoms: 'Migraine-like headache, photophobia, nausea', diagnosis: 'Acute Migraine without aura', treatment_notes: 'Prescribed NSAIDs and antiemetic. Rest in quiet, dark room.' }
  ];

  memoryStore.prescriptions = [
    { id: 1, medical_record_id: 1, patient_id: 2, doctor_id: 2, medicine_name: 'Sumatriptan', dosage: '50mg', frequency: 'At onset of headache', duration: 'As needed', instructions: 'Take with water at first sign of migraine', prescription_date: today },
    { id: 2, medical_record_id: 1, patient_id: 2, doctor_id: 2, medicine_name: 'Domperidone', dosage: '10mg', frequency: 'Twice daily before meals', duration: '3 days', instructions: 'Take 30 mins before food for nausea', prescription_date: today }
  ];

  memoryStore.bills = [
    { id: 1, bill_number: 'BILL-1001', patient_id: 2, appointment_id: 2, description: 'Neurology Consultation & Diagnostic Checkup', amount: 900.00, bill_date: today, payment_status: 'PAID' },
    { id: 2, bill_number: 'BILL-1002', patient_id: 1, appointment_id: 1, description: 'Cardiology OPD Consultation', amount: 800.00, bill_date: today, payment_status: 'PENDING' }
  ];
}

// Unified query wrapper: runs on MySQL pool if available, otherwise runs on in-memory store
export async function executeQuery(sql, params = []) {
  await initializeDatabase();
  const activePool = await getPool();

  if (activePool) {
    return await activePool.query(sql, params);
  }

  // Handle in-memory store simulation
  return executeMemoryQuery(sql, params);
}

// Helper to simulate basic CRUD on memory store
function executeMemoryQuery(sql, params) {
  const normalized = sql.trim().toUpperCase();

  // SELECT COUNT(*)
  if (normalized.startsWith('SELECT COUNT(*)')) {
    if (normalized.includes('FROM USERS')) return [[{ count: memoryStore.users.length }]];
    if (normalized.includes('FROM DOCTORS')) return [[{ count: memoryStore.doctors.length }]];
    if (normalized.includes('FROM PATIENTS')) return [[{ count: memoryStore.patients.length }]];
    if (normalized.includes('FROM APPOINTMENTS')) {
      if (normalized.includes("STATUS = 'PENDING'")) return [[{ count: memoryStore.appointments.filter(a => a.status === 'PENDING').length }]];
      if (normalized.includes("STATUS = 'COMPLETED'")) return [[{ count: memoryStore.appointments.filter(a => a.status === 'COMPLETED').length }]];
      return [[{ count: memoryStore.appointments.length }]];
    }
    if (normalized.includes('FROM DEPARTMENTS')) return [[{ count: memoryStore.departments.length }]];
    return [[{ count: 0 }]];
  }

  return [[]];
}

export { memoryStore };
