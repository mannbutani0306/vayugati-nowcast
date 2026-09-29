import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import GovernmentHeader from './components/GovernmentHeader';
import LoginModal from './components/LoginModal';
import LandingPage from './pages/LandingPage';
import CitizenPortal from './pages/CitizenPortal';
import OfficerDashboard from './pages/OfficerDashboard';
import AdminPortal from './pages/AdminPortal';
import DataSourcesPage from './pages/DataSourcesPage';
import DataLabPage from './pages/DataLabPage';
import {
  ShieldAlert,
  ArrowRight,
  Bell,
  X,
  Volume2,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  FileText,
  Lock,
  Globe,
  Radio,
} from 'lucide-react';

/**
 * Route Guard enforcing role-based access control (Citizen, Officer, Admin)
 */
function ProtectedRoute({ children, allowedRoles = [], onOpenLogin }) {
  const { profile, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#D9532F] border-t-transparent animate-spin"></div>
        <span className="text-xs font-mono text-[#6C7278]">Verifying VayuGati security tokens...</span>
      </div>
    );
  }

  const normalizeRole = (value) => {
    const normalized = String(value || 'citizen').trim().toLowerCase().replace(/[- ]/g, '_');
    return normalized === 'duty_officer' ? 'officer' : normalized;
  };
  const effectiveRole = normalizeRole(profile?.role || role);
  const hasAccess = allowedRoles.length === 0 || allowedRoles.some((allowedRole) => normalizeRole(allowedRole) === effectiveRole);

  if (!hasAccess) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-[#E5E0D8] rounded-xl text-center space-y-4 shadow-sm antialiased">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-[#1A1D20]">Restricted Operational Area</h3>
        <p className="text-xs text-[#6C7278] leading-relaxed">
          Your current session role is <strong className="text-[#1A1D20] capitalize">{effectiveRole}</strong>.
          Access to this console requires one of:{' '}
          <strong className="text-[#D9532F] uppercase">{allowedRoles.join(', ')}</strong> credentials.
        </p>
        <button
          type="button"
          onClick={onOpenLogin}
          className="bg-[#D9532F] hover:bg-[#BF4422] text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider inline-flex items-center space-x-2 transition-colors cursor-pointer"
        >
          <span>Switch sign-in role</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return children;
}

/**
 * Global Severe Weather Alert Toast Notification
 */
