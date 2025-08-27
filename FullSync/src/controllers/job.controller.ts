import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.utils';

// ---------- ENV & ENDPOINTS ----------
const CTP_REGION       = process.env.CTP_REGION!;
const CTP_PROJECT_KEY  = process.env.CTP_PROJECT_KEY!;
const CTP_CLIENT_ID    = process.env.CTP_CLIENT_ID!;
const CTP_CLIENT_SECRET= process.env.CTP_CLIENT_SECRET!;

const AK_BASE          = (process.env.AKENEO_BASE_URL || '').replace(/\/+$/, '');
const AK_CLIENT_ID     = process.env.AKENEO_CLIENT_ID!;
const AK_CLIENT_SECRET = process.env.AKENEO_CLIENT_SECRET!;
const AK_USERNAME      = process.env.AKENEO_USERNAME!;
const AK_PASSWORD      = process.env.AKENEO_PASSWORD!;

const AUTH_URL = `https://auth.${CTP_REGION}.commercetools.com/oauth/token`;
const API_URL  = `https://api.${CTP_REGION}.commercetools.com/${CTP_PROJECT_KEY}`;

// ---------- SMALL HELPERS ----------
let ctTokenCache: { token: string; exp: number } | null = null;

function assertEnv() {
  const miss: string[] = [];
  for (const [k, v] of Object.entries({
    CTP_REGION, CTP_PROJECT_KEY, CTP_CLIENT_ID, CTP_CLIENT_SECRET,
    AK_BASE, AK_CLIENT_ID, AK_CLIENT_SECRET, AK_USERNAME, AK_PASSWORD
  })) {
    if (!v) miss.push(k);
  }
  if (miss.length) throw new Error(`Missing env: ${miss.join(', ')}`);
}

function nowSec() { return Math.floor(Date.now()/1000); }

async function getCtToken(): Promise<string> {
  if (ctTokenCache && ctTokenCache.exp > nowSec()+30) return ctTokenCache.token;
  const body = new URLSearchParams();
  body.set('grant_type','client_credentials');
  body.set('scope', `manage_project:${CTP_PROJECT_KEY}`);

  const resp = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${CTP_CLIENT_ID}:${CTP_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!resp.ok) throw new Error(`CT auth failed ${resp.status}`);
  const json: any = await resp.json();
  ctTokenCache = { token: json.access_token, exp: nowSec() + (json.expires_in || 1700) };
  return ctTokenCache.token;
}

async function ctFetch(path: string, init: RequestInit = {}) {
  const token = await getCtToken();
  const resp = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers||{}) }
  });
  return resp;
}

async function getAkeneoToken(): Promise<string> {
  const body = new URLSearchParams();
  body.set('grant_type','password');
  body.set('username', AK_USERNAME);
  body.set('password', AK_PASSWORD);

  const resp = await fetch(`${AK_BASE}/api/oauth/v1/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${AK_CLIENT_ID}:${AK_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!resp.ok) throw new Error(`Akeneo auth failed ${resp.status}`);
  const json: any = await resp.json();
  return json.access_token as string;
}

type AkValue = { locale: string|null; scope: string|null; data: any };
type AkProduct = { identifier: string; family?: string|null; values: Record<string, AkValue[]> };

function getAkVal(p: AkProduct, code: string, locale?: string|null, scope?: string|null) {
  const arr = p.values?.[code] || [];
  if (!arr.length) return undefined;
  // pick exact match else any
  const exact = arr.find(v => (locale == null || v.locale === locale) && (scope == null || v.scope === scope));
  return (exact ?? arr[0])?.data;
}

function lstring(s?: string) {
  return s ? { 'en-US': s } : { 'en-US': '' };
}

function toCent(amount: string | number) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.round((n || 0) * 100);
}

function buildPrices(from: any[] | undefined) {
  if (!Array.isArray(from)) return [];
  return from
    .filter(p => p && p.currency && (p.amount!=null))
    .map(p => ({
      value: { type: 'centPrecision', currencyCode: p.currency, centAmount: toCent(p.amount) }
    }));
}

function slugify(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// ---------- AKENEO FETCH (by family using IN operator) ----------
async function akeneoListProductsByFamily(family: string, limit: number, scope: string, locale: string): Promise<AkProduct[]> {
  const token = await getAkeneoToken();
  const search = encodeURIComponent(JSON.stringify({
    family: [{ operator: 'IN', value: [family] }]
  }));
  const url = `${AK_BASE}/api/rest/v1/products?search=${search}&search_scope=${encodeURIComponent(scope)}&search_locale=${encodeURIComponent(locale)}&limit=${limit}`;
  const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Akeneo products fetch failed ${resp.status}: ${txt}`);
  }
  const json: any = await resp.json();
  return (json._embedded?.items ?? []) as AkProduct[];
}

