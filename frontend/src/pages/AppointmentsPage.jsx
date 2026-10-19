import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Calendar, Clock, User, Stethoscope, Plus,
  CheckCircle, XCircle, AlertTriangle, Search, X, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AppointmentsPage() {
  const { user, isAdmin, isDoctor, isPatient } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Booking Modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookForm, setBookForm] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '10:00:00',
    reason: '',
  });

  useEffect(() => {
    initPage();
  }, [user]);

  // Handle passed state (e.g. from doctors page)
  useEffect(() => {
    if (location.state?.doctorId) {
      setBookForm((prev) => ({
        ...prev,
        doctorId: location.state.doctorId,
      }));
      setShowBookModal(true);
    }
  }, [location.state]);

  const initPage = async () => {
    setLoading(true);
    try {
      // Load doctors list for dropdowns
      const docRes = await api.get('/doctors');
      setDoctors(docRes.data);

      if (isAdmin()) {
        const [appts, pats] = await Promise.all([
          api.get('/appointments'),
          api.get('/patients'),
        ]);
        setAppointments(appts.data);
        setPatients(pats.data);
      } else if (isDoctor()) {
        const docProfile = await api.get(`/doctors/user/${user.userId}`);
        setCurrentDoctor(docProfile.data);
        if (docProfile.data?.id) {
          const appts = await api.get(`/appointments/doctor/${docProfile.data.id}`);
          setAppointments(appts.data);
        }
      } else if (isPatient()) {
        const patProfile = await api.get(`/patients/user/${user.userId}`);
        setCurrentPatient(patProfile.data);
        if (patProfile.data?.id) {
          const appts = await api.get(`/appointments/patient/${patProfile.data.id}`);
          setAppointments(appts.data);
          setBookForm((prev) => ({ ...prev, patientId: patProfile.data.id }));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const reloadAppointments = async () => {
    try {
      if (isAdmin()) {
        const res = await api.get('/appointments');
        setAppointments(res.data);
      } else if (isDoctor() && currentDoctor) {
        const res = await api.get(`/appointments/doctor/${currentDoctor.id}`);
        setAppointments(res.data);
      } else if (isPatient() && currentPatient) {
        const res = await api.get(`/appointments/patient/${currentPatient.id}`);
        setAppointments(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status: newStatus });
      toast.success(`Appointment marked as ${newStatus}`);
      reloadAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      toast.success('Appointment cancelled');
      reloadAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    try {
      // Ensure time has seconds format HH:mm:ss
      let time = bookForm.appointmentTime;
      if (time && time.length === 5) {
        time = `${time}:00`;
      }

      const payload = {
        patientId: isPatient() ? currentPatient?.id : bookForm.patientId,
        doctorId: bookForm.doctorId,
        appointmentDate: bookForm.appointmentDate,
        appointmentTime: time,
        reason: bookForm.reason,
      };

      if (!payload.patientId) {
        toast.error('Patient record not found. Please complete profile.');
        return;
      }

      await api.post('/appointments', payload);
      toast.success('Appointment booked successfully!');
      setShowBookModal(false);
      setBookForm({
        patientId: currentPatient?.id || '',
        doctorId: '',
        appointmentDate: '',
        appointmentTime: '10:00:00',
        reason: '',
      });
      reloadAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed (Doctor slot might already be taken)');
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter !== 'ALL' && appt.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const patientMatch = appt.patientName?.toLowerCase().includes(q);
      const doctorMatch = appt.doctorName?.toLowerCase().includes(q);
      const reasonMatch = appt.reason?.toLowerCase().includes(q);
      return patientMatch || doctorMatch || reasonMatch;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    return <span className={`badge badge-${s}`}>{status}</span>;
  };

  const timeSlots = [
    '09:00:00', '09:30:00', '10:00:00', '10:30:00',
    '11:00:00', '11:30:00', '14:00:00', '14:30:00',
    '15:00:00', '15:30:00', '16:00:00', '16:30:00'
  ];

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <h2>Appointments Management</h2>
        </div>
        <div className="topbar-right">
          {(isPatient() || isAdmin()) && (
            <button className="btn btn-primary" onClick={() => setShowBookModal(true)}>
              <Plus size={18} /> Book Appointment
            </button>
          )}
        </div>
      </header>

      <div className="page-content fade-in">
        {/* Controls Bar */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '240px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Filter by patient, doctor, or condition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-inline"><div className="spinner"></div></div>
        ) : filteredAppointments.length === 0 ? (
          <div className="empty-state">
            <Calendar />
            <h3>No Appointments Found</h3>
            <p>No appointments match the selected filters or search terms.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date & Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt) => (
                  <tr key={appt.id}>
                    <td>#{appt.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} color="var(--primary-400)" />
                        <strong>{appt.patientName}</strong>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Stethoscope size={16} color="var(--info)" />
                        <span>Dr. {appt.doctorName}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--surface-400)' }}>
                        {appt.departmentName || 'General'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color="var(--surface-400)" />
                        <span>{appt.appointmentDate}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--surface-400)' }}>
                        <Clock size={12} />
                        <span>{appt.appointmentTime}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {appt.reason || 'Routine Checkup'}
                      </p>
                    </td>
                    <td>{getStatusBadge(appt.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {(isAdmin() || isDoctor()) && appt.status === 'PENDING' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleStatusUpdate(appt.id, 'CONFIRMED')}
                            title="Confirm appointment"
                          >
                            <CheckCircle size={14} /> Confirm
                          </button>
                        )}

                        {(isAdmin() || isDoctor()) && appt.status === 'CONFIRMED' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleStatusUpdate(appt.id, 'COMPLETED')}
                            title="Mark completed"
                          >
                            <CheckCircle size={14} /> Complete
                          </button>
                        )}

                        {isDoctor() && (appt.status === 'CONFIRMED' || appt.status === 'COMPLETED') && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => navigate('/medical-records', {
                              state: {
                                patientId: appt.patientId,
                                patientName: appt.patientName,
                                doctorId: appt.doctorId,
                                appointmentId: appt.id
                              }
                            })}
                            title="Write medical prescription/record"
                          >
                            <FileText size={14} /> Prescribe
                          </button>
                        )}

                        {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleCancelAppointment(appt.id)}
                            title="Cancel appointment"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      {showBookModal && (
        <div className="modal-overlay" onClick={() => setShowBookModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Schedule New Appointment</h3>
              <button className="modal-close" onClick={() => setShowBookModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleBookSubmit}>
              <div className="modal-body">
                {isAdmin() && (
                  <div className="form-group">
                    <label className="form-label">Select Patient</label>
                    <select
                      className="form-input"
                      value={bookForm.patientId}
                      onChange={(e) => setBookForm({ ...bookForm, patientId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Patient --</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>{p.fullName} ({p.phone})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Select Doctor</label>
                  <select
                    className="form-input"
                    value={bookForm.doctorId}
                    onChange={(e) => setBookForm({ ...bookForm, doctorId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.fullName} — {d.specialization} (₹{d.consultationFee})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Appointment Date</label>
                    <input
                      type="date"
                      className="form-input"
                      min={new Date().toISOString().split('T')[0]}
                      value={bookForm.appointmentDate}
                      onChange={(e) => setBookForm({ ...bookForm, appointmentDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Available Time Slot</label>
                    <select
                      className="form-input"
                      value={bookForm.appointmentTime}
                      onChange={(e) => setBookForm({ ...bookForm, appointmentTime: e.target.value })}
                      required
                    >
                      {timeSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot.slice(0, 5)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Consultation</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Describe symptoms or reasons for visit (e.g. persistent cough, routine follow-up)..."
                    value={bookForm.reason}
                    onChange={(e) => setBookForm({ ...bookForm, reason: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBookModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
