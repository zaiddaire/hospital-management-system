import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DoctorsPage from './pages/DoctorsPage';
import PatientsPage from './pages/PatientsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import MedicalRecordsPage from './pages/MedicalRecordsPage';
import BillsPage from './pages/BillsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--surface-900)',
            color: 'var(--surface-100)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: 'var(--success)',
              secondary: 'var(--surface-900)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--danger)',
              secondary: 'var(--surface-900)',
            },
          },
        }}
      />
      <Router>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/doctors" element={<DoctorsPage />} />
            <Route
              path="/patients"
              element={
                <ProtectedRoute roles={['ADMIN', 'DOCTOR']}>
                  <PatientsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/medical-records" element={<MedicalRecordsPage />} />
            <Route
              path="/bills"
              element={
                <ProtectedRoute roles={['ADMIN', 'PATIENT']}>
                  <BillsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Root fallback */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
