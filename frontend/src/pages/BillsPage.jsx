import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  Receipt, Plus, Search, DollarSign, CheckCircle2,
  Clock, User, FileText, Printer, X, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BillsPage() {
  const { user, isAdmin, isPatient } = useAuth();
  const [bills, setBills] = useState([]);
  const [patients, setPatients] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [newBill, setNewBill] = useState({
    patientId: '',
    appointmentId: '',
    description: 'Consultation & Clinical Care Fee',
    amount: '',
  });

  useEffect(() => {
    fetchBills();
  }, [user]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      if (isAdmin()) {
        const [billRes, patRes] = await Promise.all([
          api.get('/bills'),
          api.get('/patients'),
        ]);
        setBills(billRes.data);
        setPatients(patRes.data);
      } else if (isPatient()) {
        const patRes = await api.get(`/patients/user/${user.userId}`);
        setCurrentPatient(patRes.data);
        if (patRes.data?.id) {
          const res = await api.get(`/bills/patient/${patRes.data.id}`);
          setBills(res.data);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentToggle = async (billId, currentStatus) => {
    const nextStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await api.patch(`/bills/${billId}/payment`, { status: nextStatus });
      toast.success(`Bill marked as ${nextStatus}`);
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update payment status');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        patientId: Number(newBill.patientId),
        appointmentId: newBill.appointmentId ? Number(newBill.appointmentId) : null,
        description: newBill.description,
        amount: parseFloat(newBill.amount),
      };

      await api.post('/bills', payload);
      toast.success('Invoice generated successfully!');
      setShowCreateModal(false);
      setNewBill({
        patientId: '',
        appointmentId: '',
        description: 'Consultation & Clinical Care Fee',
        amount: '',
      });
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create bill');
    }
  };

  const filteredBills = bills.filter((b) => {
    if (filterStatus !== 'ALL' && b.paymentStatus !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.billNumber?.toLowerCase().includes(q) ||
        b.patientName?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalAmount = bills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const paidAmount = bills
    .filter((b) => b.paymentStatus === 'PAID')
    .reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const pendingAmount = totalAmount - paidAmount;

  return (
    <div>
      <header className="topbar">
        <div className="topbar-left">
          <h2>Billing & Invoices</h2>
        </div>
        <div className="topbar-right">
          {isAdmin() && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} /> Generate Invoice
            </button>
          )}
        </div>
      </header>

      <div className="page-content fade-in">
        {/* Financial KPI bar */}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card teal">
            <div className="stat-icon teal"><Receipt size={24} /></div>
            <div className="stat-value">₹{totalAmount.toLocaleString()}</div>
            <div className="stat-label">Total Invoiced</div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green"><CheckCircle2 size={24} /></div>
            <div className="stat-value">₹{paidAmount.toLocaleString()}</div>
            <div className="stat-label">Paid Collections</div>
          </div>
          <div className="stat-card rose">
            <div className="stat-icon rose"><Clock size={24} /></div>
            <div className="stat-value">₹{pendingAmount.toLocaleString()}</div>
            <div className="stat-label">Pending Receivables</div>
          </div>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '240px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by invoice # or patient name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'PAID', 'PENDING'].map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-inline"><div className="spinner"></div></div>
        ) : filteredBills.length === 0 ? (
          <div className="empty-state">
            <Receipt />
            <h3>No Billing Records Found</h3>
            <p>Generated bills and payment receipts will appear here.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Patient</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((b) => (
                  <tr key={b.id}>
                    <td><strong style={{ color: 'var(--primary-400)' }}>{b.billNumber}</strong></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={15} color="var(--surface-400)" />
                        <strong>{b.patientName}</strong>
                      </div>
                    </td>
                    <td>{b.description || 'General Medical Care'}</td>
                    <td>{b.billDate}</td>
                    <td>
                      <strong style={{ fontSize: '15px', color: 'var(--surface-50)' }}>
                        ₹{Number(b.amount).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span className={`badge ${b.paymentStatus === 'PAID' ? 'badge-paid' : 'badge-pending'}`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setViewInvoice(b)}
                          title="View formal invoice receipt"
                        >
                          <Printer size={14} /> Receipt
                        </button>

                        {isAdmin() && (
                          <button
                            className={`btn btn-sm ${b.paymentStatus === 'PAID' ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handlePaymentToggle(b.id, b.paymentStatus)}
                          >
                            Mark {b.paymentStatus === 'PAID' ? 'Unpaid' : 'Paid'}
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

      {/* Printable Invoice Modal */}
      {viewInvoice && (
        <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>Official Hospital Invoice</h3>
              <button className="modal-close" onClick={() => setViewInvoice(null)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ background: 'var(--surface-900)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary-400)' }}>MedCore HMS</h3>
                  <p style={{ fontSize: '12px', color: 'var(--surface-400)' }}>Hospital Billing Department</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--surface-100)' }}>{viewInvoice.billNumber}</div>
                  <div style={{ fontSize: '12px', color: 'var(--surface-400)' }}>Date: {viewInvoice.billDate}</div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--surface-500)', fontWeight: 700 }}>Billed To</span>
                <h4 style={{ fontSize: '16px', color: 'var(--surface-100)', marginTop: '2px' }}>{viewInvoice.patientName}</h4>
              </div>

              <div style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)', fontSize: '12px', fontWeight: 600, color: 'var(--surface-400)' }}>
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', fontSize: '14px', color: 'var(--surface-200)' }}>
                  <span>{viewInvoice.description || 'Clinical Consultation Fee'}</span>
                  <strong>₹{Number(viewInvoice.amount).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderTop: '1px solid var(--glass-border)', fontSize: '16px', fontWeight: 800, color: 'var(--surface-50)' }}>
                  <span>Total Payable:</span>
                  <span style={{ color: 'var(--primary-400)' }}>₹{Number(viewInvoice.amount).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--surface-400)' }}>Payment Status:</span>
                <span className={`badge ${viewInvoice.paymentStatus === 'PAID' ? 'badge-paid' : 'badge-pending'}`}>
                  {viewInvoice.paymentStatus}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setViewInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Bill Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate New Patient Invoice</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Patient</label>
                  <select
                    className="form-input"
                    value={newBill.patientId}
                    onChange={(e) => setNewBill({ ...newBill, patientId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName} ({p.phone})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Invoice Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    placeholder="e.g. 1500"
                    value={newBill.amount}
                    onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Description</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={newBill.description}
                    onChange={(e) => setNewBill({ ...newBill, description: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