function GlobalAlertToast({ toast, onDismiss, onViewNowcast }) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[200] max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-[#1A1D20] text-white p-4 rounded-xl border border-red-500 shadow-2xl space-y-2.5" role="alert" aria-label="Approved severe weather alert">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white">
              {toast.tier || 'SEVERE'} ALERT APPROVED
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss weather alert"
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
            <span>{toast.title}</span>
          </h4>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            {toast.message}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-neutral-700 text-xs">
          <span className="text-[10px] font-mono text-neutral-400">
            Target: {toast.sector}
          </span>
          <button
            type="button"
            onClick={onViewNowcast}
            className="text-[11px] font-bold text-[#FF9933] hover:text-white flex items-center gap-1 uppercase transition-colors cursor-pointer"
          >
            <span>View Citizen Advisory</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * SIH prototype footer component
 */
function GovernmentFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E5E0D8] bg-[#08223B] text-white text-xs antialiased mt-auto">
      {/* 4px Tricolour Bar */}
      <div className="h-1 w-full grid grid-cols-3">
        <div className="bg-[#FF9933]"></div>
        <div className="bg-[#FFFFFF]"></div>
        <div className="bg-[#138808]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
        {/* Main Footer Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-[11px] text-neutral-300">
          {/* Col 1: Ministry Credentials */}
          <div className="space-y-2 md:col-span-1">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded bg-white text-[#0B2E4F] flex items-center justify-center font-bold text-xs">
                SIH
              </div>
              <span className="font-bold text-white text-xs block">VayuGati Nowcast</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              SIH26084 prototype. Not an official IMD, MoES, or NDMA warning service.
            </p>
            <span className="text-[10px] text-neutral-400 block font-mono">
              Historical replay and scenario prototype
            </span>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-2">
            <span className="font-bold text-white uppercase text-[10px] tracking-wider block">
              Core Applications
            </span>
            <ul className="space-y-1.5">
              <li>
                <Link to="/" className="hover:text-[#FF9933] transition-colors">Public Nowcast Landing</Link>
              </li>
              <li>
                <Link to="/citizen" className="hover:text-[#FF9933] transition-colors">Citizen Early Warning Portal</Link>
              </li>
              <li>
                <Link to="/officer" className="hover:text-[#FF9933] transition-colors">Duty Forecaster GIS Console</Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-[#FF9933] transition-colors">District Admin &amp; DDMA Command</Link>
              </li>
              <li>
                <Link to="/data-lab" className="hover:text-[#FF9933] transition-colors">Historical Replay &amp; Scenario Lab</Link>
              </li>
              <li>
                <Link
                  to="/data-sources"
                  onClick={(event) => {
                    if (['/citizen', '/officer', '/admin'].includes(location.pathname)
                      && !window.confirm('Leave your dashboard to view data sources?')) {
                      event.preventDefault();
                    }
                  }}
                  className="hover:text-[#FF9933] transition-colors"
                >Data Sources &amp; Attribution</Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Project and data notes */}
          <div className="space-y-2">
            <span className="font-bold text-white uppercase text-[10px] tracking-wider block">
              Project and data notes
            </span>
            <ul className="space-y-1.5 leading-relaxed">
              <li><Link to="/data-sources" className="hover:text-[#FF9933]">Data sources and attribution</Link></li>
              <li>Archives require applicable redistribution permission.</li>
              <li>Scenario outputs are illustrative, not warnings.</li>
            </ul>
          </div>

          {/* Col 4: National Emergency Directory */}
          <div className="space-y-2">
            <span className="font-bold text-white uppercase text-[10px] tracking-wider block">
              Disaster Response Lines
            </span>
            <ul className="space-y-1 font-mono text-[11px]">
              <li>NDMA National: <strong className="text-white">1070</strong></li>
              <li>State Disaster (SDMA): <strong className="text-white">1077</strong></li>
              <li>Emergency Services: <strong className="text-white">112 / 108</strong></li>
              <li>IMD Weather Desk: <strong className="text-white">1800-180-1717</strong></li>
            </ul>
            <div className="pt-1">
              <a
                href="https://india.gov.in"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1"
              >
                <span>National Portal of India</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}

function MainLayout() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleOpenLogin = () => {
    setIsLoginModalOpen(true);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Global Severe Alert Toast Notification State
  const [activeToast, setActiveToast] = useState(null);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1A1D20] flex flex-col font-sans">
      {/* Prototype header with status ribbon and accessibility controls */}
      <GovernmentHeader onOpenLogin={handleOpenLogin} />

      {/* Main Routed Content Area */}
      <main id="main-content" className="flex-1">
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage onOpenLogin={() => setIsLoginModalOpen(true)} />} />

          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/data-lab" element={<DataLabPage />} />

          {/* Citizen Early Warning Portal */}
          <Route
            path="/citizen"
            element={
              <ProtectedRoute allowedRoles={['citizen', 'officer', 'admin']} onOpenLogin={() => setIsLoginModalOpen(true)}>
                <CitizenPortal />
              </ProtectedRoute>
            }
          />

          {/* Duty Forecaster / SDRF Officer Console */}
          <Route
            path="/officer"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']} onOpenLogin={() => setIsLoginModalOpen(true)}>
                <OfficerDashboard />
              </ProtectedRoute>
            }
          />

          {/* District Admin & DDMA Command Portal */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']} onOpenLogin={() => setIsLoginModalOpen(true)}>
                <AdminPortal />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect to Landing Page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Global Severe Alert Toast Banner */}
      <GlobalAlertToast
        toast={activeToast}
        onDismiss={() => setActiveToast(null)}
        onViewNowcast={() => {
          setActiveToast(null);
          navigate('/citizen');
        }}
      />

      {/* Authentication modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* GIGW Compliant Government Footer */}
      <GovernmentFooter />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AccessibilityProvider>
        <AuthProvider>
          <MainLayout />
        </AuthProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  );
}
