import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Building2, Plus, Edit2, X, Check, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DepartmentsPage() {
  const { isAdmin } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingDept(null);
    setFormData({ name: '', description: '' });
    setShowModal(true);
  };

  const openEditModal = (dept) => {
    setEditingDept(dept);
    setFormData({ name: dept.name, description: dept.description || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, formData);
        toast.success('Department updated successfully');
      } else {
        await api.post('/departments', formData);
        toast.success('Department added successfully');
      }
      setShowModal(false);
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const filteredDepts = departments.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q);
  });

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <h2>Hospital Departments</h2>
        </div>
        <div className="topbar-right">
          {isAdmin() && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} /> Add Department
            </button>
          )}
        </div>
      </header>

      <div className="page-content fade-in">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-inline"><div className="spinner"></div></div>
        ) : filteredDepts.length === 0 ? (
          <div className="empty-state">
            <Building2 />
            <h3>No Departments Found</h3>
            <p>Clinical departments will appear here once configured.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredDepts.map((dept) => (
              <div key={dept.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div className="stat-icon teal" style={{ marginBottom: 0 }}>
                    <Building2 size={24} />
                  </div>
                  {isAdmin() && (
                    <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(dept)}>
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                </div>

                <h3 style={{ fontSize: '18px', color: 'var(--surface-50)', fontWeight: 700, marginBottom: '8px' }}>
                  {dept.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--surface-400)', lineHeight: 1.6, flex: 1 }}>
                  {dept.description || 'Specialized clinical care and patient diagnostics.'}
                </p>

                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--surface-500)' }}>
                  <span>Status: <strong style={{ color: 'var(--success)' }}>Operational</strong></span>
                  <span>ID: #{dept.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingDept ? 'Edit Department' : 'Create New Department'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Department Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Cardiology, Neurology, Pediatrics..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description & Services</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Describe the department's specialties and equipment..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDept ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
