import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Building2,
  Plane,
  Train,
  Zap,
  GraduationCap,
  Users,
  UserCheck,
  UserX,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Compass,
  PhoneCall,
  Activity,
  Layers,
  Clock,
  Printer,
  ChevronRight,
  Shield,
  RefreshCw,
  Search,
  Code,
} from 'lucide-react';
import { SECTOR_INFO, SEVERITY_TIERS, getFullNowcastTelemetrySnapshot } from '../utils/mockDataSeed';
import { generateCapXml, downloadCapXmlFile } from '../utils/capXmlGenerator';

// Institutional Dispatch Configurations
const INITIAL_INSTITUTIONAL_DISPATCHES = [
  {
    id: 'INST-AIR-01',
    agency: 'Civil Aviation (AAI)',
    facility: 'Jolly Grant Airport (DED / VIDN)',
    category: 'aviation',
    status: 'ACTIVE_DISPATCH',
    statusLabel: 'Ground Hold & Diversion Advisory',
    icon: Plane,
    color: '#DC2626',
    bgColor: 'bg-red-50 border-red-200 text-red-900',
    criticalParameters: 'Wind Shear: 28 kts at 300m AGL • Low-Level Microburst Risk: 84% • Runway Crosswind: 32 kts',
    protocols: [
      'Issue SIGMET for terminal maneuvering area (TMA) within 25 nm.',
      'Divert inbound commercial flights 6E-204 and AI-882 to Chandigarh / Delhi.',
      'Ground baggage handling teams due to 14.8 fl/km²/min lightning hazard.',
    ],
    lastUpdated: '18:14 IST',
    contactOfficer: 'Air Traffic Controller Desk (DED Tower)',
  },
  {
    id: 'INST-EDU-02',
    agency: 'District Education Office (DEO)',
    facility: 'All Schools & Universities in Foothill Zones (28 Institutions)',
    category: 'education',
    status: 'ACTIVE_DISPATCH',
    statusLabel: 'Immediate Dismissal Hold Order',
    icon: GraduationCap,
    color: '#DC2626',
    bgColor: 'bg-red-50 border-red-200 text-red-900',
    criticalParameters: 'Rainfall Rate: > 110 mm/hr • Flash Flood Inundation Window: 30–45 mins',
    protocols: [
      'Hold students in multi-story concrete classroom blocks away from ground floors.',
      'Halt all school bus dispatches until convective core passes Mussoorie bypass.',
      'Broadcast automated SMS to 34,000 registered parents/guardians.',
    ],
    lastUpdated: '18:10 IST',
    contactOfficer: 'Chief Education Officer, Dehradun',
  },
  {
    id: 'INST-RAIL-03',
    agency: 'Northern Railway (NR)',
    facility: 'Haridwar – Dehradun Single Line Track (Km 42 to Km 68)',
    category: 'railways',
    status: 'CAUTION_DISPATCH',
    statusLabel: 'Track Caution Speed (30 km/h)',
    icon: Train,
    color: '#EA580C',
    bgColor: 'bg-orange-50 border-orange-200 text-orange-900',
    criticalParameters: 'Culvert Water Inundation: Level 2 Alert • Downburst Crosswind: 75 km/h',
    protocols: [
      'Impose 30 km/h speed restriction for Vande Bharat and Jan Shatabdi expresses.',
      'Deploy foot-patrol track mates with walkie-talkies at Song River bridge.',
      'Inspect cuttings for boulder falls between Raiwala and Motichur.',
    ],
    lastUpdated: '18:05 IST',
    contactOfficer: 'Divisional Railway Operations Manager (Moradabad)',
  },
  {
    id: 'INST-GRID-04',
    agency: 'Power Transmission Corp (PTCUL / UPCL)',
    facility: '220 kV Rishikesh & 132 kV Majra Primary Substations',
    category: 'power',
    status: 'MONITORING_DISPATCH',
    statusLabel: 'Substation Feeder Isolation Standby',
    icon: Zap,
    color: '#D97706',
    bgColor: 'bg-amber-50 border-amber-200 text-amber-900',
    criticalParameters: 'Total Lightning Surge: 482 strikes/hr • Max Current: 104 kA ground strike',
    protocols: [
      'Pre-emptively isolate 33 kV rural overhead distribution feeders in hail corridor.',
      'Stage 12 emergency restoration lineman crews with pole-replacement trucks.',
      'Switch hospital and water pumping station lines to diesel auxiliary generators.',
    ],
    lastUpdated: '17:58 IST',
    contactOfficer: 'Executive Engineer (Load Dispatch Center)',
  },
];

