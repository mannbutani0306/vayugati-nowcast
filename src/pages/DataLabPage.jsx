import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowLeft, Database, Pause, Play, RefreshCw, Radio, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchImergReplayFrame, fetchLiveFusionGrid, fetchRealVerificationResults } from '../lib/apiClient';

const SCENARIO_LEADS = [0, 15, 30, 45, 60, 120, 180, 240, 300, 360];
const CASE_LABELS = {
  leh_2010_08_05: 'Leh, 5 Aug 2010',
  leh_2011_07_25: 'Leh, 25 Jul 2011',
};

function rainfallColor(value) {
  if (value < 0.1) return null;
  if (value < 0.5) return [45, 152, 180, 100];
  if (value < 1) return [30, 158, 112, 140];
  if (value < 2) return [173, 190, 49, 165];
  if (value < 5) return [242, 190, 48, 185];
  if (value < 10) return [235, 116, 43, 205];
  if (value < 20) return [210, 58, 48, 220];
  return [142, 54, 139, 235];
}

function createRainfallOverlay(frame) {
  const rows = frame.precipitation_rate_mm_hr || [];
  const rowCount = rows.length;
  const columnCount = rows[0]?.length || 0;
  if (!rowCount || !columnCount) return null;

  const canvas = document.createElement('canvas');
  canvas.width = columnCount;
  canvas.height = rowCount;
  const context = canvas.getContext('2d');
  const image = context.createImageData(columnCount, rowCount);
  rows.forEach((row, y) => row.forEach((value, x) => {
    if (value == null || !Number.isFinite(Number(value))) return;
    const color = rainfallColor(Number(value));
    if (!color) return;
    const offset = (y * columnCount + x) * 4;
    image.data.set(color, offset);
  }));
  context.putImageData(image, 0, 0);

  const latitudes = frame.latitude || [];
  const longitudes = frame.longitude || [];
  const latStep = latitudes.length > 1 ? Math.abs(latitudes[1] - latitudes[0]) : 0.1;
  const lonStep = longitudes.length > 1 ? Math.abs(longitudes[1] - longitudes[0]) : 0.1;
  const south = Math.min(...latitudes) - latStep / 2;
  const north = Math.max(...latitudes) + latStep / 2;
  const west = Math.min(...longitudes) - lonStep / 2;
  const east = Math.max(...longitudes) + lonStep / 2;
  return { url: canvas.toDataURL('image/png'), bounds: [[south, west], [north, east]] };
}

function scenarioStyle(feature) {
  const properties = feature.properties || {};
  const risk = String(properties.risk_level || '').toUpperCase();
  const color = risk.includes('SEVERE') ? '#c7352b' : risk.includes('WARNING') ? '#e9812f' : '#138a81';
  return {
    color,
    weight: properties.feature_type === 'CURRENT_CONVECTIVE_CELL' ? 2 : 1.5,
    fillColor: color,
    fillOpacity: properties.feature_type === 'CURRENT_CONVECTIVE_CELL' ? 0.45 : 0.16,
    dashArray: properties.feature_type === 'CURRENT_CONVECTIVE_CELL' ? undefined : '5 5',
  };
}

