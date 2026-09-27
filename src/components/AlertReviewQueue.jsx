import React, { useEffect, useRef, useState } from 'react';
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
  X,
  ChevronDown,
  Layers,
  ArrowRight,
  Database,
  Filter,
  BrainCircuit,
} from 'lucide-react';
import { SEVERITY_TIERS } from '../utils/mockDataSeed';
import { fetchOfficerAlerts, fetchCapAlertAuditLogs, subscribeToCapAlerts, beginAlertReview, approveAlert, rejectAlert } from '../lib/spatialQueries';
import SHAPExplainability from './SHAPExplainability';

export default function AlertReviewQueue({ onBroadcastApproved }) {
  const { profile } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [pendingAlertId, setPendingAlertId] = useState(null);
  const loadSeq = useRef(0);
  const [selectedAlertForEdit, setSelectedAlertForEdit] = useState(null);
  const [selectedAlertForReject, setSelectedAlertForReject] = useState(null);
  const [selectedAlertForXai, setSelectedAlertForXai] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('Radar ground clutter / anomalous propagation artifact');
  const [customRejectNote, setCustomRejectNote] = useState('');
  const [showAuditLogDrawer, setShowAuditLogDrawer] = useState(false);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    let mounted = true;
    let subscription;
    const refreshAlerts = () => {
      const request = ++loadSeq.current;
      fetchOfficerAlerts()
        .then((rows) => { if (mounted && request === loadSeq.current) setAlerts(rows); })
        .catch((error) => {
          if (mounted && request === loadSeq.current) setQueueError(error.message || 'Unable to refresh CAP alerts.');
        });
    };
    const refreshAuditLogs = () => fetchCapAlertAuditLogs()
      .then((rows) => { if (mounted) setAuditLogs(rows); })
      .catch((error) => { if (mounted) setQueueError(error.message || 'Unable to load CAP audit history.'); });
    const initialRequest = ++loadSeq.current;
    fetchOfficerAlerts()
      .then((rows) => { if (mounted && initialRequest === loadSeq.current) setAlerts(rows); })
      .catch((error) => {
        if (mounted && initialRequest === loadSeq.current) setQueueError(error.message || 'Unable to load CAP alerts.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    refreshAuditLogs();
    try {
      subscription = subscribeToCapAlerts(({ alert }) => {
        if (alert?.id) {
          refreshAlerts();
          refreshAuditLogs();
        }
      });
    } catch (error) {
      setQueueError(error.message || 'CAP alert realtime is unavailable.');
    }
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const officerBadge = profile?.badge_id || 'NDRF-OFF-402';
  const officerName = profile?.full_name || 'Inspector Vikramaditya Rawat';

  /**
   * Action 1: Approve & Broadcast
   */
  const handleApprove = async (alertItem, editedText = {}) => {
    if (pendingAlertId || alertItem.trainingOnly || !['DRAFT', 'UNDER_REVIEW'].includes(alertItem.status)) return;
    setPendingAlertId(alertItem.id);
    const nowTimestamp = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
    try {
      let reviewRow = alertItem;
      if (alertItem.status === 'DRAFT') {
        const review = await beginAlertReview(alertItem.id, editedText);
        if (review.error) throw review.error;
        reviewRow = Array.isArray(review.data) ? review.data[0] : review.data;
        setAlerts((prev) => prev.map((item) => item.id === alertItem.id
          ? { ...item, ...(reviewRow || {}), status: 'UNDER_REVIEW' }
          : item));
      }
      const result = await approveAlert(alertItem.id);
      if (result.error) throw result.error;
      const approvedRow = Array.isArray(result.data) ? result.data[0] : result.data;
      const approvedAlert = {
        ...alertItem,
        ...(reviewRow || {}),
        ...(approvedRow || {}),
        headline: approvedRow?.headline_en || reviewRow?.headline_en || alertItem.headline_en,
        aiDraftedText: approvedRow?.description_en || reviewRow?.description_en || alertItem.aiDraftedText,
        headline_hi: approvedRow?.headline_hi || reviewRow?.headline_hi || alertItem.headline_hi,
        headline_mr: approvedRow?.headline_mr || reviewRow?.headline_mr || alertItem.headline_mr,
        description_hi: approvedRow?.description_hi || reviewRow?.description_hi || alertItem.description_hi,
        description_mr: approvedRow?.description_mr || reviewRow?.description_mr || alertItem.description_mr,
        targetGrid: approvedRow?.location_label || reviewRow?.location_label || alertItem.targetGrid,
        tier: ({ Extreme: 'SEVERE', Severe: 'WARNING', Moderate: 'WATCH', Minor: 'INFO' })[approvedRow?.severity || reviewRow?.severity] || alertItem.tier,
        leadTimeMinutes: approvedRow?.eta_minutes ?? reviewRow?.eta_minutes ?? alertItem.leadTimeMinutes,
        status: 'APPROVED',
      };
      setAlerts((prev) => prev.map((item) => item.id === alertItem.id
        ? { ...item, ...approvedAlert, reviewedBy: `${officerName} (${officerBadge})`, reviewedAt: approvedRow?.approved_at || nowTimestamp }
        : item));
      onBroadcastApproved?.(approvedAlert);
      return true;
    } catch (error) {
      setQueueError(error.message || 'Alert approval failed.');
      return false;
    } finally {
      setPendingAlertId(null);
    }
  };

  /**
   * Action 2: Confirm Modify & Save
   */
  const handleSaveModifiedAlert = async (e) => {
    e.preventDefault();
    if (!selectedAlertForEdit) return;

    const tierSeverity = { SEVERE: 'Extreme', WARNING: 'Severe', WATCH: 'Moderate', INFO: 'Minor' };
    const approved = await handleApprove(selectedAlertForEdit, {
      description_en: selectedAlertForEdit.aiDraftedText,
      headline_hi: selectedAlertForEdit.headline_hi,
      headline_mr: selectedAlertForEdit.headline_mr,
      description_hi: selectedAlertForEdit.description_hi,
      description_mr: selectedAlertForEdit.description_mr,
      severity: tierSeverity[selectedAlertForEdit.tier],
      location_label: selectedAlertForEdit.targetGrid,
      eta_minutes: selectedAlertForEdit.leadTimeMinutes,
    });
    if (approved) setSelectedAlertForEdit(null);
  };

  /**
   * Action 3: Confirm Reject Alert
   */
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!selectedAlertForReject) return;

    const finalReason = customRejectNote ? `${rejectionReason}: ${customRejectNote}` : rejectionReason;
    if (pendingAlertId) return;
    setPendingAlertId(selectedAlertForReject.id);
    try {
      if (selectedAlertForReject.status === 'DRAFT') {
        const review = await beginAlertReview(selectedAlertForReject.id);
        if (review.error) throw review.error;
        const reviewRow = Array.isArray(review.data) ? review.data[0] : review.data;
        setAlerts((prev) => prev.map((item) => item.id === selectedAlertForReject.id
          ? { ...item, ...(reviewRow || {}), status: 'UNDER_REVIEW' }
          : item));
        setSelectedAlertForReject((item) => ({ ...item, ...(reviewRow || {}), status: 'UNDER_REVIEW' }));
      }
      const result = await rejectAlert(selectedAlertForReject.id, finalReason);
      if (result.error) throw result.error;
      const rejectedRow = Array.isArray(result.data) ? result.data[0] : result.data;
      setAlerts((prev) => prev.map((item) => item.id === selectedAlertForReject.id
        ? { ...item, ...(rejectedRow || {}), status: 'REJECTED', rejectionReason: finalReason }
        : item));
      setSelectedAlertForReject(null);
      setCustomRejectNote('');
    } catch (error) {
      setQueueError(error.message || 'Alert rejection failed.');
    } finally {
      setPendingAlertId(null);
    }
  };

  // Filtered alert list
  const filteredAlerts = alerts.filter((item) => {
    if (filterStatus === 'ALL') return true;
    return item.status === filterStatus;
  });

  const pendingCount = alerts.filter((a) => a.status === 'DRAFT' || a.status === 'UNDER_REVIEW').length;

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

      {(queueError || loading) && (
        <div className={`rounded border px-3 py-2 text-xs ${queueError ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`} role={queueError ? 'alert' : 'status'}>
          {queueError || 'Loading CAP alerts from Supabase…'}
        </div>
      )}

      {/* 2. FILTER STATUS TABS */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center space-x-1 bg-[#FAF7F2] p-1 rounded-lg border border-[#E5E0D8]">
          <span className="text-[11px] font-bold text-[#6C7278] px-2 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filter:
          </span>
          {['ALL', 'DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((st) => (
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
            {loading ? 'Loading CAP alerts…' : `No alerts found under filter "${filterStatus}".`}
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const tierMeta = SEVERITY_TIERS[alert.tier] || SEVERITY_TIERS.INFO;
            const isDraft = alert.status === 'DRAFT';
            const isUnderReview = alert.status === 'UNDER_REVIEW';
            const isApproved = alert.status === 'APPROVED';
            const isRejected = alert.status === 'REJECTED';
            const isTrainingOnly = alert.trainingOnly;

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-xl border transition-all space-y-3.5 ${
                      isDraft
                    ? 'bg-white border-[#E5E0D8] shadow-xs'
                        : isUnderReview
                        ? 'bg-blue-50/40 border-blue-300'
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
                          : isUnderReview
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {alert.status}
                    </span>
                    {isTrainingOnly && <span className="rounded border border-sky-300 bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900">TRAINING ONLY · NOT FOR BROADCAST</span>}
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

                {/* Approval Signature if Approved */}
                {isApproved && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">Approved &amp; available in the Citizen Portal. External agency broadcast is not configured.</span>
                    </div>
                  </div>
                )}

                {/* Duty Forecaster Review Actions (For DRAFT alerts) */}
                {(isDraft || isUnderReview) && (
                  <div className="pt-2 border-t border-[#E5E0D8] flex flex-wrap items-center justify-between gap-2 text-xs">
                    {/* Diagnostic Tools */}
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAlertForXai(alert)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] hover:bg-purple-50 hover:border-purple-300 text-purple-900 font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
                        <span>SHAP Physics Attribution</span>
                      </button>

                    </div>

                    {/* Operational Review Decisions */}
                    <div className="flex items-center space-x-2">
                      {/* Action 1: Reject */}
                      <button
                        type="button"
                        onClick={() => setSelectedAlertForReject(alert)}
                        disabled={pendingAlertId === alert.id}
                        className="px-3.5 py-1.5 rounded-lg border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject Alert</span>
                      </button>

                      {/* Action 2: Modify */}
                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => setSelectedAlertForEdit({ ...alert })}
                          disabled={pendingAlertId === alert.id}
                          className="px-3.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] hover:bg-[#E5E0D8] text-[#1A1D20] font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#D9532F]" />
                          <span>Modify</span>
                        </button>
                      )}

                      {/* Action 3: Approve & Broadcast */}
                      {!isTrainingOnly && <button
                        type="button"
                        onClick={() => handleApprove(alert)}
                        disabled={pendingAlertId === alert.id}
                        className="px-4 py-1.5 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white font-bold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{pendingAlertId === alert.id ? 'Processing…' : 'Approve &amp; Broadcast'}</span>
                      </button>}
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
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-[#E5E0D8] shadow-2xl p-6 space-y-4">
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
                    type="number"
                    min="0"
                    max="1440"
                    value={selectedAlertForEdit.leadTimeMinutes ?? ''}
                    onChange={(e) =>
                      setSelectedAlertForEdit({ ...selectedAlertForEdit, leadTimeMinutes: e.target.value === '' ? null : Number(e.target.value) })
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="review-headline-hi" className="block font-semibold text-[#1A1D20] mb-1">Hindi warning title</label>
                  <input id="review-headline-hi" value={selectedAlertForEdit.headline_hi || ''} onChange={(e) => setSelectedAlertForEdit({ ...selectedAlertForEdit, headline_hi: e.target.value })} className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2]" />
                </div>
                <div>
                  <label htmlFor="review-headline-mr" className="block font-semibold text-[#1A1D20] mb-1">Marathi warning title</label>
                  <input id="review-headline-mr" value={selectedAlertForEdit.headline_mr || ''} onChange={(e) => setSelectedAlertForEdit({ ...selectedAlertForEdit, headline_mr: e.target.value })} className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="review-description-hi" className="block font-semibold text-[#1A1D20] mb-1">Hindi advisory</label>
                  <textarea id="review-description-hi" rows={3} value={selectedAlertForEdit.description_hi || ''} onChange={(e) => setSelectedAlertForEdit({ ...selectedAlertForEdit, description_hi: e.target.value })} className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2]" />
                </div>
                <div>
                  <label htmlFor="review-description-mr" className="block font-semibold text-[#1A1D20] mb-1">Marathi advisory</label>
                  <textarea id="review-description-mr" rows={3} value={selectedAlertForEdit.description_mr || ''} onChange={(e) => setSelectedAlertForEdit({ ...selectedAlertForEdit, description_mr: e.target.value })} className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2]" />
                </div>
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
              Immutable rows from public.audit_logs
            </span>
          </div>

          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 font-mono">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-[#6C7278]">No persisted CAP audit events are available.</p>
            ) : auditLogs.map((log) => {
              const oldText = log.old_values?.description_en || log.old_values?.headline_en;
              const newText = log.new_values?.description_en || log.new_values?.headline_en;
              return (
                <div
                  key={log.log_id}
                  className="p-2.5 bg-white rounded border border-[#E5E0D8] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="font-bold text-[#1A1D20]">{log.entity_id}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.action.startsWith('APPROVE') ? 'bg-emerald-100 text-emerald-800' : log.action === 'BEGIN_REVIEW' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                        {log.action}
                      </span>
                      <span className="text-[10px] text-[#6C7278]">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-[#1A1D20] font-sans break-words">
                      {log.rationale || newText || 'State transition committed.'}
                    </p>
                    {oldText && newText && oldText !== newText && (
                      <p className="text-[10px] text-[#6C7278] font-sans break-words">Before: {oldText}<br />After: {newText}</p>
                    )}
                  </div>
                  <div className="text-[10px] text-[#6C7278] text-right shrink-0">
                    <span className="block font-sans font-semibold text-[#1A1D20]">Actor {log.actor_id}</span>
                    <span>Log Ref #{log.log_id}</span>
                  </div>
                </div>
              );
            })}
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
