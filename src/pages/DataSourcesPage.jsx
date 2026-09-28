import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Database, ExternalLink, Radio, Satellite, ShieldCheck, Zap } from 'lucide-react';
import { fetchImergMonthlyContext, fetchRealSatelliteScene, fetchRealVerificationResults } from '../lib/apiClient';

const sources = [
  {
    icon: Database,
    name: 'NWP instability fields',
    source: 'Open-Meteo GFS / ICON',
    sourceUrl: 'https://open-meteo.com/',
    mode: 'Live API · Real time',
    state: 'Live when API is reachable',
    detail: 'CAPE, CIN, lifted index, wind, precipitation, pressure and precipitable water are requested for the selected cell. Forecast fields are third-party NWP guidance, not an official IMD warning.',
    tone: 'green',
  },
  {
    icon: Satellite,
    name: 'Satellite cloud tops',
    source: 'MOSDAC INSAT-3D / INSAT-3DR TIR1',
    sourceUrl: 'https://mosdac.gov.in/',
    mode: 'Periodic raster stream',
    state: 'Visual feed; calibrated sampling optional',
    detail: 'Public infrared imagery provides visual cloud context. A calibrated, georeferenced raster sample or tile overlay is available only when its MOSDAC endpoint and georeferencing are configured.',
    tone: 'blue',
  },
  {
    icon: Radio,
    name: 'Radar reflectivity',
    source: 'IMD public Doppler radar imagery',
    sourceUrl: 'https://mausam.imd.gov.in/responsive/radar.php',
    mode: 'Cached image / configured overlay',
    state: 'Not a national live mosaic by default',
    detail: 'Public radar imagery is referenced as an overlay. Map placement is not inferred: a georeferenced tile endpoint and bounds must be configured before it is drawn as a spatially accurate layer.',
    tone: 'amber',
  },
  {
    icon: Zap,
    name: 'Lightning strikes',
    source: 'Blitzortung open community network',
    sourceUrl: 'https://www.blitzortung.org/en/live_lightning_maps.php',
    mode: 'Open community proxy',
    state: 'Proxy endpoint required',
    detail: 'The adapter accepts validated GeoJSON from an operator-configured proxy. Blitzortung does not publish a documented anonymous GeoJSON API; this feed is not an official IMD lightning product.',
    tone: 'amber',
  },
  {
    icon: ShieldCheck,
    name: 'Disaster broadcasts',
    source: 'NDMA CAP v1.2 message format',
    sourceUrl: 'https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html',
    mode: 'Operational-ready format',
    state: 'Approval + XML generation supported',
    detail: 'Approved warnings are stored in Supabase. This prototype does not dispatch warnings to NDMA SACHET or any national broadcast network.',
    tone: 'blue',
  },
];

const statusClasses = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  blue: 'bg-sky-50 text-sky-800 border-sky-200',
  amber: 'bg-amber-50 text-amber-900 border-amber-200',
};

const environment = [
  ['NWP_API_BASE_URL', 'Base URL for the NWP provider; defaults to Open-Meteo.'],
  ['DATA_DIR', 'Root directory for local archived data; defaults to ./data.'],
  ['MOSDAC_TIR_LOCAL_DIR', 'Local INSAT-3DR TIR1 directory; defaults to DATA_DIR/mosdac.'],
  ['IMERG_MONTHLY_REGION_LABEL', 'Optional Giovanni region label; defaults to UNVERIFIED - confirm shape in Giovanni.'],
  ['MOSDAC_TIR_GEOTIFF_URL', 'Calibrated, georeferenced TIR1 raster for point sampling.'],
  ['MOSDAC_TIR_TILE_URL / MOSDAC_TIR_BOUNDS', 'Satellite tile template and explicit map bounds.'],
  ['IMD_RADAR_TILE_URL / IMD_RADAR_BOUNDS', 'Radar tile template and explicit map bounds.'],
  ['IMD_RADAR_WMS_LAYER', 'Optional IMD WMS layer name.'],
  ['BLITZORTUNG_PROXY_URL', 'Authorized proxy URL returning validated GeoJSON.'],
];