export default function DataLabPage() {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);
  const overlayRef = useRef(null);
  const fittedCaseRef = useRef('');
  const lastModeRef = useRef('');
  const [mode, setMode] = useState('archive');
  const [archive, setArchive] = useState(null);
  const [selectedCase, setSelectedCase] = useState('leh_2010_08_05');
  const [frameIndex, setFrameIndex] = useState(0);
  const [frame, setFrame] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [scenarioLead, setScenarioLead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedArchive = useMemo(
    () => archive?.cases?.find((item) => item.case_id === selectedCase),
    [archive, selectedCase],
  );
  const frameCount = selectedArchive?.files_found || 0;
  const availableCases = archive?.cases?.filter((item) => item.files_found > 0) || [];

  useEffect(() => {
    let active = true;
    fetchRealVerificationResults()
      .then((payload) => {
        if (!active) return;
        setArchive(payload);
        const cases = payload.cases || [];
        const firstAvailable = cases.find((item) => item.files_found > 0);
        if (firstAvailable) setSelectedCase(firstAvailable.case_id);
        else setError('No archived IMERG frames are available in this backend deployment.');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load archive inventory.');
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return undefined;
    const map = L.map(mapElementRef.current, { preferCanvas: true }).setView([33, 78], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 13,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const element = mapElementRef.current;
    if (!map || !element || typeof ResizeObserver === 'undefined') return undefined;
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setFrameIndex(0);
    setFrame(null);
    setError('');
  }, [selectedCase]);

  useEffect(() => {
    if (mode !== 'archive' || !frameCount) return undefined;
    const controller = new AbortController();
    setError('');
    fetchImergReplayFrame(selectedCase, frameIndex, { signal: controller.signal })
      .then((payload) => {
        if (payload.status !== 'REAL_ARCHIVED') throw new Error(payload.message || 'This archive frame is unavailable.');
        setFrame(payload);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load this IMERG frame.');
      });
    return () => controller.abort();
  }, [frameCount, frameIndex, mode, selectedCase]);

  useEffect(() => {
    if (mode !== 'simulation' || scenario) return undefined;
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    fetchLiveFusionGrid({ decimate: 4 }, { signal: controller.signal })
      .then((payload) => setScenario(payload))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load the scenario.');
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [mode, scenario]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      if (mode === 'archive') {
        if (frameIndex >= frameCount - 1) setIsPlaying(false);
        else setFrameIndex(frameIndex + 1);
      } else {
        const next = SCENARIO_LEADS[SCENARIO_LEADS.indexOf(scenarioLead) + 1];
        if (next == null) setIsPlaying(false);
        else setScenarioLead(next);
      }
    }, mode === 'archive' ? 1500 : 1800);
    return () => window.clearInterval(timer);
  }, [frameCount, frameIndex, isPlaying, mode, scenarioLead]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    layers.clearLayers();
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    if (mode === 'archive' && frame?.status === 'REAL_ARCHIVED') {
      const overlay = createRainfallOverlay(frame);
      if (!overlay) return;
      overlayRef.current = L.imageOverlay(overlay.url, overlay.bounds, { opacity: 0.86 }).addTo(map);
      if (fittedCaseRef.current !== selectedCase || lastModeRef.current !== 'archive') {
        map.fitBounds(overlay.bounds, { padding: [18, 18] });
        fittedCaseRef.current = selectedCase;
      }
      lastModeRef.current = 'archive';
      return;
    }

    if (mode === 'simulation' && scenario?.features) {
      scenario.features
        .filter((feature) => {
          const properties = feature.properties || {};
          return properties.feature_type === 'CURRENT_CONVECTIVE_CELL'
            ? scenarioLead === 0
            : properties.feature_type === 'FORECAST_TRACK_CONE' && properties.lead_time_minutes === scenarioLead;
        })
        .forEach((feature) => {
          const layer = L.geoJSON(feature, { style: scenarioStyle });
          const properties = feature.properties || {};
          layer.bindPopup(`<strong>${properties.name || 'Scenario cell'}</strong><br>${properties.risk_level || 'Scenario'} · ${properties.lead_time_minutes || 0} min<br>Simulated fixture; not an observation.`);
          layer.addTo(layers);
        });
      if (scenario?.features?.length && lastModeRef.current !== 'simulation') map.setView([30.3, 78.1], 8);
      lastModeRef.current = 'simulation';
    }
  }, [frame, mode, scenario, scenarioLead, selectedCase]);

  const selectedFrameTime = frame?.timestamp_utc
    ? new Date(frame.timestamp_utc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
    : 'Waiting for archive frame';

  return (
    <main className="min-h-[70vh] bg-[#F3F6F6] text-[#17252B]">
      <header className="border-b border-[#D7E0E2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#0B7084]">Public data lab</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Convective data replay</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52646B]">Inspect archived precipitation frames or explore a separate, explicitly simulated 0–6 hour storm scenario. Neither mode issues a warning.</p>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 border border-[#D7E0E2] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#EEF4F5]"><ArrowLeft className="h-4 w-4" />Home</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Select data mode">
          <button type="button" aria-pressed={mode === 'archive'} onClick={() => { setIsPlaying(false); setMode('archive'); }} className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-semibold ${mode === 'archive' ? 'border-[#0B7084] bg-[#0B7084] text-white' : 'border-[#C9D5D8] bg-white text-[#29434B]'}`}><Database className="h-4 w-4" />Observed archive</button>
          <button type="button" aria-pressed={mode === 'simulation'} onClick={() => { setIsPlaying(false); setMode('simulation'); }} className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-semibold ${mode === 'simulation' ? 'border-[#9A4D14] bg-[#9A4D14] text-white' : 'border-[#C9D5D8] bg-white text-[#29434B]'}`}><Radio className="h-4 w-4" />Scenario simulation</button>
        </div>

        {mode === 'simulation' && <div className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status"><strong>SIMULATED SCENARIO.</strong> Cells and hazard inputs are demo fixtures; six-hour tracks are constant-velocity extrapolations, not live observations or validated forecasts. This mode does not create or send alerts.</div>}
        {mode === 'archive' && <div className="mb-4 border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950" role="status"><strong>REAL ARCHIVED SATELLITE PRECIPITATION.</strong> IMERG is approximately 10 km here, not the 1–3 km target; replay is for historical analysis, not a live warning.</div>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="min-w-0 border border-[#D7E0E2] bg-white" aria-label="Interactive precipitation and scenario map">
            <div ref={mapElementRef} className="h-[55vh] min-h-[360px] w-full bg-[#E8EFF0]" aria-label="Map showing the selected rainfall frame or storm scenario" />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#D7E0E2] px-4 py-3 text-xs text-[#40555D]">
              {mode === 'archive' ? <>
                <span className="font-semibold">Rain rate · mm/h</span>
                {[['#2d98b4', '0.1–0.5'], ['#1e9e70', '0.5–1'], ['#adbe31', '1–2'], ['#f2be30', '2–5'], ['#eb742b', '5–10'], ['#d23a30', '10–20'], ['#8e368b', '20+']].map(([color, label]) => <span key={label} className="inline-flex items-center gap-1"><i className="h-3 w-3" style={{ backgroundColor: color }} />{label}</span>)}
              </> : <><span className="font-semibold">Scenario geometry</span><span className="inline-flex items-center gap-1"><i className="h-3 w-3 bg-[#c7352b]" />Severe</span><span className="inline-flex items-center gap-1"><i className="h-3 w-3 bg-[#e9812f]" />Warning</span><span className="inline-flex items-center gap-1"><i className="h-3 w-3 bg-[#138a81]" />Other</span></>}
              <span className="ml-auto">Map tiles: OpenStreetMap</span>
            </div>
          </section>

          <aside className="border border-[#D7E0E2] bg-white p-4" aria-label="Playback controls and data provenance">
            {mode === 'archive' ? <>
              <label htmlFor="archive-case" className="block text-xs font-bold uppercase tracking-wide text-[#52646B]">Archived case</label>
              <select id="archive-case" value={selectedCase} onChange={(event) => setSelectedCase(event.target.value)} className="mt-1 w-full border border-[#C9D5D8] bg-white px-3 py-2 text-sm" disabled={!availableCases.length}>
                {(availableCases.length ? availableCases : Object.keys(CASE_LABELS).map((case_id) => ({ case_id, files_found: 0 }))).map((item) => <option key={item.case_id} value={item.case_id}>{CASE_LABELS[item.case_id] || item.case_id}</option>)}
              </select>
              <div className="mt-4 border-y border-[#E2E8E9] py-3 text-sm">
                <p><span className="font-semibold">Source:</span> NASA GPM IMERG Final Run V07</p>
                <p className="mt-1"><span className="font-semibold">Files:</span> {selectedArchive?.files_found ?? '—'} frames</p>
                <p className="mt-1"><span className="font-semibold">Grid:</span> ~10 km native spacing</p>
                <p className="mt-1"><span className="font-semibold">Frame time:</span> {selectedFrameTime} IST</p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button type="button" onClick={() => setIsPlaying((playing) => !playing)} disabled={!frameCount || isLoading} className="inline-flex h-10 w-10 items-center justify-center border border-[#0B7084] bg-[#0B7084] text-white disabled:opacity-50" aria-label={isPlaying ? 'Pause archive replay' : 'Play archive replay'}>{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <button type="button" onClick={() => { setIsPlaying(false); setFrameIndex(0); }} disabled={!frameCount} className="inline-flex h-10 w-10 items-center justify-center border border-[#C9D5D8] text-[#29434B] disabled:opacity-50" aria-label="Reset archive replay"><RotateCcw className="h-4 w-4" /></button>
                <span className="text-xs tabular-nums text-[#52646B]">{frameCount ? `${frameIndex + 1} / ${frameCount}` : 'No frames'}</span>
                {isLoading && <RefreshCw className="ml-auto h-4 w-4 animate-spin text-[#0B7084]" aria-label="Loading data" />}
              </div>
              <label htmlFor="archive-frame" className="mt-4 block text-xs font-semibold">Frame timeline</label>
              <input id="archive-frame" type="range" min="0" max={Math.max(frameCount - 1, 0)} value={frameIndex} onChange={(event) => { setIsPlaying(false); setFrameIndex(Number(event.target.value)); }} disabled={!frameCount} className="mt-2 w-full accent-[#0B7084]" />
              <div className="mt-4 border-l-4 border-[#0B7084] bg-[#EEF6F6] p-3 text-xs leading-5 text-[#29434B]">This is observed archived satellite precipitation. It is not DWR reflectivity and does not establish 1–3 km nowcast skill.</div>
            </> : <>
              <p className="text-xs font-bold uppercase tracking-wide text-[#9A4D14]">Repeatable demo controls</p>
              <p className="mt-2 text-sm"><span className="font-semibold">Source:</span> VayuGati synthetic storm fixtures</p>
              <p className="mt-1 text-sm"><span className="font-semibold">Horizon:</span> {scenarioLead} minutes of 360</p>
              <p className="mt-1 text-sm"><span className="font-semibold">Cells:</span> {scenario?.metadata?.total_active_cells ?? '—'}</p>
              <div className="mt-4 flex items-center gap-2">
                <button type="button" onClick={() => setIsPlaying((playing) => !playing)} disabled={!scenario || isLoading} className="inline-flex h-10 w-10 items-center justify-center border border-[#9A4D14] bg-[#9A4D14] text-white disabled:opacity-50" aria-label={isPlaying ? 'Pause scenario' : 'Play scenario'}>{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <button type="button" onClick={() => { setIsPlaying(false); setScenarioLead(0); }} className="inline-flex h-10 w-10 items-center justify-center border border-[#C9D5D8] text-[#29434B]" aria-label="Reset scenario"><RotateCcw className="h-4 w-4" /></button>
                {isLoading && <RefreshCw className="ml-auto h-4 w-4 animate-spin text-[#9A4D14]" aria-label="Loading scenario" />}
              </div>
              <label htmlFor="scenario-lead" className="mt-4 block text-xs font-semibold">Scenario lead time</label>
              <input id="scenario-lead" type="range" min="0" max={SCENARIO_LEADS.length - 1} value={SCENARIO_LEADS.indexOf(scenarioLead)} onChange={(event) => { setIsPlaying(false); setScenarioLead(SCENARIO_LEADS[Number(event.target.value)]); }} className="mt-2 w-full accent-[#9A4D14]" />
              <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 p-3 text-xs leading-5 text-amber-950">The 1 km display label is interpolated scenario guidance, not native 1 km forecast skill. No notification or alert is issued from this demo.</div>
            </>}
            {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800" role="alert">{error}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}