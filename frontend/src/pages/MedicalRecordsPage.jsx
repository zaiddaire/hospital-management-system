import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import {
  FileText, Plus, Search, Calendar, User, Stethoscope,
  Pill, Clock, Trash2, X, Printer, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MedicalRecordsPage() {
  const { user, isAdmin, isDoctor, isPatient } = useAuth();
  const location = useLocation();

  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // View Record Modal
  const [viewRecord, setViewRecord] = useState(null);

  // Create Record Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRecord, setNewRecord] = useState({
    patientId: '',
    doctorId: '',
    appointmentId: '',
    visitDate: new Date().toISOString().split('T')[0],
    symptoms: '',
    diagnosis: '',
    treatmentNotes: '',
    prescriptions: [
      { medicineName: '', dosage: '', frequency: 'Twice daily', duration: '5 days', instructions: 'Take after meals' },
    ],
  });

  useEffect(() => {
    initRecords();
  }, [user]);

  // Pre-fill from navigation state (e.g. clicking Prescribe on Appointments)
  useEffect(() => {
    if (location.state?.patientId) {
      setNewRecord((prev) => ({
        ...prev,
        patientId: location.state.patientId,
        appointmentId: location.state.appointmentId || '',
      }));
      setShowCreateModal(true);
    }
  }, [location.state]);

  const initRecords = async () => {
    setLoading(true);
    try {
      if (isAdmin()) {
        const [recs, pats, docs] = await Promise.all([
          api.get('/medical-records'),
          api.get('/patients'),
          api.get('/doctors'),
        ]);
        setRecords(recs.data);
        setPatients(pats.data);
        setDoctors(docs.data);
      } else if (isDoctor()) {
        const docProfile = await api.get(`/doctors/user/${user.userId}`);
        setCurrentDoctor(docProfile.data);
        setNewRecord((prev) => ({ ...prev, doctorId: docProfile.data.id }));

        const [recs, pats] = await Promise.all([
          api.get(`/medical-records/doctor/${docProfile.data.id}`),
          api.get('/patients'),
        ]);
        setRecords(recs.data);
        setPatients(pats.data);
      } else if (isPatient()) {
        const patProfile = await api.get(`/patients/user/${user.userId}`);
        setCurrentPatient(patProfile.data);
        if (patProfile.data?.id) {
          const recs = await api.get(`/medical-records/patient/${patProfile.data.id}`);
          setRecords(recs.data);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrescriptionLine = () => {
    setNewRecord({
      ...newRecord,
      prescriptions: [
        ...newRecord.prescriptions,
        { medicineName: '', dosage: '', frequency: 'Twice daily', duration: '5 days', instructions: 'Take after meals' },
      ],
    });
  };

  const handleRemovePrescriptionLine = (idx) => {
    setNewRecord({
      ...newRecord,
      prescriptions: newRecord.prescriptions.filter((_, i) => i !== idx),
    });
  };

  const handlePrescriptionChange = (idx, field, val) => {
    const updated = [...newRecord.prescriptions];
    updated[idx][field] = val;
    setNewRecord({ ...newRecord, prescriptions: updated });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newRecord,
        patientId: Number(newRecord.patientId),
        doctorId: isDoctor() ? currentDoctor?.id : Number(newRecord.doctorId),
        appointmentId: newRecord.appointmentId ? Number(newRecord.appointmentId) : null,
        prescriptions: newRecord.prescriptions.filter((p) => p.medicineName.trim() !== ''),
      };

      if (!payload.patientId) {
        toast.error('Please select a patient');
        return;
      }

      await api.post('/medical-records', payload);
      toast.success('Medical record created successfully!');
      setShowCreateModal(false);
      setNewRecord({
        patientId: '',
        doctorId: isDoctor() ? currentDoctor?.id : '',
        appointmentId: '',
        visitDate: new Date().toISOString().split('T')[0],
        symptoms: '',
        diagnosis: '',
        treatmentNotes: '',
        prescriptions: [
          { medicineName: '', dosage: '', frequency: 'Twice daily', duration: '5 days', instructions: 'Take after meals' },
        ],
      });

      // Reload
      if (isAdmin()) {
        const res = await api.get('/medical-records');
        setRecords(res.data);
      } else if (isDoctor() && currentDoctor) {
        const res = await api.get(`/medical-records/doctor/${currentDoctor.id}`);
        setRecords(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save medical record');
    }
  };

  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.patientName?.toLowerCase().includes(q) ||
      r.doctorName?.toLowerCase().includes(q) ||
      r.diagnosis?.toLowerCase().includes(q) ||
      r.symptoms?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <h2>Medical Records & Prescriptions</h2>
        </div>
        <div className="topbar-right">
          {(isAdmin() || isDoctor()) && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} /> Add Medical Record
            </button>
          )}
        </div>
      </header>

      <div className="page-content fade-in">
        {/* Search Bar */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: '440px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by diagnosis, patient, symptoms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-inline"><div className="spinner"></div></div>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">
            <FileText />
            <h3>No Medical Records Found</h3>
            <p>Clinical visit reports and doctor prescriptions will appear here once recorded.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {filteredRecords.map((rec) => (
              <div key={rec.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--primary-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Record #{rec.id}
                    </span>
                    <h3 style={{ fontSize: '18px', color: 'var(--surface-50)', fontWeight: 700, marginTop: '2px' }}>
                      {rec.diagnosis}
                    </h3>
                  </div>
                  <span className="badge badge-completed">
                    {rec.visitDate}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--surface-300)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={15} color="var(--primary-400)" />
                    <span>Patient: <strong>{rec.patientName}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Stethoscope size={15} color="var(--info)" />
                    <span>Consultant: Dr. {rec.doctorName}</span>
                  </div>
                  {rec.symptoms && (
                    <div style={{ marginTop: '4px', background: 'var(--surface-800)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                      <strong style={{ color: 'var(--surface-400)' }}>Symptoms: </strong>
                      {rec.symptoms}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '14px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--surface-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Pill size={14} color="var(--primary-400)" />
                    {rec.prescriptions?.length || 0} Prescribed Meds
                  </span>
                  <button className="btn btn-sm btn-secondary" onClick={() => setViewRecord(rec)}>
                    View Prescription
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Record / Printable Prescription Modal */}
      {viewRecord && (
        <div className="modal-overlay" onClick={() => setViewRecord(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} color="var(--primary-400)" />
                <h3>Medical Record & Prescription</h3>
              </div>
              <button className="modal-close" onClick={() => setViewRecord(null)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', color: 'var(--surface-100)', fontWeight: 700 }}>{viewRecord.patientName}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--surface-400)' }}>Patient File</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h4 style={{ fontSize: '14px', color: 'var(--surface-100)' }}>Dr. {viewRecord.doctorName}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--surface-400)' }}>Date: {viewRecord.visitDate}</p>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-800)', padding: '12px', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--surface-400)', textTransform: 'uppercase', fontWeight: 600 }}>Clinical Diagnosis</div>
                  <div style={{ fontSize: '15px', color: 'var(--surface-50)', fontWeight: 700, marginTop: '2px' }}>{viewRecord.diagnosis}</div>
                  {viewRecord.symptoms && (
                    <div style={{ fontSize: '13px', color: 'var(--surface-300)', marginTop: '6px' }}>
                      <strong>Symptoms:</strong> {viewRecord.symptoms}
                    </div>
                  )}
                  {viewRecord.treatmentNotes && (
                    <div style={{ fontSize: '13px', color: 'var(--surface-300)', marginTop: '6px' }}>
                      <strong>Notes:</strong> {viewRecord.treatmentNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Prescriptions Table */}
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--surface-200)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Pill size={16} color="var(--primary-400)" /> Prescribed Medications (Rx)
              </h4>

              {(!viewRecord.prescriptions || viewRecord.prescriptions.length === 0) ? (
                <p style={{ fontSize: '13px', color: 'var(--surface-500)', fontStyle: 'italic' }}>No medications prescribed for this visit.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewRecord.prescriptions.map((p, idx) => (
                        <tr key={idx}>
                          <td><strong>{p.medicineName}</strong></td>
                          <td>{p.dosage}</td>
                          <td>{p.frequency}</td>
                          <td>{p.duration}</td>
                          <td style={{ fontSize: '12px', color: 'var(--surface-400)' }}>{p.instructions || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print Rx
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setViewRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Medical Record Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h3>Create Medical Record & Prescription</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Select Patient</label>
                    <select
                      className="form-input"
                      value={newRecord.patientId}
                      onChange={(e) => setNewRecord({ ...newRecord, patientId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Patient --</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>{p.fullName} ({p.phone})</option>
                      ))}
                    </select>
                  </div>

                  {isAdmin() && (
                    <div className="form-group">
                      <label className="form-label">Consulting Doctor</label>
                      <select
                        className="form-input"
                        value={newRecord.doctorId}
                        onChange={(e) => setNewRecord({ ...newRecord, doctorId: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Doctor --</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>Dr. {d.fullName} ({d.specialization})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Visit Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newRecord.visitDate}
                      onChange={(e) => setNewRecord({ ...newRecord, visitDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Diagnosis</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Acute Bronchitis, Type 2 Diabetes, Hypertension..."
                    value={newRecord.diagnosis}
                    onChange={(e) => setNewRecord({ ...newRecord, diagnosis: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Reported Symptoms</label>
                    <textarea
                      className="form-input"
                      rows="2"
                      placeholder="e.g. High fever, productive cough for 3 days..."
                      value={newRecord.symptoms}
                      onChange={(e) => setNewRecord({ ...newRecord, symptoms: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Treatment Notes & Advice</label>
                    <textarea
                      className="form-input"
                      rows="2"
                      placeholder="e.g. Rest for 3 days, drink warm fluids, follow up next week..."
                      value={newRecord.treatmentNotes}
                      onChange={(e) => setNewRecord({ ...newRecord, treatmentNotes: e.target.value })}
                    />
                  </div>
                </div>

                {/* Prescription lines */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Medications (Prescription)</label>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={handleAddPrescriptionLine}>
                      <Plus size={14} /> Add Medicine
                    </button>
                  </div>

                  {newRecord.prescriptions.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--surface-800)',
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '10px',
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr auto',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        className="form-input"
                        placeholder="Medicine name"
                        value={line.medicineName}
                        onChange={(e) => handlePrescriptionChange(idx, 'medicineName', e.target.value)}
                        required
                      />
                      <input
                        className="form-input"
                        placeholder="Dosage (500mg)"
                        value={line.dosage}
                        onChange={(e) => handlePrescriptionChange(idx, 'dosage', e.target.value)}
                        required
                      />
                      <input
                        className="form-input"
                        placeholder="Frequency"
                        value={line.frequency}
                        onChange={(e) => handlePrescriptionChange(idx, 'frequency', e.target.value)}
                        required
                      />
                      <input
                        className="form-input"
                        placeholder="Duration"
                        value={line.duration}
                        onChange={(e) => handlePrescriptionChange(idx, 'duration', e.target.value)}
                        required
                      />
                      <input
                        className="form-input"
                        placeholder="Instructions"
                        value={line.instructions}
                        onChange={(e) => handlePrescriptionChange(idx, 'instructions', e.target.value)}
                      />
                      {newRecord.prescriptions.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ padding: '8px' }}
                          onClick={() => handleRemovePrescriptionLine(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Clinical Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
