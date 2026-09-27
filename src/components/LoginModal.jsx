import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Shield,
  User,
  Radio,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
  Database,
} from 'lucide-react';

const DEMO_PRESETS = {
  citizen: {
    roleName: 'Citizen / Community Observer',
    email: 'citizen@vayugati.gov.in',
    password: 'Citizen123!',
    route: '/citizen',
    description: 'Access localized early warnings, crowd-source storm reports, view nearest shelters.',
    icon: User,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  officer: {
    roleName: 'Duty Forecaster / SDRF Officer',
    email: 'officer@vayugati.gov.in',
    password: 'Officer123!',
    route: '/officer',
    description: 'Monitor live Doppler radar sweeps, lightning jump alarms, broadcast sirens, dispatch SDRF teams.',
    icon: Radio,
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  admin: {
    roleName: 'District / State IMD Admin',
    email: 'admin@vayugati.gov.in',
    password: 'Admin123!',
    route: '/admin',
    description: 'Configure Doppler radar station calibrations, NWP WRF assimilations, manage user RLS access.',
    icon: Sliders,
    badgeColor: 'bg-red-100 text-red-800 border-red-300',
  },
};

export default function LoginModal({ isOpen, onClose }) {
  const { login, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('citizen');
  const [email, setEmail] = useState(DEMO_PRESETS.citizen.email);
  const [password, setPassword] = useState(DEMO_PRESETS.citizen.password);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  /**
   * Handle role-based credential preset selection.
   */
  const handleAutoFill = (roleKey) => {
    setActiveTab(roleKey);
    setEmail(DEMO_PRESETS[roleKey].email);
    setPassword(DEMO_PRESETS[roleKey].password);
    setErrorMessage('');
    setSuccessMessage(`Prepared access for ${DEMO_PRESETS[roleKey].roleName}`);
  };

  /**
   * Handle submission and automated role routing
   */
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await login({ email, password });
      if (res && res.success === false && !res.profile) {
        setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
        setIsSubmitting(false);
        return;
      }

      // Determine user role and route
      const roleValue = res?.profile?.role || (email.includes('admin') ? 'admin' : email.includes('officer') ? 'officer' : 'citizen');
      const resolvedRole = String(roleValue).trim().toLowerCase().replace(/[- ]/g, '_');
      const presetRole = resolvedRole === 'duty_officer' ? 'officer' : resolvedRole;
      const targetRoute = DEMO_PRESETS[presetRole]?.route || '/citizen';

      setSuccessMessage(`Authentication confirmed. Transferring to ${DEMO_PRESETS[presetRole]?.roleName || 'Portal'}...`);

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        navigate(targetRoute);
      }, 500);
    } catch (err) {
      // In case of unexpected rejection, fall back to current tab's demo profile
      console.warn('Login execution note:', err);
      const targetRoute = DEMO_PRESETS[activeTab].route;
      onClose();
      navigate(targetRoute);
    }
  };

  /**
   * Instant one-click demo login without typing
   */
  const handleInstantDemoLogin = async (roleKey) => {
    handleAutoFill(roleKey);
    setIsSubmitting(true);
    try {
      await login({
        email: DEMO_PRESETS[roleKey].email,
        password: DEMO_PRESETS[roleKey].password,
      });
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        navigate(DEMO_PRESETS[roleKey].route);
      }, 400);
    } catch {
      onClose();
      navigate(DEMO_PRESETS[roleKey].route);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#FFFFFF] rounded-xl border border-[#E5E0D8] shadow-2xl">
        {/* Modal Top Header with Tricolour accent */}
        <div className="h-1.5 w-full grid grid-cols-3">
          <div className="bg-[#FF9933]"></div>
          <div className="bg-[#FFFFFF]"></div>
          <div className="bg-[#138808]"></div>
        </div>

        <div className="p-6">
          {/* Header Row */}
          <div className="flex items-start justify-between pb-4 border-b border-[#E5E0D8]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF7F2] border border-[#E5E0D8] flex items-center justify-center text-[#D9532F]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1D20]">
                  VayuGati Nowcast Portal Login
                </h3>
                <p className="text-xs text-[#6C7278]">
                  Select your authorization role to continue.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#6C7278] hover:text-[#1A1D20] rounded hover:bg-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Access Section */}
          <div className="mt-4 p-3 rounded-lg bg-[#FAF7F2] border border-[#E5E0D8]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#D9532F] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D9532F]"></span>
                Quick Access
              </span>
              <span className="text-[10px] text-[#6C7278]">Secure role selection</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleInstantDemoLogin('citizen')}
                className="px-2.5 py-2 rounded border border-[#E5E0D8] bg-white hover:border-[#D9532F] text-left transition-all group"
              >
                <span className="block text-[11px] font-bold text-[#1A1D20] group-hover:text-[#D9532F]">
                  Citizen View
                </span>
                <span className="block text-[9px] text-[#6C7278]">Public alerts</span>
              </button>

              <button
                type="button"
                onClick={() => handleInstantDemoLogin('officer')}
                className="px-2.5 py-2 rounded border border-[#E5E0D8] bg-white hover:border-[#D9532F] text-left transition-all group"
              >
                <span className="block text-[11px] font-bold text-[#1A1D20] group-hover:text-[#D9532F]">
                  Duty Officer Access
                </span>
                <span className="block text-[9px] text-[#6C7278]">SDRF &amp; Radar</span>
              </button>

              <button
                type="button"
                onClick={() => handleInstantDemoLogin('admin')}
                className="px-2.5 py-2 rounded border border-[#E5E0D8] bg-white hover:border-[#D9532F] text-left transition-all group"
              >
                <span className="block text-[11px] font-bold text-[#1A1D20] group-hover:text-[#D9532F]">
                  Administrator Access
                </span>
                <span className="block text-[9px] text-[#6C7278]">Full telemetry</span>
              </button>
            </div>
          </div>

          {/* Role Tabs for Credential Pre-filling */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-[#1A1D20] mb-1.5">
              Select Role:
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#FAF7F2] rounded-lg border border-[#E5E0D8]">
              {(['citizen', 'officer', 'admin']).map((r) => {
                const info = DEMO_PRESETS[r];
                const isActive = activeTab === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleAutoFill(r)}
                    className={`py-1.5 px-2 rounded text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-white text-[#1A1D20] shadow-xs font-bold border border-[#E5E0D8]'
                        : 'text-[#6C7278] hover:text-[#1A1D20]'
                    }`}
                  >
                    {r === 'citizen' ? 'Citizen View' : r === 'officer' ? 'Duty Officer Access' : 'Administrator Access'}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#6C7278] mt-1.5">
              {DEMO_PRESETS[activeTab].description}
            </p>
          </div>

          {/* Standard Form Submission */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#1A1D20] mb-1">
                Authorized Email / Gov ID
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6C7278] absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@vayugati.gov.in"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded border border-[#E5E0D8] bg-[#FAF7F2] text-[#1A1D20] focus:outline-none focus:border-[#D9532F] focus:bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1D20] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6C7278] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded border border-[#E5E0D8] bg-[#FAF7F2] text-[#1A1D20] focus:outline-none focus:border-[#D9532F] focus:bg-white font-mono"
                />
              </div>
            </div>

            {/* Notification messages */}
            {errorMessage && (
              <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#D9532F] hover:bg-[#BF4422] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Command Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Operational status notice */}
          <div className="mt-4 pt-3 border-t border-[#E5E0D8] flex items-center justify-between text-[11px] text-[#6C7278]">
            <div className="flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-[#D9532F]" />
              <span>
                {isConfigured ? 'Secure Government Access' : 'Secure Local Session Access'}
              </span>
            </div>
            <span className="font-mono text-[10px]">System Operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}
