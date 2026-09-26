import React from 'react';
import { Activity, AlertCircle, LoaderCircle, Radio } from 'lucide-react';

const STATUS_STYLES = {
  LIVE: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  PARTIAL: 'border-amber-300 bg-amber-50 text-amber-800',
  CACHED: 'border-amber-300 bg-amber-50 text-amber-900',
  OFFLINE: 'border-red-300 bg-red-50 text-red-800',
  LOADING: 'border-sky-300 bg-sky-50 text-sky-800',
};

export default function DataStatusBadge({ status = 'OFFLINE', metadata, hasCachedData = false }) {
  const normalizedStatus = String(status).toUpperCase();
  const style = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.OFFLINE;
  const Icon = normalizedStatus === 'LIVE' ? Radio
    : normalizedStatus === 'LOADING' ? LoaderCircle
      : normalizedStatus === 'OFFLINE' ? AlertCircle : Activity;
  const label = normalizedStatus === 'LIVE'
    ? 'Source: Open-Meteo NWP • Live Stream'
    : normalizedStatus === 'PARTIAL'
      ? 'Source: Open-Meteo NWP • Partial Feed'
      : normalizedStatus === 'CACHED' || (normalizedStatus === 'OFFLINE' && hasCachedData)
        ? 'Data Feed: Offline / Using Cached Baseline'
        : normalizedStatus === 'LOADING'
          ? 'Source: Open-Meteo NWP • Connecting'
          : 'Data Feed: Offline / No Live Data';

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-semibold leading-tight ${style}`}
      role="status"
      title={metadata?.latency_ms != null ? `${metadata.source || 'Open-Meteo NWP'} response in ${metadata.latency_ms} ms` : label}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${normalizedStatus === 'LOADING' ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
