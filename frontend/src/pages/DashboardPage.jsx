import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import {
  Stethoscope, Users, Calendar, Clock, CheckCircle2,
  Building2, Plus, ArrowUpRight, Receipt, FileText, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, isAdmin, isDoctor, isPatient } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [doctorData, setDoctorData] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (isAdmin()) {
        const [statsRes, apptRes] = await Promise.allSettled([
          api.get('/admin/dashboard'),
          api.get('/appointments'),
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        if (apptRes.status === 'fulfilled') setRecentAppointments(apptRes.value.data.slice(0, 5));
      } else if (isDoctor()) {
        // Fetch doctor info by userId
        try {
          const docRes = await api.get(`/doctors/user/${user.userId}`);
          setDoctorData(docRes.data);
          if (docRes.data?.id) {
            const apptRes = await api.get(`/appointments/doctor/${docRes.data.id}`);
            setRecentAppointments(apptRes.data.slice(0, 5));
          }
        } catch (e) {
          console.warn('Doctor profile not yet created or error:', e);
        }
      } else if (isPatient()) {
        // Fetch patient info by userId
        try {
          const patRes = await api.get(`/patients/user/${user.userId}`);
          setPatientData(patRes.data);
          if (patRes.data?.id) {
            const [apptRes, billRes] = await Promise.allSettled([
              api.get(`/appointments/patient/${patRes.data.id}`),
              api.get(`/bills/patient/${patRes.data.id}`),
            ]);
            if (apptRes.status === 'fulfilled') setRecentAppointments(apptRes.value.data.slice(0, 5));
            if (billRes.status === 'fulfilled') setBills(billRes.value.data);
          }
        } catch (e) {
          console.warn('Patient profile not yet created or error:', e);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load some dashboard details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    return <span className={`badge badge-${s}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Top Welcome Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <h2>Dashboard Overview</h2>
        </div>
        <div className="topbar-right">
          <span style={{ fontSize: '13px', color: 'var(--surface-400)' }}>
            Signed in as <strong style={{ color: 'var(--surface-100)' }}>{user?.fullName || user?.username}</strong> ({user?.role})
          </span>
        </div>
      </header>

      <div className="page-content fade-in">
        {/* ===================== ADMIN DASHBOARD ===================== */}
        {isAdmin() && (
          <>
            <div className="stats-grid">
              <div className="stat-card teal">
                <div className="stat-icon teal"><Stethoscope size={24} /></div>
                <div className="stat-value">{stats?.totalDoctors ?? 0}</div>
                <div className="stat-label">Total Doctors</div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green"><Users size={24} /></div>
                <div className="stat-value">{stats?.totalPatients ?? 0}</div>
                <div className="stat-label">Registered Patients</div>
              </div>
              <div className="stat-card blue">
                <div className="stat-icon blue"><Calendar size={24} /></div>
                <div className="stat-value">{stats?.totalAppointments ?? 0}</div>
                <div className="stat-label">Total Appointments</div>
              </div>
              <div className="stat-card amber">
                <div className="stat-icon amber"><Clock size={24} /></div>
                <div className="stat-value">{stats?.pendingAppointments ?? 0}</div>
                <div className="stat-label">Pending Appointments</div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon purple"><CheckCircle2 size={24} /></div>
                <div className="stat-value">{stats?.completedAppointments ?? 0}</div>
                <div className="stat-label">Completed Visits</div>
              </div>
              <div className="stat-card rose">
                <div className="stat-icon rose"><Building2 size={24} /></div>
                <div className="stat-value">{stats?.totalDepartments ?? 0}</div>
                <div className="stat-label">Active Departments</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
              <Link to="/doctors" className="btn btn-primary">
                <Plus size={18} /> Manage Doctors
              </Link>
              <Link to="/departments" className="btn btn-secondary">
                <Building2 size={18} /> Departments
              </Link>
              <Link to="/appointments" className="btn btn-secondary">
                <Calendar size={18} /> All Appointments
              </Link>
              <Link to="/bills" className="btn btn-secondary">
                <Receipt size={18} /> Billing & Invoices
              </Link>
            </div>

            {/* Recent Appointments Table */}
            <div className="card">
              <div className="card-header">
                <h3>Recent Appointments</h3>
                <Link to="/appointments" className="btn btn-sm btn-secondary">
                  View All <ArrowUpRight size={14} />
                </Link>
              </div>

              {recentAppointments.length === 0 ? (
                <div className="empty-state">
                  <Calendar />
                  <h3>No Appointments Yet</h3>
                  <p>When appointments are scheduled, they will show up here.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Department</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAppointments.map((appt) => (
                        <tr key={appt.id}>
                          <td>#{appt.id}</td>
                          <td><strong>{appt.patientName}</strong></td>
                          <td>Dr. {appt.doctorName}</td>
                          <td>{appt.departmentName || 'General'}</td>
                          <td>{appt.appointmentDate} at {appt.appointmentTime}</td>
                          <td>{getStatusBadge(appt.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================== DOCTOR DASHBOARD ===================== */}
        {isDoctor() && (
          <>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--surface-50)' }}>
                Welcome, Dr. {user?.fullName || doctorData?.fullName || user?.username}
              </h2>
              <p style={{ color: 'var(--surface-400)', fontSize: '14px', marginTop: '4px' }}>
                {doctorData?.specialization ? `${doctorData.specialization} • ${doctorData.departmentName || 'Medical Dept'}` : 'Manage your upcoming consultations and patient records'}
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-card teal">
                <div className="stat-icon teal"><Calendar size={24} /></div>
                <div className="stat-value">{recentAppointments.length}</div>
                <div className="stat-label">Scheduled Consultations</div>
              </div>
              <div className="stat-card amber">
                <div className="stat-icon amber"><Clock size={24} /></div>
                <div className="stat-value">
                  {recentAppointments.filter(a => a.status === 'PENDING').length}
                </div>
                <div className="stat-label">Pending Approval</div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green"><CheckCircle2 size={24} /></div>
                <div className="stat-value">
                  {recentAppointments.filter(a => a.status === 'CONFIRMED' || a.status === 'COMPLETED').length}
                </div>
                <div className="stat-label">Confirmed / Completed</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
              <Link to="/appointments" className="btn btn-primary">
                <Calendar size={18} /> View Appointments
              </Link>
              <Link to="/medical-records" className="btn btn-secondary">
                <FileText size={18} /> Create Medical Record
              </Link>
              <Link to="/patients" className="btn btn-secondary">
                <Users size={18} /> Patient Directory
              </Link>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Upcoming Appointments</h3>
                <Link to="/appointments" className="btn btn-sm btn-secondary">
                  Manage <ArrowUpRight size={14} />
                </Link>
              </div>

              {recentAppointments.length === 0 ? (
                <div className="empty-state">
                  <Calendar />
                  <h3>No Appointments Scheduled</h3>
                  <p>You have no appointments assigned at this time.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAppointments.map((appt) => (
                        <tr key={appt.id}>
                          <td><strong>{appt.patientName}</strong></td>
                          <td>{appt.appointmentDate}</td>
                          <td>{appt.appointmentTime}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {appt.reason || 'General Checkup'}
                          </td>
                          <td>{getStatusBadge(appt.status)}</td>
                          <td>
                            <Link to="/appointments" className="btn btn-sm btn-secondary">
                              Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================== PATIENT DASHBOARD ===================== */}
        {isPatient() && (
          <>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--surface-50)' }}>
                Hello, {user?.fullName || user?.username}!
              </h2>
              <p style={{ color: 'var(--surface-400)', fontSize: '14px', marginTop: '4px' }}>
                Track your upcoming consultations, medical records, and billing status in one place.
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-card teal">
                <div className="stat-icon teal"><Calendar size={24} /></div>
                <div className="stat-value">{recentAppointments.length}</div>
                <div className="stat-label">My Appointments</div>
              </div>
              <div className="stat-card rose">
                <div className="stat-icon rose"><Receipt size={24} /></div>
                <div className="stat-value">
                  {bills.filter(b => b.paymentStatus !== 'PAID').length}
                </div>
                <div className="stat-label">Pending Bills</div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green"><FileText size={24} /></div>
                <div className="stat-value">{recentAppointments.filter(a => a.status === 'COMPLETED').length}</div>
                <div className="stat-label">Completed Visits</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
              <Link to="/appointments" className="btn btn-primary">
                <Plus size={18} /> Book Appointment
              </Link>
              <Link to="/doctors" className="btn btn-secondary">
                <Stethoscope size={18} /> Find Doctors
              </Link>
              <Link to="/medical-records" className="btn btn-secondary">
                <FileText size={18} /> My Medical Records
              </Link>
              <Link to="/bills" className="btn btn-secondary">
                <Receipt size={18} /> View Bills
              </Link>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>My Recent Appointments</h3>
                <Link to="/appointments" className="btn btn-sm btn-secondary">
                  View All <ArrowUpRight size={14} />
                </Link>
              </div>

              {recentAppointments.length === 0 ? (
                <div className="empty-state">
                  <Calendar />
                  <h3>No Appointments Booked</h3>
                  <p>You haven't scheduled any appointments yet. Click below to book your first doctor visit.</p>
                  <Link to="/appointments" className="btn btn-primary" style={{ marginTop: 16 }}>
                    Book Appointment Now
                  </Link>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Department</th>
                        <th>Date & Time</th>
                        <th>Reason</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAppointments.map((appt) => (
                        <tr key={appt.id}>
                          <td><strong>Dr. {appt.doctorName}</strong></td>
                          <td>{appt.departmentName || 'Medical'}</td>
                          <td>{appt.appointmentDate} at {appt.appointmentTime}</td>
                          <td>{appt.reason || 'General Consultation'}</td>
                          <td>{getStatusBadge(appt.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
