import { useState, useEffect } from 'react';

export interface CurrencyInfo {
  code: string;    // e.g. "INR"
  symbol: string;  // e.g. "₹"
  country: string; // e.g. "IN"
  name: string;    // e.g. "Indian Rupee"
}

export const CURRENCY_LIST: CurrencyInfo[] = [
  { code: 'USD', symbol: '$',    country: 'US', name: 'US Dollar' },
  { code: 'EUR', symbol: '€',    country: 'EU', name: 'Euro' },
  { code: 'GBP', symbol: '£',    country: 'GB', name: 'British Pound' },
  { code: 'INR', symbol: '₹',    country: 'IN', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'C$',   country: 'CA', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',   country: 'AU', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$',   country: 'SG', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'AED',  country: 'AE', name: 'UAE Dirham' },
  { code: 'SAR', symbol: 'SAR',  country: 'SA', name: 'Saudi Riyal' },
  { code: 'BDT', symbol: '৳',    country: 'BD', name: 'Bangladeshi Taka' },
  { code: 'PKR', symbol: '₨',    country: 'PK', name: 'Pakistani Rupee' },
  { code: 'LKR', symbol: 'Rs',   country: 'LK', name: 'Sri Lankan Rupee' },
  { code: 'NPR', symbol: 'Rs',   country: 'NP', name: 'Nepalese Rupee' },
  { code: 'JPY', symbol: '¥',    country: 'JP', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥',    country: 'CN', name: 'Chinese Yuan' },
  { code: 'KRW', symbol: '₩',    country: 'KR', name: 'South Korean Won' },
  { code: 'IDR', symbol: 'Rp',   country: 'ID', name: 'Indonesian Rupiah' },
  { code: 'MYR', symbol: 'RM',   country: 'MY', name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿',    country: 'TH', name: 'Thai Baht' },
  { code: 'PHP', symbol: '₱',    country: 'PH', name: 'Philippine Peso' },
  { code: 'BRL', symbol: 'R$',   country: 'BR', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$',    country: 'MX', name: 'Mexican Peso' },
  { code: 'ZAR', symbol: 'R',    country: 'ZA', name: 'South African Rand' },
  { code: 'NGN', symbol: '₦',    country: 'NG', name: 'Nigerian Naira' },
  { code: 'KES', symbol: 'KSh',  country: 'KE', name: 'Kenyan Shilling' },
  { code: 'CHF', symbol: 'Fr',   country: 'CH', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr',   country: 'SE', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr',   country: 'NO', name: 'Norwegian Krone' },
];

const CURRENCY_BY_CODE: Record<string, CurrencyInfo> = Object.fromEntries(
  CURRENCY_LIST.map(c => [c.code, c]),
);

const DEFAULT: CurrencyInfo = { code: 'USD', symbol: '$', country: 'US', name: 'US Dollar' };
const CACHE_KEY = 'mi_currency';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function loadCached(): CurrencyInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data as CurrencyInfo;
  } catch { /* ignore */ }
  return null;
}

function saveCache(info: CurrencyInfo) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: info, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyInfo>(
    () => loadCached() ?? DEFAULT,
  );
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    // Skip fetch if we already have a fresh cached value
    if (loadCached()) return;

    setDetecting(true);
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then((data: { currency?: string; country_code?: string }) => {
        const code = data.currency ?? 'USD';
        const country = data.country_code ?? 'US';
        const meta = CURRENCY_BY_CODE[code] ?? { code, symbol: code, country, name: code };
        const info: CurrencyInfo = { ...meta, country };
        setCurrencyState(info);
        saveCache(info);
      })
      .catch(() => { /* stay on default */ })
      .finally(() => setDetecting(false));
  }, []);

  const override = (info: CurrencyInfo) => {
    setCurrencyState(info);
    saveCache(info);
  };

  return { currency, detecting, override };
}
