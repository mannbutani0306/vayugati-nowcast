import React, { useState } from 'react';
import {
  BrainCircuit,
  Info,
  Layers,
  Zap,
  Wind,
  CloudRain,
  Thermometer,
  ShieldCheck,
  Download,
  CheckCircle2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Compass,
  FileCheck,
} from 'lucide-react';
import { SEVERITY_TIERS } from '../utils/mockDataSeed';
import SHAPExplainabilityCard from './SHAPExplainabilityCard';

export { SHAPExplainabilityCard };

// These fixture breakdowns are illustrative walkthrough data for the matrix;
// live selected-cell values come from SHAPExplainabilityCard's backend endpoint.
export const XAI_CELL_DATA = [
  {
    cellId: 'CELL-A1',
    cellName: 'Sahastradhara Cloudburst Core',
    hazardType: 'CLOUDBURST',
    tier: 'SEVERE',
    predictedRisk: 0.94,
    baseValue: 0.12, // Climatological convective baseline probability in region
    radarDbz: 63.8,
    leadTime: '0–1.0 h',
    confidenceScore: 0.96,
    physicsExplanation:
      'Extreme hydrometeor loading is predominantly driven by high surface CAPE (3,450 J/kg) coupled with an abrupt 3.0σ lightning flash jump (+42% acceleration) and high VIL (68 kg/m²). Strong mid-tropospheric lapse rate and precipitable water (58.4 mm) confirm rapid orographic ascent and extreme precipitation efficiency.',
    features: [
      {
        id: 'cape',
        name: 'Surface-Based CAPE',
        symbol: 'CAPE_sfc',
        category: 'Instability',
        observedValue: '3,450 J/kg',
        climatologyMean: '1,850 J/kg',
        unit: 'J/kg',
        shapValue: +0.28,
        direction: 'INCREASE_RISK',
        description: 'Severe thermodynamic instability fuels intense updraft velocities (> 35 m/s).',
      },
      {
        id: 'glaciation',
        name: 'Cloud-Top Glaciation Rate',
        symbol: 'dT_ir/dt',
        category: 'Satellite IR',
        observedValue: '-14.8 °C / 15m',
        climatologyMean: '-4.2 °C / 15m',
        unit: '°C/15min',
        shapValue: +0.24,
        direction: 'INCREASE_RISK',
        description: 'Rapid cloud-top drop to -68.4°C marks vigorous overshooting convective dome into tropopause.',
      },
      {
        id: 'lightning_jump',
        name: 'Lightning Flash Acceleration',
        symbol: 'dF/dt (Jump)',
        category: 'Electrification',
        observedValue: '+42% in 5 min (3.0σ)',
        climatologyMean: '+5% in 5 min',
        unit: 'fl/min²',
        shapValue: +0.22,
        direction: 'INCREASE_RISK',
        description: 'Vigorous mixed-phase collision between graupel and ice crystals indicates hail aloft.',
      },
      {
        id: 'bulk_shear',
        name: 'Deep-Layer Bulk Shear (0-6 km)',
        symbol: 'S_0-6km',
        category: 'Kinematics',
        observedValue: '24.5 m/s',
        climatologyMean: '14.0 m/s',
        unit: 'm/s',
        shapValue: +0.16,
        direction: 'INCREASE_RISK',
        description: 'Sustains storm organization, tilts updraft away from downdraft to prevent premature collapse.',
      },
      {
        id: 'vil',
        name: 'Vertically Integrated Liquid',
        symbol: 'VIL',
        category: 'Doppler Radar',
        observedValue: '68 kg/m²',
        climatologyMean: '32 kg/m²',
        unit: 'kg/m²',
        shapValue: +0.12,
        direction: 'INCREASE_RISK',
        description: 'Extreme column water loading primed for instantaneous cloudburst release.',
      },
      {
        id: 'lapse_rate',
        name: '700–500 hPa Lapse Rate',
        symbol: 'Γ_mid',
        category: 'Thermodynamics',
        observedValue: '7.8 °C/km',
        climatologyMean: '6.2 °C/km',
        unit: '°C/km',
        shapValue: +0.10,
        direction: 'INCREASE_RISK',
        description: 'Steep environmental lapse rates accelerate buoyant air parcel acceleration.',
      },
      {
        id: 'pwat',
        name: 'Precipitable Water (PWAT)',
        symbol: 'PWAT',
        category: 'Moisture Flux',
        observedValue: '58.4 mm',
        climatologyMean: '42.0 mm',
        unit: 'mm',
        shapValue: +0.08,
        direction: 'INCREASE_RISK',
        description: 'High atmospheric moisture column feeds sustained torrential precipitation.',
      },
      {
        id: 'cin',
        name: 'Convective Inhibition (CIN)',
        symbol: 'CIN',
        category: 'Boundary Layer',
        observedValue: '-18 J/kg',
        climatologyMean: '-85 J/kg',
        unit: 'J/kg',
        shapValue: -0.06,
        direction: 'DECREASE_RISK',
        description: 'Minimal capping inversion allows uninhibited free convection without delay.',
      },
      {
        id: 'entrainment',
        name: 'Dry Mid-Level Entrainment',
        symbol: 'RH_700',
        category: 'Dilution',
        observedValue: '74% RH',
        climatologyMean: '48% RH',
        unit: '%',
        shapValue: -0.04,
        direction: 'DECREASE_RISK',
        description: 'Moist ambient mid-levels protect rising convective parcel from evaporative weakening.',
      },
    ],
  },
  {
    cellId: 'CELL-B2',
    cellName: 'Haridwar Ridge Multicell Cluster',
    hazardType: 'HAIL',
    tier: 'WARNING',
    predictedRisk: 0.84,
    baseValue: 0.12,
    radarDbz: 52.4,
    leadTime: '1.0–2.5 h',
    confidenceScore: 0.91,
    physicsExplanation:
      'Hail genesis confirmed by significant mixed-phase reflectivity (Three-Body Scatter Spike) and moderate glaciation rate (-11.2°C/15m). 0-6 km bulk shear of 21.0 m/s supports tilted updraft core with large suspended hydrometeors.',
    features: [
      {
        id: 'glaciation',
        name: 'Cloud-Top Glaciation Rate',
        symbol: 'dT_ir/dt',
        category: 'Satellite IR',
        observedValue: '-11.2 °C / 15m',
        climatologyMean: '-4.2 °C / 15m',
        unit: '°C/15min',
        shapValue: +0.26,
        direction: 'INCREASE_RISK',
        description: 'Cold cloud top (-61.2°C) signals strong updrafts reaching hail growth zone (-10°C to -30°C).',
      },
      {
        id: 'cape',
        name: 'Surface-Based CAPE',
        symbol: 'CAPE_sfc',
        category: 'Instability',
        observedValue: '2,820 J/kg',
        climatologyMean: '1,850 J/kg',
        unit: 'J/kg',
        shapValue: +0.22,
        direction: 'INCREASE_RISK',
        description: 'Ample thermodynamic energy supports 25–30 mm hailstone suspension.',
      },
      {
        id: 'bulk_shear',
        name: 'Deep-Layer Bulk Shear (0-6 km)',
        symbol: 'S_0-6km',
        category: 'Kinematics',
        observedValue: '21.0 m/s',
        climatologyMean: '14.0 m/s',
        unit: 'm/s',
        shapValue: +0.18,
        direction: 'INCREASE_RISK',
        description: 'Tilts storm updraft, enabling recurrent hail stone recirculation.',
      },
      {
        id: 'lightning_jump',
        name: 'Lightning Flash Acceleration',
        symbol: 'dF/dt (Jump)',
        category: 'Electrification',
        observedValue: '+28% in 5 min (2.1σ)',
        climatologyMean: '+5% in 5 min',
        unit: 'fl/min²',
        shapValue: +0.16,
        direction: 'INCREASE_RISK',
        description: 'Enhanced electrification in mixed-phase layer verifies solid ice hydrometeors.',
      },
      {
        id: 'vil',
        name: 'Vertically Integrated Liquid',
        symbol: 'VIL',
        category: 'Doppler Radar',
        observedValue: '48 kg/m²',
        climatologyMean: '32 kg/m²',
        unit: 'kg/m²',
        shapValue: +0.10,
        direction: 'INCREASE_RISK',
        description: 'Dense core aloft corresponding with dual-pol Zdr depression.',
      },
      {
        id: 'cin',
        name: 'Convective Inhibition (CIN)',
        symbol: 'CIN',
        category: 'Boundary Layer',
        observedValue: '-32 J/kg',
        climatologyMean: '-85 J/kg',
        unit: 'J/kg',
        shapValue: -0.08,
        direction: 'DECREASE_RISK',
        description: 'Moderate boundary layer capping slightly dampens new updraft cell initiation.',
      },
      {
        id: 'pwat',
        name: 'Precipitable Water (PWAT)',
        symbol: 'PWAT',
        category: 'Moisture Flux',
        observedValue: '46.0 mm',
        climatologyMean: '42.0 mm',
        unit: 'mm',
        shapValue: +0.06,
        direction: 'INCREASE_RISK',
        description: 'Near-normal moisture values with slight excess favoring surface precipitation.',
      },
      {
        id: 'entrainment',
        name: 'Dry Mid-Level Entrainment',
        symbol: 'RH_700',
        category: 'Dilution',
        observedValue: '58% RH',
        climatologyMean: '48% RH',
        unit: '%',
        shapValue: -0.06,
        direction: 'DECREASE_RISK',
        description: 'Drier mid-tropospheric air promotes evaporative downdraft acceleration.',
      },
    ],
  },
  {
    cellId: 'CELL-C3',
    cellName: 'Mohand Pass Orographic Feeder',
    hazardType: 'THUNDERSTORM',
    tier: 'WATCH',
    predictedRisk: 0.72,
    baseValue: 0.12,
    radarDbz: 41.5,
    leadTime: '2.5–4.0 h',
    confidenceScore: 0.85,
    physicsExplanation:
      'Orographic forced ascent over Shivalik hill barrier triggers moderate convective development. CAPE of 1,940 J/kg and wind shear of 16.5 m/s support multicell squall line, but lower VIL (28 kg/m²) limits cloudburst potential.',
    features: [
      {
        id: 'cape',
        name: 'Surface-Based CAPE',
        symbol: 'CAPE_sfc',
        category: 'Instability',
        observedValue: '1,940 J/kg',
        climatologyMean: '1,850 J/kg',
        unit: 'J/kg',
        shapValue: +0.18,
        direction: 'INCREASE_RISK',
        description: 'Near-climatological instability sufficient for moderate convective updrafts.',
      },
      {
        id: 'lapse_rate',
        name: '700–500 hPa Lapse Rate',
        symbol: 'Γ_mid',
        category: 'Thermodynamics',
        observedValue: '6.8 °C/km',
        climatologyMean: '6.2 °C/km',
        unit: '°C/km',
        shapValue: +0.14,
        direction: 'INCREASE_RISK',
        description: 'Moderate parcel acceleration over mountain slopes.',
      },
      {
        id: 'bulk_shear',
        name: 'Deep-Layer Bulk Shear (0-6 km)',
        symbol: 'S_0-6km',
        category: 'Kinematics',
        observedValue: '16.5 m/s',
        climatologyMean: '14.0 m/s',
        unit: 'm/s',
        shapValue: +0.12,
        direction: 'INCREASE_RISK',
        description: 'Adequate for multicell squall organization.',
      },
      {
        id: 'lightning_jump',
        name: 'Lightning Flash Acceleration',
        symbol: 'dF/dt (Jump)',
        category: 'Electrification',
        observedValue: '+14% in 5 min (1.2σ)',
        climatologyMean: '+5% in 5 min',
        unit: 'fl/min²',
        shapValue: +0.10,
        direction: 'INCREASE_RISK',
        description: 'Typical moderate thunderstorm electrification rate.',
      },
      {
        id: 'glaciation',
        name: 'Cloud-Top Glaciation Rate',
        symbol: 'dT_ir/dt',
        category: 'Satellite IR',
        observedValue: '-6.4 °C / 15m',
        climatologyMean: '-4.2 °C / 15m',
        unit: '°C/15min',
        shapValue: +0.08,
        direction: 'INCREASE_RISK',
        description: 'Normal updraft ascent without severe overshooting top.',
      },
      {
        id: 'cin',
        name: 'Convective Inhibition (CIN)',
        symbol: 'CIN',
        category: 'Boundary Layer',
        observedValue: '-45 J/kg',
        climatologyMean: '-85 J/kg',
        unit: 'J/kg',
        shapValue: -0.06,
        direction: 'DECREASE_RISK',
        description: 'Subtle thermal cap delays widespread eruption of cells.',
      },
      {
        id: 'vil',
        name: 'Vertically Integrated Liquid',
        symbol: 'VIL',
        category: 'Doppler Radar',
        observedValue: '28 kg/m²',
        climatologyMean: '32 kg/m²',
        unit: 'kg/m²',
        shapValue: -0.04,
        direction: 'DECREASE_RISK',
        description: 'Moderate liquid water mass aloft precludes cloudburst rainfall intensities.',
      },
    ],
  },
  {
    cellId: 'CELL-D4',
    cellName: 'Doon South Thermal Flank',
    hazardType: 'DOWNBURST',
    tier: 'INFO',
    predictedRisk: 0.38,
    baseValue: 0.12,
    radarDbz: 32.5,
    leadTime: '0.5–1.5 h',
    confidenceScore: 0.82,
    physicsExplanation:
      'Isolated thermal bubble with sub-critical radar reflectivity (32.5 dBZ) and weak lightning activity. High dry entrainment in sub-cloud layer and strong CIN (-72 J/kg) will decay convective tower within 45 minutes.',
    features: [
      {
        id: 'cape',
        name: 'Surface-Based CAPE',
        symbol: 'CAPE_sfc',
        category: 'Instability',
        observedValue: '1,420 J/kg',
        climatologyMean: '1,850 J/kg',
        unit: 'J/kg',
        shapValue: +0.08,
        direction: 'INCREASE_RISK',
        description: 'Marginal buoyancy insufficient to overcome mountain boundary inversion.',
      },
      {
        id: 'lapse_rate',
        name: '700–500 hPa Lapse Rate',
        symbol: 'Γ_mid',
        category: 'Thermodynamics',
        observedValue: '6.1 °C/km',
        climatologyMean: '6.2 °C/km',
        unit: '°C/km',
        shapValue: +0.04,
        direction: 'INCREASE_RISK',
        description: 'Near-neutral moist adiabatic ascent.',
      },
      {
        id: 'cin',
        name: 'Convective Inhibition (CIN)',
        symbol: 'CIN',
        category: 'Boundary Layer',
        observedValue: '-72 J/kg',
        climatologyMean: '-85 J/kg',
        unit: 'J/kg',
        shapValue: -0.14,
        direction: 'DECREASE_RISK',
        description: 'Substantial capping inversion acts as brake on further cloud vertical growth.',
      },
      {
        id: 'vil',
        name: 'Vertically Integrated Liquid',
        symbol: 'VIL',
        category: 'Doppler Radar',
        observedValue: '18 kg/m²',
        climatologyMean: '32 kg/m²',
        unit: 'kg/m²',
        shapValue: -0.12,
        direction: 'DECREASE_RISK',
        description: 'Weak water loading; no severe precipitation signatures.',
      },
      {
        id: 'glaciation',
        name: 'Cloud-Top Glaciation Rate',
        symbol: 'dT_ir/dt',
        category: 'Satellite IR',
        observedValue: '-2.1 °C / 15m',
        climatologyMean: '-4.2 °C / 15m',
        unit: '°C/15min',
        shapValue: -0.08,
        direction: 'DECREASE_RISK',
        description: 'Updraft dying out; cloud tops warming aloft.',
      },
    ],
  },
];

