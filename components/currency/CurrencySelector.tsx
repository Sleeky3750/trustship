'use client';

// components/currency/CurrencySelector.tsx
//
// High-end currency dropdown with country-flag badges, plus an optional live
// conversion-rate preview banner.
//
// Two render modes:
//   - `inline`  (default): a bordered dropdown with the flag + code.
//   - `banner`: the dropdown rendered as part of a highlighted rate strip.
//
// The component is fully controlled (`value` + `onChange`) and fetches the
// preview itself, so a parent can drop it into checkout without wiring the
// rate plumbing.

import { useEffect, useMemo, useRef, useState } from 'react';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

// Mirrors SUPPORTED_CURRENCIES from lib/currency.ts. Inlined because that
// module imports Prisma and must not be bundled into a Client Component.
const CURRENCIES: CurrencyOption[] = [
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', flag: '🇬🇭' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
];

export interface CurrencySelectorProps {
  value: string;
  onChange: (code: string) => void;
  /** Currency the amount is quoted in — drives the conversion preview. */
  baseCurrency?: string;
  /** Amount to convert for the preview banner (omit to hide the banner). */
  amount?: number;
  /** Render the selector as a highlighted strip instead of a plain field. */
  variant?: 'inline' | 'banner';
  label?: string;
  disabled?: boolean;
  className?: string;
}

interface RatePreview {
  rate: number;
  converted: number;
  formatted: string;
  updatedAt: string | null;
}

export default function CurrencySelector({
  value,
  onChange,
  baseCurrency = 'NGN',
  amount,
  variant = 'inline',
  label = 'Currency',
  disabled = false,
  className = '',
}: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<RatePreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => CURRENCIES.find((c) => c.code === value.toUpperCase()) || CURRENCIES[0],
    [value]
  );

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;

    const onClickAway = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Fetch the conversion preview whenever the pair or amount changes.
  useEffect(() => {
    if (amount === undefined || !Number.isFinite(amount)) {
      setPreview(null);
      return;
    }
    if (selected.code === baseCurrency.toUpperCase()) {
      setPreview(null);
      setPreviewError('');
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError('');

    (async () => {
      try {
        const params = new URLSearchParams({
          from: baseCurrency,
          to: selected.code,
          amount: String(amount),
        });
        const res = await fetch(`/api/currency/rates?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Rate unavailable');
        }
        setPreview({
          rate: data.rate,
          converted: data.converted,
          formatted: data.formatted,
          updatedAt: data.updatedAt,
        });
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(err instanceof Error ? err.message : 'Rate unavailable');
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected.code, baseCurrency, amount]);

  const dropdown = (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-50 ${
          variant === 'banner' ? 'min-w-[170px]' : ''
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true" className="text-base leading-none">{selected.flag}</span>
          <span className="font-semibold">{selected.code}</span>
          <span className="text-slate-400 truncate hidden sm:inline">{selected.symbol}</span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-2 w-full max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl p-1.5"
        >
          {CURRENCIES.map((currency) => {
            const isActive = currency.code === selected.code;
            return (
              <li key={currency.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(currency.code);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-none">{currency.flag}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{currency.code}</span>
                    <span className="block text-[11px] text-slate-400 truncate">{currency.name}</span>
                  </span>
                  {isActive && <span className="text-blue-600 text-xs font-bold">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (variant === 'banner') {
    const sameCurrency = selected.code === baseCurrency.toUpperCase();
    return (
      <div
        className={`rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3 ${className}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {label && (
              <span className="block text-xs font-semibold uppercase tracking-wider text-blue-700/80 mb-1">
                {label}
              </span>
            )}
            {dropdown}
          </div>

          {sameCurrency ? (
            <p className="text-xs font-semibold text-slate-500 pb-2">
              Base currency — no conversion applied.
            </p>
          ) : loadingPreview ? (
            <p className="text-xs text-slate-500 pb-2 animate-pulse">Fetching live rate…</p>
          ) : preview ? (
            <div className="text-right pb-1">
              <p className="text-lg font-bold text-slate-900">
                ≈ {preview.formatted}
              </p>
              <p className="text-[11px] text-slate-500">
                1 {baseCurrency.toUpperCase()} = {preview.rate.toLocaleString('en-NG', {
                  maximumFractionDigits: 4,
                })}{' '}
                {selected.code}
              </p>
            </div>
          ) : previewError ? (
            <p className="text-xs font-semibold text-amber-700 pb-2">
              Live rate unavailable — {previewError}
            </p>
          ) : null}
        </div>

        {preview?.updatedAt && (
          <p className="text-[10px] text-slate-400">
            Rate updated {new Date(preview.updatedAt).toLocaleString('en-NG')}
          </p>
        )}
      </div>
    );
  }

  return <div className={`space-y-2 ${className}`}>{dropdown}</div>;
}
