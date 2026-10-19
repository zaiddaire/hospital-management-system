import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Users, Search, Phone, Mail, Droplet, Calendar,
  MapPin, AlertCircle, Edit2, X, FileText, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PatientsPage() {
  const { user, isAdmin, isDoctor } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    gender: 'MALE',
    bloodGroup: 'O_POSITIVE',
    address: '',
    emergencyContact: '',
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/patients');
      setPatients(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patients list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) {
      fetchPatients();
      return;
    }
    try {
      const res = await api.get(`/patients/search?name=${encodeURIComponent(query)}`);
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModal = (pat) => {
    setSelectedPatient(pat);
    setEditForm({
      fullName: pat.fullName || '',
      phone: pat.phone || '',
      dateOfBirth: pat.dateOfBirth || '',
      gender: pat.gender || 'MALE',
      bloodGroup: pat.bloodGroup || 'O_POSITIVE',
      address: pat.address || '',
      emergencyContact: pat.emergencyContact || '',
    });
    setEditModal(true);
  };

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/patients/${selectedPatient.id}`, editForm);
      toast.success('Patient details updated successfully');
      setEditModal(false);
      fetchPatients();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update patient');
    }
  };

  const bloodGroupDisplay = (bg) => {
    if (!bg) return 'Unknown';
    return bg.replace('_POSITIVE', '+').replace('_NEGATIVE', '-');
  };

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <h2>Patient Directory</h2>
        </div>
        <div className="topbar-right">
          <span style={{ fontSize: '13px', color: 'var(--surface-400)' }}>
            Total registered: <strong style={{ color: 'var(--surface-100)' }}>{patients.length}</strong>
          </span>
        </div>
      </header>

      <div className="page-content fade-in">
        {/* Search header */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: '480px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search patients by name..."
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-inline"><div className="spinner"></div></div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <Users />
            <h3>No Patients Found</h3>
            <p>No registered patients match your search term.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient Name</th>
                  <th>Contact Info</th>
                  <th>Blood Group</th>
                  <th>Gender & DOB</th>
                  <th>Emergency Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((pat) => (
                  <tr key={pat.id}>
                    <td>#{pat.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="sidebar-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                          {pat.fullName ? pat.fullName[0].toUpperCase() : 'P'}
                        </div>
                        <div>
                          <strong>{pat.fullName}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--surface-400)' }}>
                            @{pat.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Phone size={13} color="var(--primary-400)" />
                        <span>{pat.phone}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--surface-400)' }}>
                        <Mail size={12} />
                        <span>{pat.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Droplet size={11} color="var(--danger)" />
                        {bloodGroupDisplay(pat.bloodGroup)}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>{pat.gender}</div>
                      <div style={{ fontSize: '12px', color: 'var(--surface-400)' }}>
                        DOB: {pat.dateOfBirth || 'Not recorded'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: pat.emergencyContact ? 'var(--surface-200)' : 'var(--surface-500)' }}>
                        {pat.emergencyContact || '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openEditModal(pat)}
                          title="Edit patient details"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                        {isDoctor() && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => navigate('/medical-records', {
                              state: { patientId: pat.id, patientName: pat.fullName }
                            })}
                            title="View or add medical records"
                          >
                            <FileText size={14} /> Records
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

      {/* Edit Patient Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Patient Details</h3>
              <button className="modal-close" onClick={() => setEditModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleUpdatePatient}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-input"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emergency Contact</label>
                    <input
                      className="form-input"
                      value={editForm.emergencyContact}
                      onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select
                      className="form-input"
                      value={editForm.bloodGroup}
                      onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                    >
                      <option value="A_POSITIVE">A+</option>
                      <option value="A_NEGATIVE">A-</option>
                      <option value="B_POSITIVE">B+</option>
                      <option value="B_NEGATIVE">B-</option>
                      <option value="AB_POSITIVE">AB+</option>
                      <option value="AB_NEGATIVE">AB-</option>
                      <option value="O_POSITIVE">O+</option>
                      <option value="O_NEGATIVE">O-</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Residential Address</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
