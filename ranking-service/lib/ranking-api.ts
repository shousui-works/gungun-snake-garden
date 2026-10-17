type Statement = { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> };
type Database = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> };
type Run = { owner: string; difficulty: string; started_at: number; used: number };
type RecordRow = { owner: string; name: string; level: number; xp: number; score: number; updated_at: number; rank: number };
const MODES = ['easy', 'normal', 'hard'];
const TOKEN = /^[a-f0-9]{64}$/;
const TICKET = /^[a-f0-9-]{36}$/;
const LIFETIME = 48 * 60 * 60 * 1000;
const GAME_ORIGINS = new Set(['https://shousui-works.github.io', 'https://game.ludora-base.com']);
class ApiError extends Error {
  status: number; code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
export const totalExperience = (level: number, xp: number) => (level - 1) * (level + 3) + xp;
export function normalizeNickname(value: unknown) {
  if (typeof value !== 'string') throw new ApiError(400, 'invalid_name');
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const length = [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(name)].length;
  if (!length || length > 12 || /[\p{Cc}\p{Cf}<>]/u.test(name) || name.length > 64) throw new ApiError(400, 'invalid_name');
  return name;
}
async function ownerFor(request: Request, required = true) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token && !required) return null;
  if (!token || !TOKEN.test(token)) throw new ApiError(401, 'invalid_player');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'json_required');
  if (Number(request.headers.get('content-length')) > 2048) throw new ApiError(413, 'too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_body');
  let size = 0, text = ''; const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new ApiError(413, 'too_large'); }
    text += decoder.decode(value, { stream: true });
  }
  try { const body = JSON.parse(text + decoder.decode()); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error(); return body; }
  catch { throw new ApiError(400, 'invalid_body'); }
}
function difficultyFor(value: unknown) {
  if (typeof value !== 'string' || !MODES.includes(value)) throw new ApiError(400, 'invalid_difficulty');
  return value;
}
function publicRecord(record: RecordRow, owner: string | null) {
  return { name: record.name, level: record.level, xp: record.xp, rank: record.rank, isYou: record.owner === owner, recordedAt: new Date(record.updated_at).toISOString() };
}
async function leaderboard(db: Database, difficulty: string, owner: string | null) {
  const rows = await db.prepare('SELECT owner, name, level, xp, score, updated_at, RANK() OVER (ORDER BY score DESC) AS rank FROM records WHERE difficulty = ? ORDER BY score DESC, updated_at ASC, id ASC LIMIT 20').bind(difficulty).all<RecordRow>();
  const mine = owner ? await db.prepare('SELECT owner, name, level, xp, score, updated_at, (SELECT COUNT(*) + 1 FROM records r WHERE r.difficulty = records.difficulty AND r.score > records.score) AS rank FROM records WHERE owner = ? AND difficulty = ?').bind(owner, difficulty).first<RecordRow>() : null;
  return { difficulty, entries: rows.results.map(row => publicRecord(row, owner)), personal: mine ? publicRecord(mine, owner) : null };
}
export async function handleRankingRequest(request: Request, db: Database, now = Date.now()) {
  const url = new URL(request.url), origin = request.headers.get('origin');
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
  const permitted = !origin || GAME_ORIGINS.has(origin) || origin === url.origin || (local && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin));
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  if (origin && permitted) headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  try {
    if (!permitted) throw new ApiError(403, 'origin_denied');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/api/leaderboard' && request.method === 'GET') return json(await leaderboard(db, difficultyFor(url.searchParams.get('difficulty')), await ownerFor(request, false)));
    if (url.pathname === '/api/records' && request.method === 'DELETE') {
      const owner = (await ownerFor(request))!, difficulty = difficultyFor(url.searchParams.get('difficulty'));
      await db.batch([db.prepare('DELETE FROM records WHERE owner = ? AND difficulty = ?').bind(owner, difficulty)]);
      return json(await leaderboard(db, difficulty, owner));
    }
    if (request.method !== 'POST') throw new ApiError(405, 'method_not_allowed');
    const owner = (await ownerFor(request))!;
    const body = await readBody(request);
    if (url.pathname === '/api/runs') {
      const difficulty = difficultyFor(body.difficulty);
      const count = await db.prepare('SELECT COUNT(*) AS count FROM runs WHERE owner = ? AND started_at > ?').bind(owner, now - 300000).first<{ count: number }>();
      if ((count?.count ?? 0) >= 20) throw new ApiError(429, 'too_many_runs');
      const ticket = crypto.randomUUID();
      await db.batch([
        db.prepare('DELETE FROM runs WHERE id IN (SELECT id FROM runs WHERE started_at < ? LIMIT 1000)').bind(now - LIFETIME),
        db.prepare('INSERT INTO runs (id, owner, difficulty, started_at) VALUES (?, ?, ?, ?)').bind(ticket, owner, difficulty, now),
      ]);
      return json({ ticket }, 201);
    }
    if (url.pathname === '/api/records') {
      if (typeof body.ticket !== 'string' || !TICKET.test(body.ticket)) throw new ApiError(400, 'invalid_ticket');
      const run = await db.prepare('SELECT owner, difficulty, started_at, used FROM runs WHERE id = ?').bind(body.ticket).first<Run>();
      if (!run || run.owner !== owner) throw new ApiError(403, 'invalid_ticket');
      if (run.used) return json(await leaderboard(db, run.difficulty, owner));
      if (now - run.started_at > LIFETIME) throw new ApiError(410, 'expired_run');
      const name = normalizeNickname(body.name), { level, xp, seconds } = body;
      if (!Number.isSafeInteger(level) || level < 1 || level > 100 || !Number.isSafeInteger(xp) || xp < 0 || xp >= 5 + 2 * (level - 1) || !Number.isFinite(seconds) || seconds < 0 || seconds * 1000 > now - run.started_at + 10000) throw new ApiError(400, 'invalid_score');
      const score = totalExperience(level, xp);
      if (score > 50 + seconds * 20) throw new ApiError(400, 'invalid_score');
      // A conditional insert and ticket consumption share one D1 transaction.
      await db.batch([
        db.prepare(`INSERT INTO records (id, owner, difficulty, name, level, xp, score, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM runs WHERE id = ? AND owner = ? AND used = 0)
          ON CONFLICT (owner, difficulty) DO UPDATE SET name = excluded.name,
          level = CASE WHEN excluded.score > records.score THEN excluded.level ELSE records.level END,
          xp = CASE WHEN excluded.score > records.score THEN excluded.xp ELSE records.xp END,
          updated_at = CASE WHEN excluded.score > records.score THEN excluded.updated_at ELSE records.updated_at END,
          score = MAX(records.score, excluded.score)`).bind(`${owner}:${run.difficulty}`, owner, run.difficulty, name, level, xp, score, now, body.ticket, owner),
        db.prepare('UPDATE runs SET used = 1 WHERE id = ? AND owner = ? AND used = 0').bind(body.ticket, owner),
      ]);
      return json(await leaderboard(db, run.difficulty, owner));
    }
    throw new ApiError(404, 'not_found');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.code }, error.status);
    console.error('Ranking request failed');
    return json({ error: 'unavailable' }, 503);
  }
}
