import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Calendar, Clock, User, Stethoscope, Plus,
  CheckCircle, XCircle, AlertTriangle, Search, X, FileText,
  RefreshCw, History, ArrowRight, AlertCircle, Info
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
    appointmentTime: '',
    reason: '',
  });
  const [bookSlots, setBookSlots] = useState([]);
  const [bookSlotLoading, setBookSlotLoading] = useState(false);
  const [bookScheduleInfo, setBookScheduleInfo] = useState(null);

  // Reschedule Modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [reschedulingAppt, setReschedulingAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleSlotLoading, setRescheduleSlotLoading] = useState(false);
  const [rescheduleScheduleInfo, setRescheduleScheduleInfo] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAppt, setHistoryAppt] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
      } else {
        const res = await api.get('/appointments');
        setAppointments(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch available slots for Booking Modal
  const fetchBookSlots = async (doctorId, date) => {
    if (!doctorId || !date) {
      setBookSlots([]);
      setBookScheduleInfo(null);
      return;
    }
    setBookSlotLoading(true);
    try {
      const res = await api.get(`/appointments/available-slots?doctorId=${doctorId}&date=${date}`);
      setBookScheduleInfo(res.data);
      // API returns { slots: [{time, displayTime, available, booked},...] }
      const availableSlotTimes = (res.data.slots || []).filter(s => s.available).map(s => s.time);
      setBookSlots(availableSlotTimes);
      if (availableSlotTimes.length > 0) {
        setBookForm((prev) => ({ ...prev, appointmentTime: availableSlotTimes[0] }));
      } else {
        setBookForm((prev) => ({ ...prev, appointmentTime: '' }));
      }
    } catch (err) {
      console.error('Failed to fetch available slots:', err);
      setBookSlots([]);
    } finally {
      setBookSlotLoading(false);
    }
  };

  // Fetch available slots for Reschedule Modal
  const fetchRescheduleSlots = async (doctorId, date, excludeAppointmentId) => {
    if (!doctorId || !date) {
      setRescheduleSlots([]);
      setRescheduleScheduleInfo(null);
      return;
    }
    setRescheduleSlotLoading(true);
    try {
      const res = await api.get(
        `/appointments/available-slots?doctorId=${doctorId}&date=${date}&excludeAppointmentId=${excludeAppointmentId}`
      );
      setRescheduleScheduleInfo(res.data);
      // API returns { slots: [{time, displayTime, available, booked},...] }
      const availableSlotTimes = (res.data.slots || []).filter(s => s.available).map(s => s.time);
      setRescheduleSlots(availableSlotTimes);
      if (availableSlotTimes.length > 0) {
        setRescheduleSlot(availableSlotTimes[0]);
      } else {
        setRescheduleSlot('');
      }
    } catch (err) {
      console.error('Failed to fetch reschedule slots:', err);
      setRescheduleSlots([]);
    } finally {
      setRescheduleSlotLoading(false);
    }
  };

  const openRescheduleModal = (appt) => {
    setReschedulingAppt(appt);
    const todayStr = new Date().toISOString().split('T')[0];
    const initialDate = (appt.appointmentDate && appt.appointmentDate >= todayStr)
      ? appt.appointmentDate
      : todayStr;
    setRescheduleDate(initialDate);
    setRescheduleSlot(appt.appointmentTime ? appt.appointmentTime.slice(0, 5) : '');
    setRescheduleReason('');
    setShowRescheduleModal(true);
    fetchRescheduleSlots(appt.doctorId, initialDate, appt.id);
  };

  const handleRescheduleDateChange = (newDate) => {
    setRescheduleDate(newDate);
    if (reschedulingAppt) {
      fetchRescheduleSlots(reschedulingAppt.doctorId, newDate, reschedulingAppt.id);
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleSlot) {
      toast.error('Please select both a new date and an available time slot.');
      return;
    }

    setRescheduleSubmitting(true);
    try {
      let formattedTime = rescheduleSlot;
      if (formattedTime && formattedTime.length === 5) {
        formattedTime = `${formattedTime}:00`;
      }

      await api.post(`/appointments/${reschedulingAppt.id}/reschedule`, {
        newDate: rescheduleDate,
        newTime: formattedTime,
        reason: rescheduleReason || 'Patient requested schedule change',
      });

      toast.success('Appointment successfully rescheduled!');
      setShowRescheduleModal(false);
      reloadAppointments();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Conflict: This slot was just booked! Refreshed available slots.');
        fetchRescheduleSlots(reschedulingAppt.doctorId, rescheduleDate, reschedulingAppt.id);
      } else {
        toast.error(err.response?.data?.message || 'Failed to reschedule appointment');
      }
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const openHistoryModal = async (appt) => {
    setHistoryAppt(appt);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/appointments/${appt.id}/history`);
      setHistoryList(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reschedule audit history');
    } finally {
      setHistoryLoading(false);
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
        appointmentTime: '',
        reason: '',
      });
      setBookSlots([]);
      reloadAppointments();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Conflict: Doctor slot already booked. Please choose another slot.');
        fetchBookSlots(bookForm.doctorId, bookForm.appointmentDate);
      } else {
        toast.error(err.response?.data?.message || 'Booking failed');
      }
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter === 'UPCOMING') {
      const today = new Date().toISOString().split('T')[0];
      if (appt.status === 'CANCELLED' || appt.status === 'COMPLETED') return false;
      if (appt.appointmentDate && appt.appointmentDate < today) return false;
    } else if (statusFilter !== 'ALL' && appt.status !== statusFilter) {
      return false;
    }
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
            {['ALL', 'UPCOMING', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((s) => (
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
                        <span>{appt.appointmentTime?.slice(0, 5)}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {appt.reason || 'Routine Checkup'}
                      </p>
                    </td>
                    <td>{getStatusBadge(appt.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Reschedule Button: Patient (own appointment) or Admin or Doctor, only if PENDING or CONFIRMED */}
                        {((isPatient() && (!currentPatient || Number(appt.patientId) === Number(currentPatient?.id))) || isAdmin() || isDoctor()) &&
                          (appt.status === 'PENDING' || appt.status === 'CONFIRMED') && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => openRescheduleModal(appt)}
                              title="Reschedule appointment"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <RefreshCw size={13} /> Reschedule
                            </button>
                        )}

                        {/* Audit Trail Button */}
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openHistoryModal(appt)}
                          title="View reschedule history & audit trail"
                          style={{ padding: '6px 8px' }}
                        >
                          <History size={14} />
                        </button>

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

      {/* Reschedule Appointment Modal */}
      {showRescheduleModal && reschedulingAppt && (
        <div className="modal-overlay" onClick={() => setShowRescheduleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={18} color="var(--primary-400)" />
                <h3>Reschedule Appointment #{reschedulingAppt.id}</h3>
              </div>
              <button className="modal-close" onClick={() => setShowRescheduleModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit}>
              <div className="modal-body">
                {/* Doctor & Patient Info summary */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--surface-500)', fontWeight: 700 }}>
                      Consulting Doctor
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--surface-100)' }}>
                      Dr. {reschedulingAppt.doctorName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--surface-400)' }}>
                      {reschedulingAppt.departmentName || 'General Medicine'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--surface-500)', fontWeight: 700 }}>
                      Patient
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--surface-100)' }}>
                      {reschedulingAppt.patientName}
                    </div>
                  </div>
                </div>

                {/* Date Picker */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} color="var(--primary-400)" /> Select New Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    min={new Date().toISOString().split('T')[0]}
                    value={rescheduleDate}
                    onChange={(e) => handleRescheduleDateChange(e.target.value)}
                    required
                  />
                </div>

                {/* Doctor Slot Selection */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color="var(--primary-400)" /> Available Time Slots
                    </span>
                    {rescheduleScheduleInfo?.availability && (
                      <span style={{ fontSize: '11px', color: 'var(--surface-400)', fontWeight: 400 }}>
                        {rescheduleScheduleInfo.availability}
                      </span>
                    )}
                  </label>

                  {rescheduleSlotLoading ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--surface-400)', fontSize: '13px' }}>
                      <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                      Checking doctor availability schedule...
                    </div>
                  ) : rescheduleScheduleInfo && !rescheduleScheduleInfo.isWorkingDay ? (
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--warning)',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={16} flexShrink={0} />
                      <span>{rescheduleScheduleInfo.message}</span>
                    </div>
                  ) : rescheduleSlots.length === 0 ? (
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--danger)',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle size={16} flexShrink={0} />
                      <span>No available slots remaining on this day. Please pick another date.</span>
                    </div>
                  ) : (
                    <div>
                      <div className="slot-chips-grid">
                        {rescheduleSlots.map((slot) => (
                          <button
                            type="button"
                            key={slot}
                            className={`slot-chip ${rescheduleSlot === slot ? 'selected' : ''}`}
                            onClick={() => setRescheduleSlot(slot)}
                          >
                            {slot.slice(0, 5)}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--surface-500)', marginTop: '8px' }}>
                        ✓ {rescheduleSlots.length} available slots on this day (30-min consultations)
                      </div>
                    </div>
                  )}
                </div>

                {/* Comparison Card */}
                <div className="reschedule-compare-card">
                  <div className="compare-box old">
                    <div className="compare-title">Current Schedule</div>
                    <div className="compare-val">{reschedulingAppt.appointmentDate}</div>
                    <div style={{ fontSize: '12px', color: 'var(--surface-400)' }}>
                      {reschedulingAppt.appointmentTime?.slice(0, 5)}
                    </div>
                  </div>

                  <ArrowRight size={20} color="var(--primary-400)" />

                  <div className="compare-box new">
                    <div className="compare-title">Proposed Schedule</div>
                    <div className="compare-val">{rescheduleDate || 'Pick a date'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--surface-400)' }}>
                      {rescheduleSlot ? rescheduleSlot.slice(0, 5) : 'Pick a slot'}
                    </div>
                  </div>
                </div>

                {/* Reason for Rescheduling */}
                <div className="form-group">
                  <label className="form-label">Reason for Rescheduling</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Provide a reason (e.g. Personal emergency, work conflict, preferred morning slot)..."
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRescheduleModal(false)}
                  disabled={rescheduleSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!rescheduleDate || !rescheduleSlot || rescheduleSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {rescheduleSubmitting ? (
                    <>
                      <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                      Rescheduling...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={15} /> Confirm Reschedule
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment History / Audit Trail Modal */}
      {showHistoryModal && historyAppt && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} color="var(--primary-400)" />
                <h3>Audit Trail — Appointment #{historyAppt.id}</h3>
              </div>
              <button className="modal-close" onClick={() => setShowHistoryModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '13px',
                color: 'var(--surface-300)'
              }}>
                Patient: <strong style={{ color: 'var(--surface-100)' }}>{historyAppt.patientName}</strong> &bull; Doctor: <strong style={{ color: 'var(--surface-100)' }}>Dr. {historyAppt.doctorName}</strong>
              </div>

              {historyLoading ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                  Loading reschedule audit trail...
                </div>
              ) : historyList.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 12px' }}>
                  <History size={36} color="var(--surface-600)" />
                  <h4>No Reschedule History</h4>
                  <p style={{ fontSize: '13px' }}>
                    This appointment is currently on its initial schedule ({historyAppt.appointmentDate} at {historyAppt.appointmentTime?.slice(0, 5)}) and has not been rescheduled.
                  </p>
                </div>
              ) : (
                <div className="audit-timeline">
                  {historyList.map((item) => (
                    <div className="audit-item" key={item.id}>
                      <div className="audit-dot"></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div>
                          <strong style={{ color: 'var(--surface-100)', fontSize: '13px' }}>
                            {item.changedByName || 'System User'}
                          </strong>
                          <span className={`badge badge-${item.changedByRole?.toLowerCase() || 'admin'}`} style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 8px' }}>
                            {item.changedByRole}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--surface-400)' }}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--surface-200)', marginBottom: '4px' }}>
                        Rescheduled from{' '}
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                          {item.oldAppointmentDate} {item.oldAppointmentTime?.slice(0, 5)}
                        </span>{' '}
                        &rarr;{' '}
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                          {item.newAppointmentDate} {item.newAppointmentTime?.slice(0, 5)}
                        </span>
                      </div>

                      {item.reason && (
                        <div style={{ fontSize: '12px', color: 'var(--surface-400)', marginTop: '4px', fontStyle: 'italic' }}>
                          Reason: "{item.reason}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setShowHistoryModal(false)}>
                Close Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}

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
                    onChange={(e) => {
                      const docId = e.target.value;
                      setBookForm({ ...bookForm, doctorId: docId });
                      if (bookForm.appointmentDate) {
                        fetchBookSlots(docId, bookForm.appointmentDate);
                      }
                    }}
                    required
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.fullName} — {d.specialization} (₹{d.consultationFee}) &bull; {d.availability}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Appointment Date</label>
                  <input
                    type="date"
                    className="form-input"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookForm.appointmentDate}
                    onChange={(e) => {
                      const dateVal = e.target.value;
                      setBookForm({ ...bookForm, appointmentDate: dateVal });
                      if (bookForm.doctorId) {
                        fetchBookSlots(bookForm.doctorId, dateVal);
                      }
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Available Time Slot</span>
                    {bookScheduleInfo?.availability && (
                      <span style={{ fontSize: '11px', color: 'var(--surface-400)', fontWeight: 400 }}>
                        {bookScheduleInfo.availability}
                      </span>
                    )}
                  </label>

                  {bookSlotLoading ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--surface-400)', fontSize: '13px' }}>
                      <div className="spinner" style={{ margin: '0 auto 6px', width: 18, height: 18 }}></div>
                      Checking doctor availability...
                    </div>
                  ) : bookScheduleInfo && !bookScheduleInfo.isWorkingDay ? (
                    <div style={{
                      padding: '10px 12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--warning)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <AlertTriangle size={15} flexShrink={0} />
                      <span>{bookScheduleInfo.message}</span>
                    </div>
                  ) : bookSlots.length > 0 ? (
                    <div className="slot-chips-grid">
                      {bookSlots.map((slot) => (
                        <button
                          type="button"
                          key={slot}
                          className={`slot-chip ${bookForm.appointmentTime === slot ? 'selected' : ''}`}
                          onClick={() => setBookForm({ ...bookForm, appointmentTime: slot })}
                        >
                          {slot.slice(0, 5)}
                        </button>
                      ))}
                    </div>
                  ) : bookForm.doctorId && bookForm.appointmentDate ? (
                    <div style={{ fontSize: '12px', color: 'var(--danger)' }}>
                      No open slots on this date. Please choose another date.
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--surface-400)' }}>
                      Please select a doctor and date above to view available consultation slots.
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Consultation</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Describe symptoms or reasons for visit..."
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!bookForm.appointmentTime || (bookScheduleInfo && !bookScheduleInfo.isWorkingDay)}
                >
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