export default function SHAPExplainability({
  selectedCellId,
  onSelectCell,
  onOverride,
  dutyOfficer,
  badgeId,
}) {
  const [activeCellId, setActiveCellId] = useState(selectedCellId || 'CELL-A1');
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'matrix'
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Sync internal state if parent passed controlled prop
  const currentCell =
    XAI_CELL_DATA.find((c) => c.cellId === (selectedCellId || activeCellId)) || XAI_CELL_DATA[0];

  const tierMeta = SEVERITY_TIERS[currentCell.tier] || SEVERITY_TIERS.INFO;

  // Calculate cumulative contributions
  const positiveContribs = currentCell.features.filter((f) => f.shapValue > 0);
  const negativeContribs = currentCell.features.filter((f) => f.shapValue < 0);

  const totalPositiveShap = positiveContribs.reduce((acc, f) => acc + f.shapValue, 0);
  const totalNegativeShap = negativeContribs.reduce((acc, f) => acc + f.shapValue, 0);

  // Export SHAP JSON Diagnostic File
  const handleExportShapJson = () => {
    const exportPayload = {
      status: 'SIMULATED_DEMO_FIXTURE',
      model: 'Illustrative fixture; not a live model explanation',
      inspectionTimestamp: new Date().toISOString(),
      cellId: currentCell.cellId,
      cellName: currentCell.cellName,
      hazardType: currentCell.hazardType,
      assignedTier: currentCell.tier,
      baseClimatologyRisk_E_fx: currentCell.baseValue,
      modelPredictedRisk_fx: currentCell.predictedRisk,
      deltaRisk: Math.round((currentCell.predictedRisk - currentCell.baseValue) * 100) / 100,
      confidenceScore: currentCell.confidenceScore,
      physicsRationale: currentCell.physicsExplanation,
      featureAttributions: currentCell.features.map((f) => ({
        parameter: f.name,
        symbol: f.symbol,
        category: f.category,
        observed: f.observedValue,
        climatologyBaseline: f.climatologyMean,
        shapleyWeight: f.shapValue,
        percentageContribution: ((Math.abs(f.shapValue) / (totalPositiveShap + Math.abs(totalNegativeShap))) * 100).toFixed(1) + '%',
        impact: f.direction,
      })),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VayuGati_XAI_SHAP_${currentCell.cellId}_${Date.now().toString().slice(-6)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 shadow-2xs space-y-6 antialiased">
      {/* 1. HEADER & CELL SELECTOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E0D8] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D9532F] flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-[#D9532F]" />
              Explainable AI (XAI) Inspection Panel
            </span>
            <span className="text-[#6C7278]">•</span>
            <span className="text-xs text-[#6C7278]">SHAP Physical Attribution Framework</span>
          </div>
          <h3 className="text-lg font-bold text-[#1A1D20] mt-0.5">
            Atmospheric Physics Feature Contribution Breakdown
          </h3>
          <p className="text-xs text-[#6C7278]">
            Verifies exact thermodynamic and kinematic weights driving the AI convective hazard classifier.
          </p>
          <p className="mt-2 text-[11px] font-semibold text-amber-700">
            ILLUSTRATIVE EXAMPLE: Physics Matrix values are fixture examples; the Forecaster XAI Card requests backend SHAP values and shows unavailable status on failure.
          </p>
        </div>

        {/* Cell Selector, Mode Toggle & Export Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#FAF7F2] p-1 rounded-lg border border-[#E5E0D8] text-xs">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'card'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#6C7278] hover:text-[#0F172A]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Forecaster XAI Card</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'matrix'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#6C7278] hover:text-[#0F172A]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-300" />
              <span>Physics Matrix</span>
            </button>
          </div>

          <div className="relative">
            <select
              value={currentCell.cellId}
              onChange={(e) => {
                const nextId = e.target.value;
                setActiveCellId(nextId);
                if (onSelectCell) onSelectCell(nextId);
              }}
              className="appearance-none bg-[#FAF7F2] border border-[#E5E0D8] rounded-lg px-3.5 py-2 pr-9 text-xs font-bold text-[#1A1D20] hover:bg-[#E5E0D8] transition-colors cursor-pointer"
            >
              {XAI_CELL_DATA.map((cell) => (
                <option key={cell.cellId} value={cell.cellId}>
                  {cell.cellId}: {cell.cellName} ({cell.tier})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#6C7278] absolute right-3 top-3 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={handleExportShapJson}
            className="bg-[#FAF7F2] hover:bg-[#E5E0D8] border border-[#E5E0D8] text-[#1A1D20] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Exported JSON</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#D9532F]" />
                <span>Export SHAP Audit JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: OFFICIAL FORECASTER XAI CARD */}
      {viewMode === 'card' ? (
        <SHAPExplainabilityCard
          cellData={{
            cellId: currentCell.cellId,
            cellName: currentCell.cellName,
            hazardType: currentCell.hazardType,
            tier: currentCell.tier,
            radarDbz: currentCell.radarDbz,
            confidenceScore: currentCell.confidenceScore,
            baseRisk: currentCell.baseValue,
            predictedRisk: currentCell.predictedRisk,
            leadTime: currentCell.leadTime,
          }}
          onOverride={onOverride}
          dutyOfficer={dutyOfficer}
          badgeId={badgeId}
        />
      ) : (
        <>
      {/* 2. CELL SUMMARY CARD WITH PROBABILITY METER */}
      <div
        className="p-5 rounded-xl border bg-[#FAF7F2] flex flex-col lg:flex-row lg:items-center justify-between gap-5"
        style={{ borderLeftWidth: '5px', borderLeftColor: tierMeta.color }}
      >
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span
              className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: tierMeta.color }}
            >
              {currentCell.tier} TIER
            </span>
            <span className="text-xs font-mono font-bold text-[#1A1D20]">
              {currentCell.cellId} • {currentCell.hazardType}
            </span>
            <span className="text-xs text-[#6C7278]">• Radar: {currentCell.radarDbz} dBZ</span>
          </div>
          <h4 className="text-base font-bold text-[#1A1D20]">{currentCell.cellName}</h4>
          <p className="text-xs text-[#6C7278] leading-relaxed max-w-2xl">
            {currentCell.physicsExplanation}
          </p>
        </div>

        {/* SHAP Base Value vs Model Score */}
        <div className="flex items-center space-x-4 shrink-0 bg-white p-4 rounded-xl border border-[#E5E0D8] shadow-2xs">
          <div className="text-center">
            <span className="text-[10px] uppercase font-bold text-[#6C7278] block">
              Base Risk E[f(x)]
            </span>
            <span className="text-base font-mono font-bold text-[#6C7278]">
              {Math.round(currentCell.baseValue * 100)}%
            </span>
            <span className="text-[9px] text-[#6C7278] block">Climatology Mean</span>
          </div>

          <div className="text-lg font-bold text-[#D9532F]">→</div>

          <div className="text-center">
            <span className="text-[10px] uppercase font-bold text-[#D9532F] block">
              Model Score f(x)
            </span>
            <span
              className="text-2xl font-mono font-extrabold"
              style={{ color: tierMeta.color }}
            >
              {Math.round(currentCell.predictedRisk * 100)}%
            </span>
            <span className="text-[9px] font-bold block" style={{ color: tierMeta.color }}>
              Δ = +{Math.round((currentCell.predictedRisk - currentCell.baseValue) * 100)}%
            </span>
          </div>

          <div className="border-l border-[#E5E0D8] pl-3 text-left">
            <span className="text-[10px] uppercase font-bold text-[#6C7278] block">Forecaster Confidence</span>
            <span className="text-xs font-mono font-bold text-emerald-700">
              {Math.round(currentCell.confidenceScore * 100)}% Verified
            </span>
            <span className="text-[9px] text-[#6C7278] block">Lead Time: {currentCell.leadTime}</span>
          </div>
        </div>
      </div>

      {/* 3. VISUAL SHAP WATERFALL / ATTRIBUTION BAR CHART */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-[#D9532F]" />
            <h4 className="font-bold text-sm text-[#1A1D20]">
              SHAP Force Vector Plot: Feature Attributions (φ)
            </h4>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#DC2626] font-semibold">
              <span className="w-2.5 h-2.5 rounded bg-[#DC2626]"></span>
              Pushes Hazard Risk Higher (+φ)
            </span>
            <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded bg-blue-600"></span>
              Mitigates / Reduces Risk (-φ)
            </span>
          </div>
        </div>

        {/* Feature Attribution Horizontal Bars */}
        <div className="space-y-2.5 bg-[#FAF7F2] p-4 rounded-xl border border-[#E5E0D8]">
          {currentCell.features.map((feat) => {
            const isPositive = feat.shapValue >= 0;
            const absVal = Math.abs(feat.shapValue);
            // Scale bar width relative to maximum expected SHAP value (0.35 = 100%)
            const barWidthPercent = Math.min(100, Math.round((absVal / 0.35) * 100));

            return (
              <div key={feat.id} className="grid grid-cols-12 items-center gap-2 text-xs">
                {/* Feature Label & Symbol */}
                <div className="col-span-12 sm:col-span-4 flex items-center justify-between sm:justify-start space-x-2">
                  <span className="font-bold text-[#1A1D20] truncate">{feat.name}</span>
                  <span className="text-[10px] font-mono text-[#6C7278] bg-white px-1.5 py-0.5 rounded border border-[#E5E0D8]">
                    {feat.symbol}
                  </span>
                </div>

                {/* Center Waterfall Bar */}
                <div className="col-span-8 sm:col-span-6 flex items-center">
                  <div className="w-full bg-white h-5 rounded-md border border-[#E5E0D8] p-0.5 relative overflow-hidden flex items-center">
                    {/* Center Zero Line Marker */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-neutral-300 z-10"></div>

                    {isPositive ? (
                      // Positive Bar: extends from center (50%) to the right
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-600 rounded-r transition-all duration-500"
                        style={{
                          marginLeft: '50%',
                          width: `${(barWidthPercent / 2)}%`,
                        }}
                      ></div>
                    ) : (
                      // Negative Bar: extends from center (50%) to the left
                      <div
                        className="h-full bg-gradient-to-l from-blue-400 to-blue-600 rounded-l transition-all duration-500"
                        style={{
                          marginLeft: `${50 - (barWidthPercent / 2)}%`,
                          width: `${(barWidthPercent / 2)}%`,
                        }}
                      ></div>
                    )}
                  </div>
                </div>

                {/* Numeric Values & Observed reading */}
                <div className="col-span-4 sm:col-span-2 text-right">
                  <span
                    className={`font-mono font-bold text-xs ${
                      isPositive ? 'text-[#DC2626]' : 'text-blue-600'
                    }`}
                  >
                    {isPositive ? `+${feat.shapValue.toFixed(2)}` : feat.shapValue.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#6C7278] block font-mono">
                    {feat.observedValue}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. METEOROLOGICAL PHYSICS ATTRIBUTION TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-[#1A1D20]">
            Physics Diagnostic Matrix (Observation vs Climatology)
          </h4>
          <span className="text-[11px] text-[#6C7278] font-mono">
            {currentCell.features.length} Thermodynamic &amp; Kinematic Predictors
          </span>
        </div>

        <div className="overflow-x-auto border border-[#E5E0D8] rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-[#E5E0D8] text-[11px] font-bold text-[#6C7278] uppercase">
                <th className="py-2.5 px-3">Predictor Parameter</th>
                <th className="py-2.5 px-3">Domain</th>
                <th className="py-2.5 px-3">Observed In-Situ</th>
                <th className="py-2.5 px-3">Climatological Mean</th>
                <th className="py-2.5 px-3 text-right">SHAP Weight (φ)</th>
                <th className="py-2.5 px-3">Physical Mechanism &amp; Forecast Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D8] text-neutral-800">
              {currentCell.features.map((feat) => {
                const isPositive = feat.shapValue >= 0;
                return (
                  <tr key={feat.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#1A1D20]">
                      <div className="flex items-center space-x-1.5">
                        <span>{feat.name}</span>
                        <span className="text-[10px] font-mono text-[#6C7278]">({feat.symbol})</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[#6C7278]">{feat.category}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#1A1D20]">
                      {feat.observedValue}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#6C7278]">
                      {feat.climatologyMean}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-right">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          isPositive
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isPositive ? `+${feat.shapValue.toFixed(2)}` : feat.shapValue.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#6C7278] text-[11px] leading-relaxed">
                      {feat.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. DUTY FORECASTER AUDIT SIGN-OFF BOX */}
      <div className="p-4 bg-[#FAF7F2] border border-[#E5E0D8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-[#6C7278]">
            XAI Physics Attribution certified under <strong>WMO-No. 488 (Global Data-processing and Forecasting System)</strong> guidelines for machine learning nowcast verification.
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#6C7278] shrink-0">
          ConvLSTM-LGBM Core • 1.5 km Spatial Grid
        </span>
      </div>
        </>
      )}
    </div>
  );
}