// ---------- CT HELPERS ----------
async function getProductByKey(key: string): Promise<any|null> {
  const r = await ctFetch(`/products/key=${encodeURIComponent(key)}`, { method: 'GET' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`CT GET product by key failed ${r.status}`);
  return r.json();
}

async function getProductTypeIdByKey(typeKey: string): Promise<string> {
  const r = await ctFetch(`/product-types/key=${encodeURIComponent(typeKey)}`);
  if (!r.ok) throw new Error(`CT get PT by key failed ${r.status}`);
  const j: any = await r.json();
  return j.id;
}

async function createProduct(draft: any): Promise<any> {
  const r = await ctFetch(`/products`, { method: 'POST', body: JSON.stringify(draft) });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`CT create product failed ${r.status}: ${body}`);
  }
  return r.json();
}

// ---------- MAIN JOB ----------
export const post = async (req: Request, res: Response, _next: NextFunction) => {
  assertEnv();

  // Defaults so you can just POST /job with no query
  const family  = (req.query.family  as string) || 'clothing';
  const typeKey = (req.query.typeKey as string) || 'clothing-ct';
  const scope   = (req.query.scope   as string) || 'ecommerce';
  const locale  = (req.query.locale  as string) || 'en_US';
  const limit   = parseInt((req.query.limit as string) || '25', 10);

  logger.info(`[JOB] FullSync upsert (no-params needed) family='${family}', type='${typeKey}', limit=${limit}, scope='${scope}', locale='${locale}'`);

  try {
    const ptId = await getProductTypeIdByKey(typeKey);
    const ak = await akeneoListProductsByFamily(family, limit, scope, locale);

    const result = {
      status: 'ok',
      mode: 'upsert' as const,
      typeKey,
      locale: 'en-US',
      attempted: 0,
      created: 0,
      existed: 0,
      errors: 0,
      details: [] as Array<{ key: string; created?: string; existed?: boolean; error?: string }>
    };

    for (const p of ak) {
      result.attempted++;
      const key = p.identifier;
      try {
        const existing = await getProductByKey(key);
        if (existing) {
          result.existed++;
          result.details.push({ key, existed: true });
          continue; // skip updates to avoid duplicate SKU errors
        }

        const sku = getAkVal(p, 'sku', null, null) || key;
        const nameStr  = getAkVal(p, 'name',  'en_US', null) || key;
        const descStr  = getAkVal(p, 'description', 'en_US', scope) || getAkVal(p, 'description', 'en_US', null) || '';

        // Optional priceCollection attribute named "price" like your dataset
        const priceColl = getAkVal(p, 'price', null, null) as any[] | undefined;
        const prices = buildPrices(priceColl);

        const draft = {
          key,
          productType: { id: ptId },
          name: lstring(String(nameStr)),
          description: lstring(String(descStr)),
          slug: { 'en-US': slugify(key) },
          masterVariant: {
            sku: String(sku),
            prices
          },
          // publish current data directly
          publish: true
        };

        const created = await createProduct(draft);
        result.created++;
        result.details.push({ key, created: created.id });
      } catch (e: any) {
        result.errors++;
        result.details.push({ key: p.identifier, error: String(e.message || e) });
      }
    }

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error(`[JOB] FullSync error: ${err?.message || err}`);
    return res.status(500).json({
      message: 'Internal Server Error - Error processing full sync job',
      error: err?.message || String(err),
    });
  }
};