// Initial User Directory for District Management
const INITIAL_USERS = [
  {
    id: 'USR-8901',
    fullName: 'Inspector Vikramaditya Rawat',
    email: 'officer@vayugati.gov.in',
    role: 'officer',
    jurisdiction: 'State Disaster Management Authority (SDMA - Zone 4)',
    badgeId: 'NDRF-OFF-402',
    status: 'ACTIVE',
    registrationDate: '2025-11-20',
    clearanceLevel: 'LEVEL-2 SENIOR RESPONDER',
  },
  {
    id: 'USR-8902',
    fullName: 'Dr. Sunita Negi',
    email: 'sunita.negi@imd.gov.in',
    role: 'officer',
    jurisdiction: 'DWR Dehradun Radar Operations',
    badgeId: 'IMD-MET-108',
    status: 'ACTIVE',
    registrationDate: '2026-01-10',
    clearanceLevel: 'LEVEL-3 RADAR METEOROLOGIST',
  },
  {
    id: 'USR-8903',
    fullName: 'Captain Arvind Bhatt',
    email: 'arvind.bhatt@sdrf.gov.in',
    role: 'officer',
    jurisdiction: 'SDRF Quick Reaction Unit (Rishikesh)',
    badgeId: 'SDRF-QRT-012',
    status: 'PENDING_APPROVAL',
    registrationDate: '2026-09-24',
    clearanceLevel: 'LEVEL-1 FIELD COMMANDER',
  },
  {
    id: 'USR-8904',
    fullName: 'Pooja Deshmukh',
    email: 'pooja.deshmukh@pune.gov.in',
    role: 'officer',
    jurisdiction: 'Pune District Disaster Management Cell (Haveli)',
    badgeId: 'DDMA-PUN-045',
    status: 'ACTIVE',
    registrationDate: '2026-02-15',
    clearanceLevel: 'LEVEL-2 REGIONAL COORDINATOR',
  },
  {
    id: 'USR-8905',
    fullName: 'Rameshwar Lal Verma',
    email: 'rameshwar.verma@haridwar.gov.in',
    role: 'citizen',
    jurisdiction: 'Haridwar Rural Observer Network',
    badgeId: 'CIT-OBS-331',
    status: 'SUSPENDED',
    registrationDate: '2025-12-05',
    clearanceLevel: 'PUBLIC OBSERVER',
  },
];

// Pre-positioning Resources in District
const PREPOSITIONING_ASSETS = [
  { name: 'SDRF Quick Reaction Team Alpha', lat: 30.387, lon: 78.132, type: 'QRT', status: 'Deployed at Sahastradhara Bridge', personnel: 24, boats: 4 },
  { name: 'NDRF Company 8 Staging Shelter', lat: 30.342, lon: 78.075, type: 'NDRF', status: 'Staged on Rajpur Road High Ground', personnel: 45, boats: 8 },
  { name: 'Municipal Dewatering Pump Bank', lat: 30.315, lon: 78.042, type: 'EQUIP', status: 'Operational (6 Heavy Diesel Pumps)', personnel: 12, boats: 0 },
  { name: 'Rishikesh Flood Evacuation Base', lat: 30.103, lon: 78.294, type: 'SHELTER', status: 'Standby for Ganga Gorge Runoff', personnel: 30, boats: 6 },
];

