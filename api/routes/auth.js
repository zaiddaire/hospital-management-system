import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, memoryStore, initializeDatabase, saveMemoryStore } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'HospitalManagementSystemSecretKeyForJWTTokenGeneration2024SecureKey';
const JWT_EXPIRATION = Number(process.env.JWT_EXPIRATION) || 86400000;

// POST /api/auth/login
router.post('/login', async (req, res) => {
  await initializeDatabase();
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const pool = await getPool();

  try {
    let user = null;
    let fullName = null;

    if (pool) {
      const [users] = await pool.query(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username, username]
      );
      if (users.length > 0) {
        user = users[0];
        // Fetch full name based on role
        if (user.role === 'DOCTOR') {
          const [docs] = await pool.query('SELECT full_name FROM doctors WHERE user_id = ?', [user.id]);
          if (docs.length > 0) fullName = docs[0].full_name;
        } else if (user.role === 'PATIENT') {
          const [pats] = await pool.query('SELECT full_name FROM patients WHERE user_id = ?', [user.id]);
          if (pats.length > 0) fullName = pats[0].full_name;
        } else if (user.role === 'ADMIN') {
          fullName = 'System Administrator';
        }
      }
    } else {
      user = memoryStore.users.find(u => u.username === username || u.email === username);
      if (user) {
        if (user.role === 'DOCTOR') {
          const doc = memoryStore.doctors.find(d => d.user_id === user.id);
          if (doc) fullName = doc.full_name;
        } else if (user.role === 'PATIENT') {
          const pat = memoryStore.patients.find(p => p.user_id === user.id);
          if (pat) fullName = pat.full_name;
        } else if (user.role === 'ADMIN') {
          fullName = 'System Administrator';
        }
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const payload = {
      sub: user.username,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: fullName || user.username,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: Math.floor(JWT_EXPIRATION / 1000),
    });

    return res.json({
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: fullName || user.username,
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    return res.status(500).json({ message: 'Internal server error during login' });
  }
});

// POST /api/auth/register (Patient registration)
router.post('/register', async (req, res) => {
  await initializeDatabase();
  const { username, email, password, fullName, phone, role } = req.body;

  if (!username || !email || !password || !fullName || !phone) {
    return res.status(400).json({ message: 'All fields (username, email, password, fullName, phone) are required' });
  }

  const assignedRole = role === 'ADMIN' ? 'ADMIN' : (role === 'DOCTOR' ? 'DOCTOR' : 'PATIENT');
  const pool = await getPool();

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    if (pool) {
      // Check existing username or email
      const [existing] = await pool.query(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      );
      if (existing.length > 0) {
        return res.status(400).json({ message: 'Username or email is already registered' });
      }

      const [uRes] = await pool.query(
        'INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, true)',
        [username, email, hashedPassword, assignedRole]
      );
      const userId = uRes.insertId;

      if (assignedRole === 'PATIENT') {
        await pool.query(
          `INSERT INTO patients (user_id, full_name, phone, gender, blood_group)
           VALUES (?, ?, ?, 'OTHER', 'O_POSITIVE')`,
          [userId, fullName, phone]
        );
      }

      const payload = {
        sub: username,
        userId,
        username,
        email,
        role: assignedRole,
        fullName,
      };

      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: Math.floor(JWT_EXPIRATION / 1000),
      });

      return res.status(200).json({
        token,
        userId,
        username,
        email,
        role: assignedRole,
        fullName,
      });
    } else {
      if (memoryStore.users.some(u => u.username === username || u.email === email)) {
        return res.status(400).json({ message: 'Username or email is already registered' });
      }

      const userId = memoryStore.users.length + 1;
      const newUser = {
        id: userId,
        username,
        email,
        password: hashedPassword,
        role: assignedRole,
        is_active: true,
      };
      memoryStore.users.push(newUser);

      if (assignedRole === 'PATIENT') {
        const patId = memoryStore.patients.length + 1;
        memoryStore.patients.push({
          id: patId,
          user_id: userId,
          full_name: fullName,
          phone,
          gender: 'OTHER',
          blood_group: 'O_POSITIVE',
          address: '',
          emergency_contact: '',
        });
      }

      saveMemoryStore();

      const payload = {
        sub: username,
        userId,
        username,
        email,
        role: assignedRole,
        fullName,
      };

      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: Math.floor(JWT_EXPIRATION / 1000),
      });

      return res.json({
        token,
        userId,
        username,
        email,
        role: assignedRole,
        fullName,
      });
    }
  } catch (err) {
    console.error('[AUTH] Registration error:', err);
    return res.status(500).json({ message: 'Internal server error during registration' });
  }
});

export default router;
