import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  UserCircle, Mail, Phone, Calendar, Droplet,
  MapPin, Shield, Award, DollarSign, Clock, Save
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, isPatient, isDoctor, isAdmin } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      if (isPatient()) {
        const res = await api.get(`/patients/user/${user.userId}`);
        setProfile(res.data);
        setFormData(res.data);
      } else if (isDoctor()) {
        const res = await api.get(`/doctors/user/${user.userId}`);
        setProfile(res.data);
        setFormData(res.data);
      } else {
        setProfile({
          username: user.username,
          email: user.email,
          fullName: user.fullName || 'System Administrator',
          role: user.role,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isPatient() && profile?.id) {
        await api.put(`/patients/${profile.id}`, formData);
        toast.success('Profile updated successfully');
        loadProfile();
      } else if (isDoctor() && profile?.id) {
        await api.put(`/doctors/${profile.id}`, formData);
        toast.success('Doctor credentials updated');
        loadProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-inline"><div className="spinner"></div></div>;
  }

  const initials = (profile?.fullName || user?.username || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <h2>My Profile</h2>
        </div>
      </header>

      <div className="page-content fade-in" style={{ maxWidth: '860px' }}>
        {/* Profile Card Header */}
        <div className="profile-header">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-info" style={{ flex: 1 }}>
            <h2>{profile?.fullName || user?.username}</h2>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-400)', fontWeight: 600 }}>
              <Shield size={16} /> {user?.role} ACCOUNT
            </p>
            <p style={{ fontSize: '13px', color: 'var(--surface-400)', marginTop: '4px' }}>
              Username: @{user?.username} • Email: {user?.email}
            </p>
          </div>
        </div>

        {/* Profile Edit Form */}
        <div className="card">
          <div className="card-header">
            <h3>Personal & Contact Details</h3>
          </div>

          {isAdmin() ? (
            <div style={{ padding: '20px 0', color: 'var(--surface-300)' }}>
              <p>You have full administrative privileges to manage staff, doctors, appointments, and hospital infrastructure.</p>
            </div>
          ) : (
            <form onSubmit={handleUpdate}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Legal Name</label>
                  <input
                    className="form-input"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              {isPatient() && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Blood Group</label>
                      <select
                        className="form-input"
                        value={formData.bloodGroup || 'O_POSITIVE'}
                        onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
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
                        value={formData.dateOfBirth || ''}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Emergency Contact Phone</label>
                    <input
                      className="form-input"
                      placeholder="+91 99887 76655"
                      value={formData.emergencyContact || ''}
                      onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Home Address</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </>
              )}

              {isDoctor() && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Specialization</label>
                      <input
                        className="form-input"
                        value={formData.specialization || ''}
                        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Qualification</label>
                      <input
                        className="form-input"
                        value={formData.qualification || ''}
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
                        value={formData.experienceYears || 0}
                        onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Consultation Fee (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.consultationFee || 500}
                        onChange={(e) => setFormData({ ...formData, consultationFee: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Regular Hours / Availability</label>
                    <input
                      className="form-input"
                      value={formData.availability || ''}
                      onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
