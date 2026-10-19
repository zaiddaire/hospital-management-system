import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Stethoscope, Search, Plus, Phone, Mail, Building2,
  Calendar, Award, DollarSign, Clock, Trash2, Edit2, X, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DoctorsPage() {
  const { user, isAdmin, isPatient } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    departmentId: '',
    specialization: '',
    qualification: '',
    experienceYears: 1,
    consultationFee: 500,
    phone: '',
    gender: 'MALE',
    availability: 'Mon-Fri 9AM-5PM',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docRes, deptRes] = await Promise.all([
        isAdmin() ? api.get('/admin/doctors') : api.get('/doctors'),
        api.get('/departments'),
      ]);
      setDoctors(docRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) {
      fetchData();
      return;
    }
    try {
      const res = await api.get(`/doctors/search?query=${encodeURIComponent(query)}`);
      setDoctors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setEditingDoctor(null);
    setFormData({
      username: '',
      email: '',
      fullName: '',
      departmentId: departments[0]?.id || '',
      specialization: '',
      qualification: '',
      experienceYears: 2,
      consultationFee: 500,
      phone: '',
      gender: 'MALE',
      availability: 'Mon-Fri 9AM-5PM',
    });
    setShowModal(true);
  };

  const openEditModal = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      username: doctor.username || '',
      email: doctor.email || '',
      fullName: doctor.fullName || '',
      departmentId: doctor.departmentId || departments[0]?.id || '',
      specialization: doctor.specialization || '',
      qualification: doctor.qualification || '',
      experienceYears: doctor.experienceYears || 0,
      consultationFee: doctor.consultationFee || 500,
      phone: doctor.phone || '',
      gender: doctor.gender || 'MALE',
      availability: doctor.availability || 'Mon-Fri 9AM-5PM',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctor) {
        await api.put(`/doctors/${editingDoctor.id}`, formData);
        toast.success('Doctor updated successfully');
      } else {
        await api.post('/doctors', formData);
        toast.success('Doctor registered successfully (Default password: doctor123)');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this doctor?')) return;
    try {
      await api.delete(`/doctors/${id}`);
      toast.success('Doctor removed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete doctor');
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    if (selectedDept !== 'ALL' && doc.departmentId?.toString() !== selectedDept) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <h2>Doctors Directory</h2>
        </div>
        <div className="topbar-right">
          {isAdmin() && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} /> Add New Doctor
            </button>
          )}
        </div>
      </header>

      <div className="page-content fade-in">
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '260px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by doctor name or specialization..."
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>

          <div style={{ minWidth: '200px' }}>
            <select
              className="form-input"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-inline"><div className="spinner"></div></div>
        ) : filteredDoctors.length === 0 ? (
          <div className="empty-state">
            <Stethoscope />
            <h3>No Doctors Found</h3>
            <p>Try adjusting your search criteria or add new medical staff.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredDoctors.map((doc) => (
              <div key={doc.id} className="card" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div className="sidebar-avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
                    {doc.fullName ? doc.fullName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'DR'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '17px', color: 'var(--surface-50)', fontWeight: 700 }}>
                      Dr. {doc.fullName}
                    </h3>
                    <div style={{ display: 'inline-block', fontSize: '12px', color: 'var(--primary-400)', fontWeight: 600, marginTop: '2px' }}>
                      {doc.specialization}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--surface-400)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Building2 size={13} /> {doc.departmentName || 'Medical Dept'}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--surface-300)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={15} color="var(--primary-400)" />
                    <span>{doc.qualification} ({doc.experienceYears} yrs exp)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={15} color="var(--success)" />
                    <span>₹{doc.consultationFee} Consultation Fee</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={15} color="var(--warning)" />
                    <span>{doc.availability || 'Mon-Fri 9AM-5PM'}</span>
                  </div>
                  {doc.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={15} color="var(--surface-400)" />
                      <span>{doc.phone}</span>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', borderTop: '1px solid var(--glass-border)', paddingTop: '14px' }}>
                  {isPatient() && (
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => navigate('/appointments', { state: { doctorId: doc.id, doctorName: doc.fullName } })}
                    >
                      <Calendar size={16} /> Book Appointment
                    </button>
                  )}

                  {isAdmin() && (
                    <>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEditModal(doc)}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)} aria-label="Delete doctor">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Add / Edit Doctor */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>{editingDoctor ? 'Edit Doctor Details' : 'Register New Doctor'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {!editingDoctor && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Username</label>
                      <input
                        className="form-input"
                        placeholder="dr.smith"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        className="form-input"
                        type="email"
                        placeholder="smith@hospital.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      placeholder="Dr. John Smith"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select
                      className="form-input"
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Specialization</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Cardiologist"
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <input
                      className="form-input"
                      placeholder="e.g. MBBS, MD (Cardiology)"
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Experience (Years)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={formData.experienceYears}
                      onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Consultation Fee (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={formData.consultationFee}
                      onChange={(e) => setFormData({ ...formData, consultationFee: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      className="form-input"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select
                      className="form-input"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Availability Schedule</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Mon-Fri 9:00 AM - 5:00 PM"
                    value={formData.availability}
                    onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDoctor ? 'Update Doctor' : 'Register Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
