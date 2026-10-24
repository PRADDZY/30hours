import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import type { SourceMaterial } from '../types';
import { ApiError, combinedSignal } from './http';

const MAX_BYTES = 10 * 1024 * 1024;
type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;

export function isPublicAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(ip) === 4) {
    const [a,b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,2,168].includes(b)) || (a === 198 && [18,19,51].includes(b)) || (a === 203 && b === 0));
  }
  if (isIP(ip) === 6) {
    // Only globally routable unicast 2000::/3; reject transition, benchmarking and documentation ranges.
    const [first,second] = ip.split(':').map(part=>Number.parseInt(part || '0',16));
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && !(first===0x2001 && (second<=0x1ff || second===0xdb8));
  }
  return false;
}

export async function validatePublicUrl(raw: string, resolver: Resolver = (host) => lookup(host, { all: true, verbatim: true })) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ApiError(400, 'Please enter a valid public URL.'); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new ApiError(400, 'Only public HTTP and HTTPS URLs on standard ports are supported.');
  const hostname = url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'');
  if (!hostname.includes('.') && !isIP(hostname) || /(?:^|\.)(localhost|local|internal|home|lan|test|invalid)$/.test(hostname)) throw new ApiError(400, 'The source must use a public internet address.');
  let addresses: Address[];
  try {
    if (isIP(hostname)) addresses = [{ address: hostname, family: isIP(hostname) }];
    else {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { addresses = await Promise.race([resolver(hostname), new Promise<never>((_,reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')),5000); })]); }
      finally { if (timer) clearTimeout(timer); }
    }
  } catch { throw new ApiError(400, 'The source address could not be resolved.'); }
  if (!addresses.length || addresses.some(({address}) => !isPublicAddress(address))) throw new ApiError(400, 'The source must resolve only to public internet addresses.');
  url.hash = '';
  return { url, addresses };
}

async function downloadSource(raw: string, signal?: AbortSignal): Promise<{ data: Buffer; url: string; type: string }> {
  let current = raw;
  const timeout = combinedSignal(signal, 25_000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const {url,addresses} = await validatePublicUrl(current);
    const pinned = addresses[0];
    const result = await new Promise<{ status: number; location?: string; type: string; data: Buffer }>((resolve,reject) => {
      // Pin the checked DNS result to the socket; TLS still verifies the original hostname.
      const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = transport(url, {
        signal: timeout, method: 'GET', headers: { 'User-Agent': '30hours/1.0 (article reader)', Accept: 'text/html,application/pdf,text/plain;q=0.8', 'Accept-Encoding': 'identity' },
        lookup: ((_host: string, options: unknown, callback: (...args: unknown[]) => void) => {
          if (typeof options==='object' && options!==null && 'all' in options && options.all) callback(null,[pinned]);
          else callback(null,pinned.address,pinned.family);
        }) as never,
      }, res => {
        const status = res.statusCode || 500;
        const type = String(res.headers['content-type'] || '').toLowerCase();
        if ([301,302,303,307,308].includes(status)) { res.resume(); resolve({status,location:res.headers.location,type,data:Buffer.alloc(0)}); return; }
        if (status < 200 || status >= 300) { res.resume(); reject(new ApiError(422, 'This source could not be downloaded. Check that it is publicly accessible.')); return; }
        if (Number(res.headers['content-length'] || 0) > MAX_BYTES) { res.destroy(); reject(new ApiError(413, 'Sources must be smaller than 10 MB.')); return; }
        if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') { res.destroy(); reject(new ApiError(422, 'This source uses an unsupported download encoding.')); return; }
        const parts: Buffer[] = []; let size = 0;
        res.on('data',(part:Buffer) => { size += part.length; if (size > MAX_BYTES) { res.destroy(); reject(new ApiError(413,'Sources must be smaller than 10 MB.')); } else parts.push(part); });
        res.on('end',() => resolve({status,type,data:Buffer.concat(parts)}));
        res.on('error',() => reject(new ApiError(422,'The source download was interrupted.')));
      });
      req.on('error',() => reject(new ApiError(422,'The source could not be downloaded or timed out.')));
      req.end();
    });
    if ([301,302,303,307,308].includes(result.status)) {
      if (!result.location || redirects === 4) throw new ApiError(422,'The source redirects too many times.');
      current = new URL(result.location,url).href;
      continue;
    }
    return {data:result.data,url:url.href,type:result.type};
  }
  throw new ApiError(422,'This source could not be downloaded.');
}

export async function extractSource(raw: string, signal?: AbortSignal): Promise<SourceMaterial> {
  const {data,url,type} = await downloadSource(raw,signal);
  let title = new URL(url).hostname;
  let text = '';
  let kind: SourceMaterial['kind'] = 'url';
  if (type.includes('application/pdf') || data.subarray(0,5).toString() === '%PDF-') {
    kind = 'pdf';
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: false, disableFontFace: true });
    const doc = await loadingTask.promise;
    try {
      if (doc.numPages > 100) throw new ApiError(413,'PDF sources must contain at most 100 pages.');
      for (let i=1;i<=doc.numPages;i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => 'str' in item ? item.str : '').join(' ') + '\n\n';
        page.cleanup();
        if (text.length > 200_000) throw new ApiError(413,'Source text must contain at most 200,000 characters.');
      }
      const metadata = await doc.getMetadata();
      if (metadata.info && typeof metadata.info === 'object' && 'Title' in metadata.info && typeof metadata.info.Title === 'string') title = metadata.info.Title || title;
    } finally { await loadingTask.destroy(); }
  } else if (type.includes('text/html') || type.includes('application/xhtml+xml')) {
    const dom = new JSDOM(data.toString('utf8'),{url});
    try {
      const article = new Readability(dom.window.document,{ maxElemsToParse: 40_000 }).parse();
      title = article?.title || dom.window.document.title || title;
      text = article?.textContent?.trim() || '';
    } finally { dom.window.close(); }
  } else if (type.includes('text/plain')) text = data.toString('utf8').trim();
  else throw new ApiError(422,'Use a public article, plain text page, or PDF URL.');
  text = text.replace(/\u0000/g,'').trim();
  if (text.length > 200_000) throw new ApiError(413,'Source text must contain at most 200,000 characters.');
  if (text.length < 80) throw new ApiError(422,'There is not enough readable text here. Paste notes instead; scanned PDFs require OCR.');
  return { id: randomUUID(), title: title.slice(0,1000), text, url, kind, retrievedAt: new Date().toISOString() };
}