const indianSourceRegister = [
  ['pyiwr', 'IIT Indore open-source IMD DWR reader', 'REGISTER', 'Access and end-to-end decoding have not been verified in this deployment.'],
  ['MOSDAC INSAT-3D/3DR IMSRA', 'Rainfall plus IR/CTT products', 'REGISTER', 'Provider registration and product authorization required.'],
  ['NCMRWF NCUM-R', 'Approximately 4 km NWP', 'REQUEST', 'Institutional access and licensing remain a deployment step.'],
  ['NCMRWF IMDAA', 'Reanalysis', 'REQUEST', 'Institutional access and licensing remain a deployment step.'],
  ['ISRO Bhuvan', 'Base-map WMS only', 'VERIFIED', 'Suitable for mapping context, not a meteorological observation feed.'],
  ['IMD API Portal / DWR raw network', 'Official weather and radar services', 'REQUEST', 'Credentials, endpoint terms and operational authorization are not configured here.'],
  ['IITM Pune Lightning Location Network', 'Lightning location observations', 'REQUEST', 'Institutional access and feed contract are not configured here.'],
];

export default function DataSourcesPage() {
  const [monthlyContext, setMonthlyContext] = useState(null);
  const [realArchive, setRealArchive] = useState(null);
  const [realScene, setRealScene] = useState(null);
  const [sourceError, setSourceError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      fetchImergMonthlyContext(),
      fetchRealVerificationResults(),
      fetchRealSatelliteScene(),
    ]).then(([monthly, archive, scene]) => {
      if (!mounted) return;
      if (monthly.status === 'fulfilled') setMonthlyContext(monthly.value);
      if (archive.status === 'fulfilled') setRealArchive(archive.value);
      if (scene.status === 'fulfilled') setRealScene(scene.value);
      const rejected = [monthly, archive, scene].find((result) => result.status === 'rejected');
      if (rejected) setSourceError(rejected.reason?.message || 'Some local archive status could not be loaded.');
    });
    return () => { mounted = false; };
  }, []);

  const sourceRows = [
    { ...sources[0], name: 'Open-Meteo NWP', state: 'REAL_LIVE', detail: 'Live forecast API request path. Coverage and provider uptime vary; this is NWP guidance, not an official IMD warning.' },
    { ...sources[1], name: 'INSAT-3DR scene(s)', mode: 'Local archived TIR1 GeoTIFF', state: realScene?.status || 'AWAITING REAL DATA', detail: realScene?.message || 'Local scene inventory is loading. Brightness temperature requires declared units or a verified matching calibration lookup.' },
    { icon: Database, name: 'IMERG monthly', source: 'NASA GPM IMERG Giovanni', sourceUrl: 'https://gpm.nasa.gov/data/imerg', mode: 'Local monthly CSV · context only', state: monthlyContext?.status || 'AWAITING REAL DATA', detail: monthlyContext ? `${monthlyContext.input_row_count} rows parsed; region: ${monthlyContext.region_label}. Context only - not a nowcast input.` : 'Monthly precipitation context is unavailable until the local Giovanni CSV is present.' , tone: 'blue' },
    { icon: Database, name: 'IMERG half-hourly Leh cases', source: 'NASA GPM IMERG Final Run V07', sourceUrl: 'https://gpm.nasa.gov/data/imerg', mode: 'Local archived HDF5', state: realArchive?.status || 'AWAITING REAL DATA', detail: realArchive?.cases?.map((item) => `${item.case_id}: ${item.frames_loaded ?? item.files_found}/${item.files_found} frames`).join('; ') || 'Awaiting local half-hourly files in the documented Leh case folders.', tone: 'blue' },
    { icon: ShieldCheck, name: 'Leh case facts', source: 'Bhan et al. (2015), MAUSAM 66(1), 107-122', mode: 'Published-paper case record', state: 'DOCUMENTED_CASE', detail: 'Paraphrased facts from the cited paper; no imagery is presented as observed. See the Officer real-world anchor case.', tone: 'blue' },
    { icon: Satellite, name: 'Kalpana-1 imagery (2010 case)', source: 'Kalpana-1 IR chronology in Bhan et al. (2015)', mode: 'Paper-reported chronology only', state: 'REQUEST', detail: 'Original satellite scenes are not included; the documented chronology is not a replacement for imagery.', tone: 'amber' },
    { ...sources[2], name: 'IMD DWR', state: 'REQUEST', detail: 'Authorized DWR observations and calibrated reflectivity archives are not configured.' },
    { ...sources[3], name: 'Lightning', state: 'SIMULATED proxy', detail: 'Lightning values in the storm-cell demo are simulated proxy values, not official observed lightning.' },
    { icon: Radio, name: 'Storm cells', source: 'VayuGati demo cell generator', mode: 'Synthetic fixture', state: 'SIMULATED_DEMO_FIXTURE', detail: 'Named cells, lifecycle histories, and hazard inputs are demo fixtures; never label them as observed storms.', tone: 'amber' },
    { ...sources[4], state: 'SIMULATED_DEMO_FIXTURE', tone: 'amber' },
  ];

  return (
    <div lang="en" className="min-h-[70vh] bg-[#FAF7F2] text-[#1A1D20]">
      <header className="border-b border-[#E5E0D8] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0B5D73]">Transparency register</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Data sources &amp; attribution</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#48525A]">
            This register distinguishes live third-party data, public imagery, community proxies and system capabilities. Availability depends on provider uptime and deployment configuration.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8" aria-labelledby="sources-heading">
        <section aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="mb-3 text-lg font-bold">Current inputs and operational status</h2>
          <div className="overflow-x-auto border border-[#D8DDE0] bg-white">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <caption className="sr-only">Data source, delivery mode, current operational state, and limitations</caption>
              <thead className="bg-[#102C3A] text-white">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Input</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Attribution</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Delivery mode</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Current state</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Notes and limitations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8]">
                {sourceRows.map(({ icon: Icon, name, source, sourceUrl, mode, state, detail, tone }) => (
                  <tr key={name} className="align-top hover:bg-[#F7FAFB]">
                    <th scope="row" className="px-4 py-4 font-semibold text-[#172A33]">
                      <span className="flex items-center gap-2"><Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#0B7084]" />{name}</span>
                    </th>
                    <td className="px-4 py-4 font-medium">
                      {sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${source} external source`} className="inline-flex items-center gap-1 text-[#07586B] underline decoration-[#8CB5BD] underline-offset-2 hover:text-[#0B2C39]">
                          {source}<ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ) : source}
                    </td>
                    <td className="px-4 py-4">{mode}</td>
                    <td className="px-4 py-4"><span className={`inline-block border px-2 py-1 text-xs font-semibold ${statusClasses[tone]}`}>{state}</span></td>
                    <td className="max-w-[32rem] px-4 py-4 leading-5 text-[#48525A]">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sourceError && <p className="mt-2 text-xs text-amber-800">{sourceError}</p>}
          <p className="mt-3 text-xs leading-5 text-[#59656D]">
            “Live” describes a request path, not guaranteed coverage, provider accuracy, or official warning authority. Check each feed’s returned status and timestamp before operational use.
          </p>
        </section>

        <section className="mt-9 border-t border-[#D8DDE0] pt-6" aria-labelledby="seasonal-context-heading">
          <h2 id="seasonal-context-heading" className="text-lg font-bold">Seasonal context (IMERG monthly, context only - not a nowcast input)</h2>
          {monthlyContext?.status === 'REAL_ARCHIVED' ? (
            <>
              <p className="mt-1 text-xs text-[#59656D]">Monthly-mean precipitation rate was converted to mm/month using each calendar month's day count. Region: {monthlyContext.region_label}. This series is not radar data and is not a nowcast input.</p>
              <div className="mt-4 border border-[#D8DDE0] bg-white p-4">
                <div className="grid h-36 grid-cols-12 items-end gap-2" role="img" aria-label="IMERG monthly context climatology in millimeters per month">
                  {monthlyContext.monthly_context.map((month) => {
                    const maximum = Math.max(...monthlyContext.monthly_context.map((item) => item.mean_precipitation_mm || 0), 1);
                    const height = month.mean_precipitation_mm == null ? 0 : Math.max(2, month.mean_precipitation_mm / maximum * 100);
                    return (
                      <div key={month.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-1" title={`${month.month_name}: ${month.mean_precipitation_mm?.toFixed(1) ?? 'Unavailable'} mm/month`}>
                        <span className="text-[9px] font-mono text-[#59656D]">{month.mean_precipitation_mm?.toFixed(0) ?? 'n/a'}</span>
                        <div className="w-full max-w-8 bg-[#0B7084]" style={{ height: `${height}%` }}></div>
                        <span className="text-[9px] text-[#59656D]">{month.month_name}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs font-semibold text-[#173943]">JJAS / rest-of-year mean monthly total ratio: {monthlyContext.jjas_vs_rest_ratio?.toFixed(2) ?? 'Unavailable'} · {monthlyContext.region_label}</p>
              </div>
            </>
          ) : (
            <p className="mt-3 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">AWAITING REAL DATA: {monthlyContext?.instructions || 'Place the Giovanni monthly export at data/imerg_monthly/monthly_mean.csv.'}</p>
          )}
        </section>

        <section className="mt-9 border-t border-[#D8DDE0] pt-6" aria-labelledby="indian-register-heading">
          <h2 id="indian-register-heading" className="mb-3 text-lg font-bold">Indian source access register</h2>
          <div className="overflow-x-auto border border-[#D8DDE0] bg-white">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[#102C3A] text-white"><tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Use</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Evidence note</th></tr></thead>
              <tbody className="divide-y divide-[#E5E0D8]">{indianSourceRegister.map(([name, use, status, note]) => <tr key={name} className="align-top"><th className="px-4 py-3 font-semibold">{name}</th><td className="px-4 py-3">{use}</td><td className="px-4 py-3 font-bold">{status}</td><td className="px-4 py-3 text-[#48525A]">{note}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#59656D]">Native NWP products are coarser than the 1 km display grid. Any finer display is interpolated guidance, not native 1 km forecast skill.</p>
        </section>

        <section className="mt-9 border-t border-[#D8DDE0] pt-6" aria-labelledby="roadmap-heading">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#0B5D73]">Evaluator Q&amp;A</p>
              <h2 id="roadmap-heading" className="mt-1 text-xl font-bold">Operational roadmap</h2>
              <p className="mt-3 text-sm leading-6 text-[#48525A]">
                Feed adapters isolate providers from the alert and map workflows. At deployment, authorized IMD/MoES endpoints can replace public or proxy URLs through environment configuration while retaining the same normalized observation contracts.
              </p>
              <p className="mt-3 text-sm leading-6 text-[#48525A]">
                Private credentials belong in the hosting platform’s secret settings, never in browser code. Provider authorization, data licensing, calibration, coverage and failover behavior must be verified before an internal feed is treated as operational.
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#172A33]">
                A CAP v1.2 export is a message-format capability; it does not claim a live connection to NDMA SACHET or a national broadcast network.
              </p>
            </div>

            <div className="overflow-hidden border border-[#D8DDE0] bg-white">
              <h3 className="border-b border-[#D8DDE0] bg-[#EEF4F5] px-4 py-3 text-sm font-bold">Deployment configuration points</h3>
              <dl className="divide-y divide-[#E5E0D8]">
                {environment.map(([key, description]) => (
                  <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(13rem,0.85fr)_minmax(0,1.15fr)] sm:gap-4">
                    <dt className="break-all font-mono text-xs font-semibold text-[#0B5367]">{key}</dt>
                    <dd className="text-sm leading-5 text-[#48525A]">{description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <div className="mt-8 flex items-start gap-3 border-l-4 border-[#0B7084] bg-[#EAF3F4] px-4 py-3 text-sm leading-6 text-[#173943]" role="note">
          <ArrowUpRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
          <p>VayuGati is a project prototype, not an official government warning service. For emergency decisions, follow alerts issued by authorized IMD, NDMA and State Disaster Management authorities.</p>
        </div>

        <div className="mt-6">
          <Link to="/" className="inline-flex items-center gap-2 rounded border border-[#D8DDE0] bg-white px-4 py-2.5 text-sm font-semibold text-[#172A33] hover:bg-[#EEF4F5]">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Go back to home screen
          </Link>
        </div>
      </div>
    </div>
  );
}
