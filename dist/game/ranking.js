export const RANKING_URL = 'https://gungun-snake-garden-ranking.loyal-wave-1919.chatgpt.site';
const recordDateFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function formatRecordDate(recordedAt) {
  if (typeof recordedAt !== 'string' || !recordedAt.trim()) return '';
  const date = new Date(recordedAt);
  return Number.isFinite(date.getTime()) ? recordDateFormatter.format(date) : '';
}
export function normalizePlayerName(value) {
  const name = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const length = [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(name)].length;
  return length > 0 && length <= 12 && name.length <= 64 && !/[\p{Cc}\p{Cf}<>]/u.test(name) ? name : null;
}
export class RankingClient {
  constructor(storage, fetcher = globalThis.fetch.bind(globalThis), baseUrl = RANKING_URL) {
    this.storage = storage; this.fetcher = fetcher; this.baseUrl = baseUrl;
    const saved = storage.get('snake-garden-player', '');
    this.token = /^[a-f0-9]{64}$/.test(saved) ? saved : [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
    storage.set('snake-garden-player', this.token);
  }
  async request(path, body, signal, method = body ? 'POST' : 'GET') {
    const timeout = AbortSignal.timeout(8000);
    const response = await this.fetcher(this.baseUrl + path, {
      method, mode: 'cors', credentials: 'omit',
      headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    let data; try { data = await response.json(); } catch { throw new Error('unavailable'); }
    if (!response.ok) throw new Error(data.error || 'unavailable');
    return data;
  }
  begin(difficulty) {
    const run = { difficulty, ticket: null };
    run.ready = this.request('/api/runs', { difficulty }).then(data => { run.ticket = data.ticket; return data.ticket; }).catch(() => null);
    return run;
  }
  load(difficulty, signal) { return this.request(`/api/leaderboard?difficulty=${encodeURIComponent(difficulty)}`, null, signal); }
  remove(difficulty) { return this.request(`/api/records?difficulty=${encodeURIComponent(difficulty)}`, null, null, 'DELETE'); }
  async submit(result, name) {
    const normalized = normalizePlayerName(name);
    if (!normalized) throw new Error('invalid_name');
    const ticket = await result.run.ready;
    if (!ticket) throw new Error('run_unavailable');
    const data = await this.request('/api/records', { ticket, name: normalized, level: result.level, xp: result.xp, seconds: result.seconds });
    this.storage.set('snake-garden-nickname', normalized);
    return data;
  }
}
