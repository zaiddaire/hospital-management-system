import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import departmentsRouter from './routes/departments.js';
import doctorsRouter from './routes/doctors.js';
import patientsRouter from './routes/patients.js';
import appointmentsRouter from './routes/appointments.js';
import medicalRecordsRouter from './routes/medicalRecords.js';
import billsRouter from './routes/bills.js';
import adminRouter from './routes/admin.js';
import { initializeDatabase } from './db.js';

const app = express();

// Enable CORS for all origins with credentials support
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure database is initialized on incoming requests
app.use(async (req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (e) {
    next();
  }
});

// Register routers with and without /api prefix to support both direct and rewritten paths
const routes = [
  ['/auth', authRouter],
  ['/departments', departmentsRouter],
  ['/doctors', doctorsRouter],
  ['/patients', patientsRouter],
  ['/appointments', appointmentsRouter],
  ['/medical-records', medicalRecordsRouter],
  ['/bills', billsRouter],
  ['/admin', adminRouter],
];

for (const [path, router] of routes) {
  app.use(path, router);
  app.use('/api' + path, router);
}

// Health check endpoint
app.get(['/', '/api', '/api/health', '/health'], (req, res) => {
  res.json({
    status: 'UP',
    name: 'MedCore Hospital Management System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default app;
