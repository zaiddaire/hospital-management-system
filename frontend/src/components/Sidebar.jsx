import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Calendar, Users, Stethoscope, FileText,
  Receipt, Building2, LogOut, Heart, UserCircle, Menu, X
} from 'lucide-react';
import { useState } from 'react';

export default function Sidebar() {
  const { user, logout, isAdmin, isDoctor, isPatient } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const navItems = [];

  // Dashboard — available to all
  navItems.push({ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'Main' });

  // Admin links
  if (isAdmin()) {
    navItems.push({ to: '/doctors', icon: Stethoscope, label: 'Doctors', section: 'Management' });
    navItems.push({ to: '/patients', icon: Users, label: 'Patients', section: 'Management' });
    navItems.push({ to: '/departments', icon: Building2, label: 'Departments', section: 'Management' });
    navItems.push({ to: '/appointments', icon: Calendar, label: 'Appointments', section: 'Management' });
    navItems.push({ to: '/medical-records', icon: FileText, label: 'Medical Records', section: 'Management' });
    navItems.push({ to: '/bills', icon: Receipt, label: 'Billing', section: 'Management' });
  }

  // Doctor links
  if (isDoctor()) {
    navItems.push({ to: '/appointments', icon: Calendar, label: 'My Appointments', section: 'My Work' });
    navItems.push({ to: '/medical-records', icon: FileText, label: 'Medical Records', section: 'My Work' });
    navItems.push({ to: '/patients', icon: Users, label: 'My Patients', section: 'My Work' });
  }

  // Patient links
  if (isPatient()) {
    navItems.push({ to: '/appointments', icon: Calendar, label: 'My Appointments', section: 'My Health' });
    navItems.push({ to: '/medical-records', icon: FileText, label: 'Medical Records', section: 'My Health' });
    navItems.push({ to: '/bills', icon: Receipt, label: 'My Bills', section: 'My Health' });
    navItems.push({ to: '/doctors', icon: Stethoscope, label: 'Find Doctors', section: 'My Health' });
  }

  navItems.push({ to: '/profile', icon: UserCircle, label: 'My Profile', section: 'Account' });

  // Group by section
  const sections = {};
  navItems.forEach(item => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 150 }}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99, display: 'none',
          }}
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Heart size={24} />
          </div>
          <div className="sidebar-brand">
            <h1>MedCore HMS</h1>
            <span>Hospital Management</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <div className="sidebar-section-label">{section}</div>
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <p>{user?.fullName || user?.username}</p>
              <p>{user?.role}</p>
            </div>
          </div>
          <button
            className="nav-link"
            style={{ width: '100%', marginTop: 8, color: 'var(--danger)' }}
            onClick={handleLogout}
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
