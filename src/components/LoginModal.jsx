import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  X,
  User,
  Radio,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
} from 'lucide-react';

const DEMO_PRESETS = {
  citizen: {
    roleName: 'Citizen / Community Observer',
    email: 'citizen@vayugati.gov.in',
    password: 'Citizen123!',
    route: '/citizen',
    description: 'Citizen portal',
    icon: User,
  },
  officer: {
    roleName: 'Duty Forecaster / SDRF Officer',
    email: 'officer@vayugati.gov.in',
    password: 'Officer123!',
    route: '/officer',
    description: 'Officer portal',
    icon: Radio,
  },
  admin: {
    roleName: 'District / State IMD Admin',
    email: 'admin@vayugati.gov.in',
    password: 'Admin123!',
    route: '/admin',
    description: 'Administrator portal',
    icon: Sliders,
  },
};

export default function LoginModal({ isOpen, onClose, embedded = false }) {
  const { login } = useAuth();
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
    setSuccessMessage('');
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
        onClose?.();
        navigate(targetRoute);
      }, 500);
    } catch (err) {
      // In case of unexpected rejection, fall back to current tab's demo profile
      console.warn('Login execution note:', err);
      const targetRoute = DEMO_PRESETS[activeTab].route;
      onClose?.();
      navigate(targetRoute);
    }
  };

  if (!embedded && !isOpen) return null;

  return (
    <div id={embedded ? 'portal-login' : undefined} className={embedded ? 'w-full' : 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200'}>
      <div className={`relative w-full ${embedded ? '' : 'max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto'} bg-[#FFFFFF] rounded-xl border border-[#E5E0D8] shadow-2xl`}>
        {!embedded && <div className="h-1.5 w-full grid grid-cols-3">
          <div className="bg-[#FF9933]"></div>
          <div className="bg-[#FFFFFF]"></div>
          <div className="bg-[#138808]"></div>
        </div>}

        <div className="p-4 sm:p-5">
          {/* Header Row */}
          <div className="flex items-start justify-between pb-3 border-b border-[#E5E0D8]">
            <div>
              <h3 className="text-base font-bold text-[#1A1D20]">Portal sign in</h3>
              <p className="text-xs text-[#6C7278]">Choose a role and enter its authorized credentials.</p>
            </div>
            {!embedded && <button
              type="button"
              onClick={onClose}
              aria-label="Close sign-in"
              className="p-1 text-[#6C7278] hover:text-[#1A1D20] rounded hover:bg-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-[#1A1D20] mb-1.5">Role</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#FAF7F2] rounded-lg border border-[#E5E0D8]">
              {(['citizen', 'officer', 'admin']).map((r) => {
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
                    {r === 'citizen' ? 'Citizen' : r === 'officer' ? 'Officer' : 'Admin'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Standard Form Submission */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#1A1D20] mb-1">Authorized email</label>
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

        </div>
      </div>
    </div>
  );
}