export default function AdminPortal() {
  const { profile } = useAuth();

  // Navigation tab in Admin Portal
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'institutions', 'users', 'prepositioning', 'reports'

  // State Management
  const [institutionalDispatches, setInstitutionalDispatches] = useState(INITIAL_INSTITUTIONAL_DISPATCHES);
  const [usersList, setUsersList] = useState(INITIAL_USERS);
  const [searchUser, setSearchUser] = useState('');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Auto clear success message
  const triggerSuccess = (msg) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  /**
   * Action: Approve Pending Officer User
   */
  const handleApproveUser = (userId) => {
    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'ACTIVE' } : u))
    );
    triggerSuccess(`User credentials approved and active for ${userId}. Access granted to Officer Console.`);
  };

  /**
   * Action: Toggle User Status (Active / Suspended)
   */
  const handleToggleUserStatus = (userId) => {
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const next = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
          return { ...u, status: next };
        }
        return u;
      })
    );
    triggerSuccess(`Account status updated for ${userId}.`);
  };

  /**
   * Action: Change User Regional Jurisdiction
   */
  const handleUpdateJurisdiction = (e) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    setUsersList((prev) =>
      prev.map((u) => (u.id === selectedUserForEdit.id ? selectedUserForEdit : u))
    );
    triggerSuccess(`Updated jurisdiction & role permissions for ${selectedUserForEdit.fullName}.`);
    setSelectedUserForEdit(null);
  };

  /**
   * Action: Trigger Urgent Institutional Priority Dispatch
   */
  const handleTriggerInstitutionalDispatch = (instId) => {
    setInstitutionalDispatches((prev) =>
      prev.map((item) =>
        item.id === instId
          ? {
              ...item,
              status: 'PRIORITY_ACKNOWLEDGED',
              statusLabel: 'Emergency Protocol Acknowledged & Executed',
              lastUpdated: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST',
            }
          : item
      )
    );
    triggerSuccess(`Priority protocol re-transmitted and acknowledged for ${instId}.`);
  };

  /**
   * Action: Generate & Download Official District CSV Report
   */
  const handleDownloadCsvReport = () => {
    const timestamp = new Date().toISOString();
    const rows = [
      ['VayuGati Nowcast DISTRICT DISASTER MANAGEMENT AUTHORITY (DDMA) REPORT'],
      ['Generated On', timestamp],
      ['Sector Monitored', SECTOR_INFO.name],
      ['Radar Station', SECTOR_INFO.radarStation],
      ['Current Sector Risk Level', 'SEVERE CLOUDBURST ALERT (63.8 dBZ)'],
      [''],
      ['--- ACTIVE CONVECTIVE STORM CELLS ---'],
      ['Cell ID', 'Classification', 'Max dBZ', 'Speed (km/h)', 'Heading', 'Rain Rate (mm/h)', 'Hail Prob', 'Impact Target'],
      ['CELL-A1', 'SEVERE', '63.8', '38', '065° ENE', '118', '88%', 'Sahastradhara River Basin (14 min)'],
      ['CELL-B2', 'WARNING', '52.4', '44', '055° NE', '58', '45%', 'Haridwar Ghats (32 min)'],
      ['CELL-C3', 'WATCH', '41.5', '32', '072° ENE', '32', '15%', 'Mohand Pass (28 min)'],
      [''],
      ['--- INSTITUTIONAL DISPATCH ORDERS ---'],
      ['Agency', 'Facility / Sector', 'Status', 'Critical Trigger Parameters', 'Last Dispatched'],
      ...institutionalDispatches.map((i) => [i.agency, i.facility, i.statusLabel, i.criticalParameters, i.lastUpdated]),
      [''],
      ['--- AUTHORIZED DUTY FORECASTERS & RESPONDERS ---'],
      ['User ID', 'Name', 'Role', 'Jurisdiction', 'Badge ID', 'Status'],
      ...usersList.map((u) => [u.id, u.fullName, u.role, u.jurisdiction, u.badgeId, u.status]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((cell) => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VayuGati_District_Nowcast_Audit_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerSuccess('District Nowcast & Institutional Audit Log exported to CSV.');
  };

  /**
   * Action: Generate & Download Official NDMA CAP v1.2 XML Dispatch
   */
  const handleDownloadCapXmlDispatch = () => {
    const alertMock = {
      id: 'DISP-DDMA-991',
      cellId: 'CELL-A1',
      hazardType: 'CLOUDBURST',
      tier: 'SEVERE',
      targetGrid: 'Sahastradhara Basin & Rajpur Foothills (DDMA Priority Zone)',
      leadTimeMinutes: 45,
      maxReflectivityDbz: 63.8,
      expectedRainfallRateMmHr: 118,
      windGustKmh: 92,
      aiDraftedText:
        'CRITICAL CLOUDBURST ALERT: Extreme hydrometeor loading confirmed by dual-pol Doppler radar. Flash flooding imminent in Rispana/Bindal river channels. SDRF Pre-positioning Stage 3 activated.',
      instruction:
        'Evacuate riverbank settlements immediately to designated flood shelters. Restrict hill slope vehicular movement.',
    };

    downloadCapXmlFile(alertMock, `NDMA_CAP_v1.2_District_Dispatch_${Date.now()}.xml`);
    triggerSuccess('Official NDMA CAP v1.2 XML Dispatch generated and downloaded.');
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.jurisdiction.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.badgeId.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 space-y-6 antialiased">
      {/* 1. DISTRICT ADMIN COMMAND HEADER */}
      <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D9532F] flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              State &amp; District Disaster Management Authority (SDMA / DDMA)
            </span>
            <span className="text-[#6C7278]">•</span>
            <span className="text-xs text-[#6C7278]">Executive Command Node</span>
          </div>
          <h2 className="text-xl font-bold text-[#1A1D20] mt-1">
            District Administrator: {profile?.full_name || 'Dr. Kailash S. Murthy'}
          </h2>
          <p className="text-xs text-[#6C7278]">
            {profile?.jurisdiction || 'IMD Doppler Radar Met Center & HQ Nowcasting Unit'} • Authority:{' '}
            <strong className="text-[#1A1D20]">Executive Magistrate &amp; Relief Commissioner</strong>
          </p>
        </div>

        {/* Global Export & Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadCapXmlDispatch}
            className="bg-[#0B2E4F] hover:bg-[#12426E] text-white px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
          >
            <Code className="w-3.5 h-3.5 text-[#FF9933]" />
            <span>Export NDMA CAP v1.2 XML</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsvReport}
            className="bg-[#FAF7F2] hover:bg-[#E5E0D8] border border-[#E5E0D8] text-[#1A1D20] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#D9532F]" />
            <span>Download DDMA (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="bg-[#D9532F] hover:bg-[#BF4422] text-white px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Executive Brief</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-medium text-emerald-950 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 2. TAB NAVIGATION */}
      <div className="flex items-center space-x-2 border-b border-[#E5E0D8] overflow-x-auto pb-1 text-sm font-semibold">
        {[
          { id: 'overview', label: 'District Hazard Overview', icon: Activity, count: null },
          { id: 'institutions', label: 'Institutional Alert Dispatches', icon: Building2, count: '4 Active' },
          { id: 'prepositioning', label: 'Emergency Pre-positioning Map', icon: MapPin, count: '4 Assets' },
          { id: 'users', label: 'User & Forecaster Access Table', icon: Users, count: `${usersList.length} Accounts` },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'border-[#D9532F] text-[#D9532F] font-bold'
                  : 'border-transparent text-[#6C7278] hover:text-[#1A1D20]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count && (
                <span className="text-[10px] bg-[#FAF7F2] border border-[#E5E0D8] px-1.5 py-0.2 rounded font-mono font-bold text-[#1A1D20]">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. TAB 1: DISTRICT HAZARD OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key District Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#6C7278]">Active Red Alert Sector</span>
              <div className="text-xl font-black text-[#DC2626] font-mono">Sahastradhara Basin</div>
              <span className="text-[10px] text-[#DC2626] font-semibold">63.8 dBZ Hail &amp; Cloudburst</span>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#6C7278]">At-Risk Population</span>
              <div className="text-xl font-black text-[#1A1D20] font-mono">142,000 Persons</div>
              <span className="text-[10px] text-[#2E7D32] font-semibold">Cell Broadcast Alert Pushed</span>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#6C7278]">Mobilized SDRF Assets</span>
              <div className="text-xl font-black text-[#D9532F] font-mono">4 Quick Reaction Teams</div>
              <span className="text-[10px] text-[#6C7278]">99 Personnel Staged at High Ground</span>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#6C7278]">Radar Ingestion Health</span>
              <div className="text-xl font-black text-[#2E7D32] font-mono">100% (4 Feeds Sync)</div>
              <span className="text-[10px] text-[#6C7278]">DWR Dehradun + INSAT-3DR</span>
            </div>
          </div>

          {/* Quick Institutional Dispatch Summary */}
          <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#1A1D20] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#D9532F]" />
                  District Key Infrastructure &amp; Utility Directives
                </h3>
                <p className="text-xs text-[#6C7278]">
                  Automated trigger dispatches dispatched to strategic sectors in Dehradun &amp; Haridwar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('institutions')}
                className="text-xs font-bold text-[#D9532F] hover:text-[#BF4422] flex items-center gap-1"
              >
                <span>View Full Institutional Control Console</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {institutionalDispatches.slice(0, 4).map((inst) => {
                const Icon = inst.icon;
                return (
                  <div
                    key={inst.id}
                    className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E5E0D8] space-y-2"
                    style={{ borderLeftWidth: '4px', borderLeftColor: inst.color }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon className="w-4 h-4" style={{ color: inst.color }} />
                        <span className="font-bold text-sm text-[#1A1D20]">{inst.agency}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white border border-[#E5E0D8]">
                        {inst.statusLabel}
                      </span>
                    </div>
                    <span className="font-medium text-[#1A1D20] block">{inst.facility}</span>
                    <p className="text-[11px] text-[#6C7278]">{inst.criticalParameters}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: INSTITUTIONAL ALERT DISPATCHES */}
      {activeTab === 'institutions' && (
        <div className="space-y-4">
          <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-[#1A1D20] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#D9532F]" />
                Institutional Early Warning Protocols &amp; Action Dispatch
              </h3>
              <p className="text-xs text-[#6C7278]">
                Mandatory operational interlocks for Aviation, Schools, Railways, and Electric Utilities.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-[#FAF7F2] border border-[#E5E0D8] px-3 py-1.5 rounded text-[#1A1D20]">
              Authority: Section 30 Disaster Management Act 2005
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {institutionalDispatches.map((inst) => {
              const Icon = inst.icon;
              return (
                <div
                  key={inst.id}
                  className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between"
                  style={{ borderTopWidth: '4px', borderTopColor: inst.color }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${inst.color}15`, color: inst.color }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[#1A1D20]">{inst.agency}</h4>
                          <span className="text-xs text-[#6C7278] block">{inst.facility}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#6C7278]">{inst.lastUpdated}</span>
                    </div>

                    <div className={`p-2.5 rounded-lg border text-xs font-semibold ${inst.bgColor}`}>
                      <div className="flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{inst.statusLabel}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#E5E0D8] space-y-1 text-xs">
                      <span className="text-[10px] uppercase font-bold text-[#6C7278] block">
                        Nowcast Meteorological Triggers:
                      </span>
                      <p className="font-mono text-[#1A1D20] text-[11px] leading-snug">
                        {inst.criticalParameters}
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <span className="text-[10px] uppercase font-bold text-[#6C7278] block">
                        Mandated Sector Protocols:
                      </span>
                      <ul className="space-y-1 text-[11px] text-[#1A1D20]">
                        {inst.protocols.map((p, pIdx) => (
                          <li key={pIdx} className="flex items-start space-x-2">
                            <span className="text-[#D9532F] font-bold">•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E5E0D8] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#6C7278] truncate">Desk: {inst.contactOfficer}</span>
                    <button
                      type="button"
                      onClick={() => handleTriggerInstitutionalDispatch(inst.id)}
                      className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#E5E0D8] border border-[#E5E0D8] text-[#1A1D20] rounded font-bold text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      Acknowledge &amp; Dispatch
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 3: EMERGENCY PRE-POSITIONING MAP */}
      {activeTab === 'prepositioning' && (
        <div className="space-y-4">
          <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E0D8] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#1A1D20] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#D9532F]" />
                  Emergency Asset Pre-positioning &amp; Evacuation Corridor Map
                </h3>
                <p className="text-xs text-[#6C7278]">
                  Geospatial visualization of deployed SDRF teams, flood relief shelters, and active cloudburst zones.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#DC2626] bg-red-50 px-2.5 py-1 rounded border border-red-200">
                Severe Foothill Evacuation Zone Active
              </span>
            </div>

            {/* Prepositioning Leaflet Map */}
            <PrepositioningMap assets={PREPOSITIONING_ASSETS} />

            {/* Asset Table */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF7F2] text-[#6C7278] text-[10px] uppercase font-bold border-b border-[#E5E0D8]">
                  <tr>
                    <th className="p-2.5">Asset / Company</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Deployment Sector</th>
                    <th className="p-2.5">Personnel</th>
                    <th className="p-2.5">Rescue Boats</th>
                    <th className="p-2.5">Operational Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D8] bg-white font-mono">
                  {PREPOSITIONING_ASSETS.map((a, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/80">
                      <td className="p-2.5 font-bold font-sans text-[#1A1D20]">{a.name}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-neutral-100 font-bold text-[10px]">
                          {a.type}
                        </span>
                      </td>
                      <td className="p-2.5 font-sans text-[#6C7278]">{a.status}</td>
                      <td className="p-2.5 font-bold text-[#1A1D20]">{a.personnel} Responders</td>
                      <td className="p-2.5">{a.boats > 0 ? `${a.boats} Inflatable Boats` : 'N/A (Pumps)'}</td>
                      <td className="p-2.5 font-sans font-semibold text-[#2E7D32]">● STAGED READY</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 4: USER & FORECASTER MANAGEMENT TABLE */}
      {activeTab === 'users' && (
        <div className="bg-[#FFFFFF] border border-[#E5E0D8] rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E0D8] pb-3">
            <div>
              <h3 className="font-bold text-base text-[#1A1D20] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D9532F]" />
                Authorized User &amp; Duty Forecaster Directory
              </h3>
              <p className="text-xs text-[#6C7278]">
                Grant regional jurisdictions, authorize pending responder accounts, and audit permissions on public.users.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#6C7278] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search by name, jurisdiction, badge..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] text-[#1A1D20] focus:outline-none focus:border-[#D9532F]"
              />
            </div>
          </div>

          {/* User Directory Table */}
          <div className="overflow-x-auto border border-[#E5E0D8] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] text-[#6C7278] text-[10px] uppercase font-bold border-b border-[#E5E0D8]">
                <tr>
                  <th className="p-3">User &amp; Badge ID</th>
                  <th className="p-3">Assigned Role</th>
                  <th className="p-3">Regional Jurisdiction</th>
                  <th className="p-3">Clearance</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] bg-white">
                {filteredUsers.map((u) => {
                  const isActive = u.status === 'ACTIVE';
                  const isPending = u.status === 'PENDING_APPROVAL';
                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/80">
                      <td className="p-3">
                        <strong className="block text-[#1A1D20]">{u.fullName}</strong>
                        <span className="text-[10px] text-[#6C7278] font-mono">
                          {u.email} • ID: {u.badgeId}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#FAF7F2] border border-[#E5E0D8] text-[#1A1D20]">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-[#1A1D20]">{u.jurisdiction}</td>
                      <td className="p-3 font-mono text-[10px] text-[#6C7278]">{u.clearanceLevel}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPending
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleApproveUser(u.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold uppercase transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedUserForEdit({ ...u })}
                          className="px-2 py-1 bg-[#FAF7F2] hover:bg-[#E5E0D8] border border-[#E5E0D8] text-[#1A1D20] rounded text-[11px] font-semibold transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u.id)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            isActive
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isActive ? 'Revoke' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. MODAL: EDIT USER JURISDICTION & ROLE */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-xl border border-[#E5E0D8] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <h4 className="font-bold text-base text-[#1A1D20]">
                  Edit Regional Jurisdiction: {selectedUserForEdit.fullName}
                </h4>
                <p className="text-xs text-[#6C7278]">
                  Modify assigned sector responsibilities for {selectedUserForEdit.badgeId}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForEdit(null)}
                className="p-1 rounded text-[#6C7278] hover:text-[#1A1D20]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateJurisdiction} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#1A1D20] mb-1">Role Permission:</label>
                <select
                  value={selectedUserForEdit.role}
                  onChange={(e) =>
                    setSelectedUserForEdit({ ...selectedUserForEdit, role: e.target.value })
                  }
                  className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2] font-semibold"
                >
                  <option value="citizen">Citizen Observer</option>
                  <option value="officer">Duty Forecaster / SDRF Officer</option>
                  <option value="admin">District / State IMD Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#1A1D20] mb-1">
                  Assigned Regional Jurisdiction / Command Zone:
                </label>
                <input
                  type="text"
                  value={selectedUserForEdit.jurisdiction}
                  onChange={(e) =>
                    setSelectedUserForEdit({ ...selectedUserForEdit, jurisdiction: e.target.value })
                  }
                  className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1A1D20] mb-1">Clearance Level:</label>
                <input
                  type="text"
                  value={selectedUserForEdit.clearanceLevel}
                  onChange={(e) =>
                    setSelectedUserForEdit({ ...selectedUserForEdit, clearanceLevel: e.target.value })
                  }
                  className="w-full p-2 rounded border border-[#E5E0D8] bg-[#FAF7F2] font-mono"
                />
              </div>

              <div className="pt-2 border-t border-[#E5E0D8] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForEdit(null)}
                  className="px-4 py-2 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] text-[#1A1D20]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#D9532F] hover:bg-[#BF4422] text-white font-bold"
                >
                  Save User Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Leaflet Prepositioning Map Component for District Emergency Deployments
 */
function PrepositioningMap({ assets }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [30.33, 78.14],
        zoom: 11,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Severe Cloudburst Hazard Bounding Zone
      L.circle([30.38, 78.13], {
        radius: 8000,
        color: '#DC2626',
        weight: 2,
        fillColor: '#DC2626',
        fillOpacity: 0.22,
        dashArray: '4, 4',
      }).addTo(map).bindPopup('<b>PRIMARY CLOUDBURST SECTOR (63.8 dBZ)</b><br/>Immediate Evacuation Zone');

      // Asset Pins
      assets.forEach((asset) => {
        const isQrt = asset.type === 'QRT' || asset.type === 'NDRF';
        const pinIcon = L.divIcon({
          className: 'prepositioning-pin',
          html: `
            <div style="background-color: ${isQrt ? '#DC2626' : '#2E7D32'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; border: 1.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">
              ${isQrt ? '🚨' : '🏠'} ${asset.name}
            </div>
          `,
          iconSize: [120, 22],
          iconAnchor: [60, 11],
        });

        L.marker([asset.lat, asset.lon], { icon: pinIcon }).addTo(map).bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px;">
            <b>${asset.name}</b><br/>
            Personnel: ${asset.personnel}<br/>
            Equipment: ${asset.boats > 0 ? `${asset.boats} Rescue Boats` : 'Heavy Dewatering Pumps'}<br/>
            Status: ${asset.status}
          </div>
        `);
      });

      mapInstanceRef.current = map;
    }
  }, [assets]);

  return (
    <div className="relative w-full h-[320px] rounded-xl border border-[#E5E0D8] overflow-hidden bg-[#FAF7F2]">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 z-[400] bg-white/95 px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] text-[10px] shadow-sm flex items-center space-x-3 text-[#1A1D20]">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></span>
          <span>SDRF / NDRF Strike Teams</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]"></span>
          <span>Relief Shelters</span>
        </div>
      </div>
    </div>
  );
}
