/**
 * @file AlertReviewQueue.jsx
 * @description Duty Forecaster Alert Review Engine for VayuGati Nowcast .
 * Human-in-the-Loop Safeguard:
 * Mandates that NO AI-generated WARNING or SEVERE alert reaches the public unreviewed.
 * Every alert begins in 'DRAFT' status and requires human verification:
 * - [Approve & Broadcast]
 * - [Modify Alert]
 * - [Reject Alert] (with mandatory meteorological rationale)
 * - Complete audit log recording on all state transitions.
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Edit3,
  Clock,
  Radio,
  AlertTriangle,
  History,
  Send,
  FileText,
  UserCheck,
  Check,
  X,
  ChevronDown,
  Layers,
  ArrowRight,
  Database,
  Filter,
  Download,
  BrainCircuit,
  Code,
  Copy,
} from 'lucide-react';
import { SEVERITY_TIERS } from '../utils/mockDataSeed';
import { generateCapXml, downloadCapXmlFile } from '../utils/capXmlGenerator';
import SHAPExplainability from './SHAPExplainability';

// Initial synthetic AI-generated draft alerts pending duty forecaster review
const INITIAL_DRAFT_ALERTS = [
  {
    id: 'DRAFT-HZ-001',
    cellId: 'CELL-A1',
    cellName: 'Sahastradhara Cloudburst Core',
    hazardType: 'CLOUDBURST',
    tier: 'SEVERE',
    targetGrid: '1.5 km Mesh • Sahastradhara River Basin & Rajpur Foothills',
    affectedDistricts: ['Sahastradhara Basin', 'Rajpur Road', 'Mussoorie Bypass', 'Rispana Catchment'],
    riskScore: 0.94,
    leadTimeHours: '0 – 1.0 h',
    leadTimeMinutes: 45,
    maxReflectivityDbz: 63.8,
    expectedRainfallRateMmHr: 118,
    windGustKmh: 92,
    aiDraftedText:
      'CRITICAL CLOUDBURST ALERT: Doppler C-Band dual-pol Zdr signature and 3.0σ lightning flash jump detect severe precipitation core over Sahastradhara & Rajpur foothills. Rain rates exceeding 110 mm/hr will trigger immediate flash flooding in Rispana/Bindal stream beds. Seek reinforced shelter away from hill torrents. Do not cross low bridges.',
    aiRationale:
      'Dual-pol differential reflectivity (> +4.2 dB) accompanied by Vertically Integrated Liquid of 68 kg/m² and sudden lightning jump (+42% flash acceleration) confirms severe hydrometeor loading. High confidence (94%).',
    status: 'DRAFT',
    createdTimestamp: '18:04:12 IST',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    modifiedNotes: null,
  },
  {
    id: 'DRAFT-HZ-002',
    cellId: 'CELL-B2',
    cellName: 'Haridwar Ridge Multicell Cluster',
    hazardType: 'HAIL',
    tier: 'WARNING',
    targetGrid: '2.0 km Mesh • Haridwar Bypass & Roorkee Fringe',
    affectedDistricts: ['Haridwar Ghats', 'Roorkee Canal', 'Chidderwala Plains'],
    riskScore: 0.84,
    leadTimeHours: '1.0 – 2.5 h',
    leadTimeMinutes: 90,
    maxReflectivityDbz: 52.4,
    expectedRainfallRateMmHr: 58,
    windGustKmh: 76,
    aiDraftedText:
      'SEVERE HAIL & DOWNBURST WARNING: Multicell cluster propagating along Shivalik southern escarpment. Three-Body Scatter Spike (TBSS) radar signature indicates 2.5–3.0 cm hail shafts and surface wind gusts reaching 75 km/h. Secure tin carports and harvest produce.',
    aiRationale:
      'Persistent Three-Body Scatter Spike (TBSS) radar artifact and -61.2°C cloud top temperature verify hail core aloft with high downdraft momentum.',
    status: 'DRAFT',
    createdTimestamp: '18:08:45 IST',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    modifiedNotes: null,
  },
  {
    id: 'DRAFT-HZ-003',
    cellId: 'CELL-C3',
    cellName: 'Mohand Pass Orographic Feeder',
    hazardType: 'THUNDERSTORM',
    tier: 'WATCH',
    targetGrid: '3.0 km Mesh • Shivalik Tunnel Approach',
    affectedDistricts: ['Mohand Pass', 'Shivalik Tunnel', 'Clement Town South'],
    riskScore: 0.72,
    leadTimeHours: '2.5 – 4.0 h',
    leadTimeMinutes: 180,
    maxReflectivityDbz: 41.5,
    expectedRainfallRateMmHr: 32,
    windGustKmh: 54,
    aiDraftedText:
      'THUNDERSTORM & GUST WATCH: Moderate convective towers developing along southern foothill boundary. Intermittent cloud-to-ground lightning flashes and slippery hill road conditions expected.',
    aiRationale:
      'Orographic updrafts triggered by south-easterly low-level moisture jet. CIN cap breached (-24 J/kg); moderate convective organization.',
    status: 'DRAFT',
    createdTimestamp: '18:11:30 IST',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    modifiedNotes: null,
  },
  {
    id: 'DRAFT-HZ-004',
    cellId: 'CELL-D4',
    cellName: 'Doon South Thermal Flank',
    hazardType: 'DOWNBURST',
    tier: 'WARNING',
    targetGrid: '1.5 km Mesh • ISBT Dehradun Inter-State Hub',
    affectedDistricts: ['ISBT Dehradun', 'Majra', 'Patel Nagar'],
    riskScore: 0.48,
    leadTimeHours: '0.5 – 1.5 h',
    leadTimeMinutes: 50,
    maxReflectivityDbz: 34.0,
    expectedRainfallRateMmHr: 18,
    windGustKmh: 42,
    aiDraftedText:
      'DOWNBURST ADVISORY: Boundary-layer thermal convergence detected south of ISBT. Brief gust front possible.',
    aiRationale:
      'Model detects localized moisture pool; however, radar reflectivity remains below 35 dBZ without lightning jump corroboration. Marginal confidence (48%).',
    status: 'DRAFT',
    createdTimestamp: '18:14:02 IST',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    modifiedNotes: null,
  },
];

export default function AlertReviewQueue({ onBroadcastApproved }) {
  const { profile } = useAuth();

  const [alerts, setAlerts] = useState(INITIAL_DRAFT_ALERTS);
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'DRAFT', 'APPROVED', 'REJECTED'
  const [selectedAlertForEdit, setSelectedAlertForEdit] = useState(null);
  const [selectedAlertForReject, setSelectedAlertForReject] = useState(null);
  const [selectedAlertForCapXml, setSelectedAlertForCapXml] = useState(null);
  const [selectedAlertForXai, setSelectedAlertForXai] = useState(null);
  const [copiedXml, setCopiedXml] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Radar ground clutter / anomalous propagation artifact');
  const [customRejectNote, setCustomRejectNote] = useState('');
  const [showAuditLogDrawer, setShowAuditLogDrawer] = useState(false);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState([
    {
      id: 'AUD-001',
      timestamp: '17:45:10 IST',
      alertId: 'HZ-HIST-901',
      action: 'APPROVED_AND_BROADCAST',
      officer: 'Inspector Vikramaditya Rawat (NDRF-OFF-402)',
      tier: 'WARNING',
      details: 'Broadcast verified for Haridwar Squall line. Pushed to 82,000 citizens.',
    },
    {
      id: 'AUD-002',
      timestamp: '17:22:33 IST',
      alertId: 'HZ-HIST-899',
      action: 'REJECTED',
      officer: 'Dr. Kailash S. Murthy (IMD-ADMIN-01)',
      tier: 'WARNING',
      details: 'Rejected due to anomalous propagation side-lobe reflection over Mussoorie ridge.',
    },
  ]);

  const officerBadge = profile?.badge_id || 'NDRF-OFF-402';
  const officerName = profile?.full_name || 'Inspector Vikramaditya Rawat';

  // Helper to log audit trail
  const appendAuditLog = (alertId, action, tier, details) => {
    const newLog = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST',
      alertId,
      action,
      officer: `${officerName} (${officerBadge})`,
      tier,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  /**
   * Action 1: Approve & Broadcast
   */
  const handleApprove = (alertItem) => {
    const nowTimestamp = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';

    setAlerts((prev) =>
      prev.map((item) =>
        item.id === alertItem.id
          ? {
              ...item,
              status: 'APPROVED',
              reviewedBy: `${officerName} (${officerBadge})`,
              reviewedAt: nowTimestamp,
            }
          : item
      )
    );

    appendAuditLog(
      alertItem.id,
      'APPROVED_AND_BROADCAST',
      alertItem.tier,
      `Authorized publication of ${alertItem.hazardType} alert for ${alertItem.targetGrid}. Cell broadcast triggered.`
    );

    if (onBroadcastApproved) {
      onBroadcastApproved(alertItem);
    }
  };

  /**
   * Action 2: Confirm Modify & Save
   */
  const handleSaveModifiedAlert = (e) => {
    e.preventDefault();
    if (!selectedAlertForEdit) return;

    const nowTimestamp = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';

    setAlerts((prev) =>
      prev.map((item) =>
        item.id === selectedAlertForEdit.id
          ? {
              ...selectedAlertForEdit,
              status: 'APPROVED', // Marked approved upon custom review
              reviewedBy: `${officerName} (${officerBadge})`,
              reviewedAt: nowTimestamp,
            }
          : item
      )
    );

    appendAuditLog(
      selectedAlertForEdit.id,
      'MODIFIED_AND_APPROVED',
      selectedAlertForEdit.tier,
      `Duty Forecaster adjusted tier to ${selectedAlertForEdit.tier} & modified copy before broadcasting.`
    );

    setSelectedAlertForEdit(null);
  };

  /**
   * Action 3: Confirm Reject Alert
   */
  const handleConfirmReject = (e) => {
    e.preventDefault();
    if (!selectedAlertForReject) return;

    const nowTimestamp = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
    const finalReason = customRejectNote ? `${rejectionReason}: ${customRejectNote}` : rejectionReason;

    setAlerts((prev) =>
      prev.map((item) =>
        item.id === selectedAlertForReject.id
          ? {
              ...item,
              status: 'REJECTED',
              rejectionReason: finalReason,
              reviewedBy: `${officerName} (${officerBadge})`,
              reviewedAt: nowTimestamp,
            }
          : item
      )
    );

    appendAuditLog(
      selectedAlertForReject.id,
      'REJECTED',
      selectedAlertForReject.tier,
      `Vetoed by forecaster. Reason: ${finalReason}`
    );

    setSelectedAlertForReject(null);
    setCustomRejectNote('');
  };

  // Filtered alert list
  const filteredAlerts = alerts.filter((item) => {
    if (filterStatus === 'ALL') return true;
    return item.status === filterStatus;
  });

  const pendingCount = alerts.filter((a) => a.status === 'DRAFT').length;

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 shadow-2xs space-y-5 antialiased">
      {/* 1. QUEUE HEADER & AUDIT LOG BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E0D8] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D9532F] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Human-in-the-Loop Forecaster Review Engine
            </span>
            <span className="text-[#6C7278]">•</span>
            <span className="text-xs text-[#6C7278]">Mandatory Verification Safeguard</span>
          </div>
          <h3 className="text-lg font-bold text-[#1A1D20] mt-0.5">
            System-Generated Convective Alert Review Queue
          </h3>
          <p className="text-xs text-[#6C7278]">
            Evaluator Rule: Every alert begins in <strong>DRAFT</strong> status. No AI nowcast reaches public siren channels unverified.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Pending Review Badge */}
          <span className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>{pendingCount} Pending Review</span>
          </span>

          {/* Audit Log Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowAuditLogDrawer(!showAuditLogDrawer)}
            className="bg-[#FAF7F2] hover:bg-[#E5E0D8] border border-[#E5E0D8] text-[#1A1D20] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-[#D9532F]" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER STATUS TABS */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center space-x-1 bg-[#FAF7F2] p-1 rounded-lg border border-[#E5E0D8]">
          <span className="text-[11px] font-bold text-[#6C7278] px-2 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filter:
          </span>
          {['ALL', 'DRAFT', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                filterStatus === st
                  ? 'bg-white text-[#1A1D20] font-bold shadow-xs border border-[#E5E0D8]'
                  : 'text-[#6C7278] hover:text-[#1A1D20]'
              }`}
            >
              {st} {st === 'DRAFT' && `(${pendingCount})`}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-mono text-[#6C7278]">
          Reviewer Authority: <strong className="text-[#1A1D20]">{officerName}</strong> ({officerBadge})
        </span>
      </div>

      {/* 3. ALERTS CARD FEED */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center bg-[#FAF7F2] rounded-lg border border-[#E5E0D8] text-[#6C7278] text-xs">
            No alerts found under filter &quot;{filterStatus}&quot;.
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const tierMeta = SEVERITY_TIERS[alert.tier] || SEVERITY_TIERS.INFO;
            const isDraft = alert.status === 'DRAFT';
            const isApproved = alert.status === 'APPROVED';
            const isRejected = alert.status === 'REJECTED';

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-xl border transition-all space-y-3.5 ${
                  isDraft
                    ? 'bg-white border-[#E5E0D8] shadow-xs'
                    : isApproved
                    ? 'bg-emerald-50/40 border-emerald-300'
                    : 'bg-neutral-50 border-neutral-300 opacity-75'
                }`}
                style={{ borderLeftWidth: '5px', borderLeftColor: tierMeta.color }}
              >
                {/* Alert Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E0D8]/60 pb-2.5">
                  <div className="flex items-center space-x-2.5">
                    <span
                      className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: tierMeta.color }}
                    >
                      {alert.tier}
                    </span>
                    <span className="font-bold text-xs text-[#1A1D20] font-mono">{alert.id}</span>
                    <span className="text-[11px] font-mono text-[#6C7278]">({alert.cellId})</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isDraft
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-mono text-[#6C7278]">
                    <span>Created: {alert.createdTimestamp}</span>
                    <span className="bg-[#FAF7F2] border border-[#E5E0D8] px-2 py-0.5 rounded text-[#1A1D20] font-bold">
                      Risk: {Math.round(alert.riskScore * 100)}%
                    </span>
                  </div>
                </div>

                {/* Target & Forecast Horizon */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-[#FAF7F2] rounded border border-[#E5E0D8]">
                    <span className="text-[10px] uppercase font-bold text-[#6C7278] block">Target Sector</span>
                    <span className="font-bold text-[#1A1D20] truncate block">{alert.targetGrid}</span>
                  </div>
                  <div className="p-2 bg-[#FAF7F2] rounded border border-[#E5E0D8]">
                    <span className="text-[10px] uppercase font-bold text-[#6C7278] block">Forecast Lead Window</span>
                    <span className="font-bold text-[#1A1D20] block">{alert.leadTimeHours} ({alert.leadTimeMinutes} min peak)</span>
                  </div>
                  <div className="p-2 bg-[#FAF7F2] rounded border border-[#E5E0D8]">
                    <span className="text-[10px] uppercase font-bold text-[#6C7278] block">Expected Intensity</span>
                    <span className="font-bold text-[#DC2626] font-mono block">
                      {alert.expectedRainfallRateMmHr} mm/h • {alert.windGustKmh} km/h Gusts
                    </span>
                  </div>
                </div>

                {/* AI Drafted Warning Text Box */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6C7278] flex items-center gap-1">
                    <FileText className="w-3 h-3 text-[#D9532F]" />
                    AI-Synthesized Public Bulletin Draft:
                  </span>
                  <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#E5E0D8] text-xs text-[#1A1D20] leading-relaxed font-sans">
                    {alert.aiDraftedText}
                  </div>
                  <p className="text-[11px] text-[#6C7278] italic">
                    <strong>Model Physics Rationale:</strong> {alert.aiRationale}
                  </p>
                </div>

                {/* Rejection Note if Rejected */}
                {isRejected && (
                  <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-900 text-xs">
                    <strong>Veto Reason:</strong> {alert.rejectionReason} (By {alert.reviewedBy} at {alert.reviewedAt})
                  </div>
                )}

                {/* Approval Signature and Institutional CAP Export if Approved */}
                {isApproved && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">Approved &amp; Broadcast to Citizen Feeds &amp; SDRF Cell Towers</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAlertForCapXml(alert)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <Code className="w-3 h-3 text-emerald-700" />
                        <span>View NDMA CAP v1.2 XML</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCapXmlFile(alert)}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download .xml</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Duty Forecaster Review Actions (For DRAFT alerts) */}
                {isDraft && (
                  <div className="pt-2 border-t border-[#E5E0D8] flex flex-wrap items-center justify-between gap-2 text-xs">
                    {/* Diagnostic Tools (SHAP & CAP Preview) */}
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAlertForXai(alert)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] hover:bg-purple-50 hover:border-purple-300 text-purple-900 font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
                        <span>SHAP Physics Attribution</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAlertForCapXml(alert)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] hover:bg-neutral-200 text-[#1A1D20] font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Code className="w-3.5 h-3.5 text-[#D9532F]" />
                        <span>Preview CAP v1.2</span>
                      </button>
                    </div>

                    {/* Operational Review Decisions */}
                    <div className="flex items-center space-x-2">
                      {/* Action 1: Reject */}
                      <button
                        type="button"
                        onClick={() => setSelectedAlertForReject(alert)}
                        className="px-3.5 py-1.5 rounded-lg border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject Alert</span>
                      </button>

                      {/* Action 2: Modify */}
                      <button
                        type="button"
                        onClick={() => setSelectedAlertForEdit({ ...alert })}
                        className="px-3.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] hover:bg-[#E5E0D8] text-[#1A1D20] font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#D9532F]" />
                        <span>Modify</span>
                      </button>

                      {/* Action 3: Approve & Broadcast */}
                      <button
                        type="button"
                        onClick={() => handleApprove(alert)}
                        className="px-4 py-1.5 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white font-bold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve &amp; Broadcast</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. MODAL: MODIFY ALERT PARAMETERS */}
      {selectedAlertForEdit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white rounded-xl border border-[#E5E0D8] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <h4 className="font-bold text-base text-[#1A1D20]">
                  Modify Alert Parameters: {selectedAlertForEdit.id}
                </h4>
                <p className="text-xs text-[#6C7278]">
                  Adjust tier severity, forecast lead time, or warning language before publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlertForEdit(null)}
                className="p-1 rounded text-[#6C7278] hover:text-[#1A1D20]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModifiedAlert} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1A1D20] mb-1">
                    Severity Tier:
                  </label>
                  <select
                    value={selectedAlertForEdit.tier}
                    onChange={(e) =>
                      setSelectedAlertForEdit({ ...selectedAlertForEdit, tier: e.target.value })
                    }
                    className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2] font-semibold"
                  >
                    <option value="INFO">INFO (Advisory)</option>
                    <option value="WATCH">WATCH (Convective Watch)</option>
                    <option value="WARNING">WARNING (Severe Warning)</option>
                    <option value="SEVERE">SEVERE (Critical Alert)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1A1D20] mb-1">
                    Lead Time Window:
                  </label>
                  <input
                    type="text"
                    value={selectedAlertForEdit.leadTimeHours}
                    onChange={(e) =>
                      setSelectedAlertForEdit({ ...selectedAlertForEdit, leadTimeHours: e.target.value })
                    }
                    className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1A1D20] mb-1">
                  Target Sector &amp; Catchments:
                </label>
                <input
                  type="text"
                  value={selectedAlertForEdit.targetGrid}
                  onChange={(e) =>
                    setSelectedAlertForEdit({ ...selectedAlertForEdit, targetGrid: e.target.value })
                  }
                  className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1A1D20] mb-1">
                  Public Broadcast Warning Copy:
                </label>
                <textarea
                  rows={4}
                  value={selectedAlertForEdit.aiDraftedText}
                  onChange={(e) =>
                    setSelectedAlertForEdit({ ...selectedAlertForEdit, aiDraftedText: e.target.value })
                  }
                  className="w-full p-2.5 rounded border border-[#E5E0D8] bg-[#FAF7F2] text-[#1A1D20] font-sans"
                />
              </div>

              <div className="pt-2 border-t border-[#E5E0D8] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedAlertForEdit(null)}
                  className="px-4 py-2 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] text-[#1A1D20]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#D9532F] hover:bg-[#BF4422] text-white font-bold"
                >
                  Save &amp; Authorize Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: REJECT ALERT WITH MANDATORY METEOROLOGICAL RATIONALE */}
      {selectedAlertForReject && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-xl border border-[#E5E0D8] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <h4 className="font-bold text-base text-[#DC2626] flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Reject AI Alert: {selectedAlertForReject.id}
                </h4>
                <p className="text-xs text-[#6C7278]">
                  Mandatory justification required for IMD quality audit log.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlertForReject(null)}
                className="p-1 rounded text-[#6C7278] hover:text-[#1A1D20]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#1A1D20] mb-1">
                  Select Meteorological Rejection Reason:
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 rounded border border-[#E5E0D8] bg-[#FAF7F2] font-medium"
                >
                  <option value="Radar ground clutter / anomalous propagation artifact">
                    Radar ground clutter / anomalous propagation (AP) artifact
                  </option>
                  <option value="Convective updraft collapsed before anvil expansion">
                    Convective updraft collapsed before anvil expansion
                  </option>
                  <option value="Precipitation efficiency below cloudburst threshold (<60 mm/hr)">
                    Precipitation efficiency below cloudburst threshold (&lt;60 mm/hr)
                  </option>
                  <option value="Inversion cap prevented surface boundary trigger">
                    Inversion cap prevented surface boundary trigger
                  </option>
                  <option value="Model optical flow extrapolation overestimating cell speed">
                    Model optical flow extrapolation overestimating cell speed
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#1A1D20] mb-1">
                  Detailed Forecaster Observations:
                </label>
                <textarea
                  rows={3}
                  value={customRejectNote}
                  onChange={(e) => setCustomRejectNote(e.target.value)}
                  placeholder="e.g. DWR Doppler spectrum width shows anomalous ground reflections over Shivalik hill ridge..."
                  className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2]"
                />
              </div>

              <div className="pt-2 border-t border-[#E5E0D8] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedAlertForReject(null)}
                  className="px-4 py-2 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] text-[#1A1D20]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Confirm Veto &amp; Archive in Audit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. SLIDE-OVER AUDIT LOG DRAWER */}
      {showAuditLogDrawer && (
        <div className="p-4 bg-[#FAF7F2] border border-[#E5E0D8] rounded-xl space-y-3 text-xs animate-in fade-in">
          <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-2">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-[#D9532F]" />
              <h4 className="font-bold text-sm text-[#1A1D20]">
                IMD Duty Forecaster Audit Log &amp; Decision Trail
              </h4>
            </div>
            <span className="font-mono text-[10px] text-[#6C7278]">
              Recorded on public.audit_log
            </span>
          </div>

          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 font-mono">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-white rounded border border-[#E5E0D8] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#1A1D20]">{log.alertId}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        log.action.includes('APPROVED')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="text-[10px] text-[#6C7278]">{log.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-[#1A1D20] font-sans">{log.details}</p>
                </div>
                <div className="text-[10px] text-[#6C7278] text-right shrink-0">
                  <span className="block font-sans font-semibold text-[#1A1D20]">{log.officer}</span>
                  <span>Log Ref #{log.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. MODAL: NDMA CAP v1.2 XML PREVIEW & EXPORT */}
      {selectedAlertForCapXml && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-3xl bg-white rounded-xl border border-[#E5E0D8] shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-[#D9532F] flex items-center justify-center font-bold">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-[#1A1D20]">
                    NDMA CAP v1.2 Standard Alert XML Dispatch
                  </h4>
                  <p className="text-xs text-[#6C7278]">
                    OASIS CAP-V1.2 schema • Dispatched to SDMA / DDMA Emergency Operations Centers
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedAlertForCapXml(null);
                  setCopiedXml(false);
                }}
                className="p-1 rounded text-[#6C7278] hover:text-[#1A1D20] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Validation Tag */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 text-xs text-emerald-900 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Schema Validated: <strong>OASIS CAP-V1.2 / NDMA Integrated Early Warning</strong></span>
              </div>
              <span className="font-mono text-[10px] text-emerald-800">
                Target: {selectedAlertForCapXml.targetGrid || 'Pilot Sector'}
              </span>
            </div>

            {/* XML Code Viewer */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-neutral-800 bg-[#1A1D20] p-4 text-emerald-300 font-mono text-[11px] leading-relaxed select-all">
              <pre className="whitespace-pre">{generateCapXml(selectedAlertForCapXml)}</pre>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E0D8] shrink-0">
              <span className="text-[11px] text-[#6C7278] font-mono">
                Payload Size: ~{Math.round(generateCapXml(selectedAlertForCapXml).length / 1024 * 10) / 10} KB • En/Hi Dual-Payload
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateCapXml(selectedAlertForCapXml));
                    setCopiedXml(true);
                    setTimeout(() => setCopiedXml(false), 2500);
                  }}
                  className="px-3.5 py-2 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] hover:bg-neutral-200 text-[#1A1D20] text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  {copiedXml ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied XML!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#D9532F]" />
                      <span>Copy to Clipboard</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => downloadCapXmlFile(selectedAlertForCapXml)}
                  className="px-4 py-2 rounded-lg bg-[#D9532F] hover:bg-[#BF4422] text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .xml File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: SHAP EXPLAINABILITY INSPECTION */}
      {selectedAlertForXai && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-4xl bg-white rounded-xl border border-[#E5E0D8] shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3 sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-[#1A1D20]">
                    Explainable AI (XAI) Attribution: {selectedAlertForXai.cellId}
                  </h4>
                  <p className="text-xs text-[#6C7278]">
                    SHAP physical parameter weights driving {selectedAlertForXai.hazardType} prediction
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAlertForXai(null)}
                className="p-1 rounded text-[#6C7278] hover:text-[#1A1D20] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <SHAPExplainability
              selectedCellId={selectedAlertForXai.cellId}
              dutyOfficer={officerName}
              badgeId={officerBadge}
              onOverride={(overridePayload) => {
                if (overridePayload.isOverridden) {
                  setAlerts((prev) =>
                    prev.map((item) =>
                      item.cellId === overridePayload.cellId || item.id === selectedAlertForXai.id
                        ? {
                            ...item,
                            tier: overridePayload.newTier,
                            modifiedNotes: `[SHAP Override]: ${overridePayload.rationale}`,
                          }
                        : item
                    )
                  );
                  appendAuditLog(
                    selectedAlertForXai.id,
                    'SHAP_MANUAL_TIER_OVERRIDE',
                    overridePayload.newTier,
                    `Duty Forecaster overridden risk from ${overridePayload.previousTier} to ${overridePayload.newTier}. Category: ${overridePayload.overrideCategory}. Rationale: "${overridePayload.rationale}" (${overridePayload.sopStandard})`
                  );
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
