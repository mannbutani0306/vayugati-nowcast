import React, { useEffect } from 'react';
import { ExternalLink, Info, Radio, Satellite, X, Zap } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';

const DATA_SOURCES = [
  {
    label: 'NWP Instability',
    source: 'Open-Meteo GFS / ICON',
    cadence: 'Hourly model fields; latest forecast hour returned by the API.',
    status: 'Live API',
    icon: Radio,
  },
  {
    label: 'Satellite Imagery',
    source: 'MOSDAC INSAT-3D/3DR TIR1',
    cadence: 'Periodic image stream. Calibrated cloud-top temperature sampling requires a configured georeferenced GeoTIFF product.',
    status: 'Public imagery; raster sampling requires configured access',
    href: 'https://mosdac.gov.in/',
    icon: Satellite,
  },
  {
    label: 'Radar Reflectivity',
    source: 'IMD Doppler Weather Radar',
    cadence: 'Station image updates vary. A map overlay is shown only when a georeferenced WMS/TMS endpoint and bounds are configured.',
    status: 'Cached / mosaic stream; tile configuration required',
    href: 'https://mausam.imd.gov.in/responsive/radar.php',
    icon: Radio,
  },
  {
    label: 'Lightning Strikes',
    source: 'Blitzortung Open Network',
    cadence: 'Proxy refresh interval depends on the upstream feed and deployment configuration.',
    status: 'Open network via operator-configured proxy; no documented anonymous GeoJSON API',
    href: 'https://www.blitzortung.org/',
    icon: Zap,
  },
  {
    label: 'Storm tracks and hazard pins',
    source: 'Bundled reference scenarios',
    cadence: 'Static illustrative examples in this build; not live observations and not suitable for operational alerting.',
    status: 'Reference data only',
    icon: Info,
  },
];

export default function DataDisclaimerModal({ open, onClose }) {
  const { translate } = useAccessibility();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[#101A22]/65 p-2 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="data-source-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto border border-[#D9E1E3] bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
        role="dialog"
      >
        <header className="flex items-start justify-between border-b border-[#D9E1E3] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase text-[#557078]">{translate('Feed transparency')}</p>
            <h2 id="data-source-title" className="mt-1 text-lg font-bold text-[#142A32]">{translate('About Data Sources')}</h2>
          </div>
          <button aria-label="Close data sources" className="p-1 text-[#52656B] hover:bg-[#F0F4F4]" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="divide-y divide-[#E6ECEE]">
          {DATA_SOURCES.map((item) => {
            const Icon = item.icon;
            return (
              <article className="grid grid-cols-[32px_1fr] gap-3 px-5 py-4" key={item.label}>
                <span className="flex h-8 w-8 items-center justify-center border border-[#D9E1E3] bg-[#F5F8F8] text-[#315966]">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h3 className="text-sm font-bold text-[#1A2C33]">{item.label}</h3>
                    <span className="text-[10px] font-semibold text-[#52656B]">{item.status}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-[#315966]">{item.source}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#5D6D72]">{item.cadence}</p>
                  {item.href && (
                    <a className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#17627A] hover:underline" href={item.href} rel="noreferrer" target="_blank">
                      {translate('Provider site')} <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <footer className="border-t border-[#D9E1E3] bg-[#F5F8F8] px-5 py-3 text-[11px] leading-relaxed text-[#52656B]">
          Feed availability and latency depend on upstream providers and deployment configuration. Missing feeds are shown as unavailable; no synthetic satellite, radar, or lightning observations are substituted.
        </footer>
      </section>
    </div>
  );
}
