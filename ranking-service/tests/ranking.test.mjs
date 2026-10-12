import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleRankingRequest, totalExperience } from '../lib/ranking-api.ts';
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_sticky_rafael_vega.sql', import.meta.url), 'utf8'));
  return {
    sqlite,
    prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; }, async first() { return sqlite.prepare(sql).get(...this.values) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...this.values) }; } }; },
    async batch(statements) { sqlite.exec('BEGIN'); try { const rows = statements.map(s => sqlite.prepare(s.sql).run(...s.values)); sqlite.exec('COMMIT'); return rows; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
}
const playerA = 'a'.repeat(64), playerB = 'b'.repeat(64);
function request(path, token = playerA, body, origin = 'https://shousui-works.github.io') {
  return new Request('https://ranking.example' + path, { method: body ? 'POST' : 'GET', headers: { Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function begin(db, token = playerA, difficulty = 'normal', now = 10000) {
  const response = await handleRankingRequest(request('/api/runs', token, { difficulty }), db, now); assert.equal(response.status, 201); return (await response.json()).ticket;
}
async function submit(db, token, ticket, level, xp, name = 'りんごヘビ', now = 20000) {
  return handleRankingRequest(request('/api/records', token, { ticket, level, xp, name, seconds: 5 }), db, now);
}
test('level and carried XP sort fairly; equal scores share a rank, modes stay separate', async () => {
  const db = database();
  const first = await begin(db); assert.equal((await submit(db, playerA, first, 2, 3)).status, 200);
  const second = await begin(db, playerB); await submit(db, playerB, second, 3, 0, 'ぶどうヘビ');
  const board = await (await handleRankingRequest(request('/api/leaderboard?difficulty=normal', playerA), db)).json();
  assert.deepEqual(board.entries.map(row => [row.rank, row.level, row.xp, row.isYou]), [[1, 3, 0, false], [2, 2, 3, true]]);
  const equal = await begin(db); await submit(db, playerA, equal, 3, 0);
  const tied = await (await handleRankingRequest(request('/api/leaderboard?difficulty=normal', null), db)).json();
  assert.deepEqual(tied.entries.map(row => row.rank), [1, 1]);
  assert.equal(JSON.stringify(tied).includes('owner'), false);
  const easy = await (await handleRankingRequest(request('/api/leaderboard?difficulty=easy'), db)).json(); assert.equal(easy.entries.length, 0);
  assert.equal(totalExperience(3, 0), 12);
});
test('each browser keeps one best per mode and retries cannot change a consumed run', async () => {
  const db = database(), ticket = await begin(db); await submit(db, playerA, ticket, 4, 2);
  await submit(db, playerA, ticket, 10, 1, '不正な上書き');
  const worse = await begin(db); await submit(db, playerA, worse, 1, 0, 'バナナヘビ');
  const board = await (await handleRankingRequest(request('/api/leaderboard?difficulty=normal'), db)).json();
  assert.equal(board.entries.length, 1); assert.equal(board.personal.level, 4); assert.equal(board.personal.xp, 2); assert.equal(board.personal.name, 'バナナヘビ');
});
test('writes require the run owner, valid score, bounded nickname and unexpired ticket', async () => {
  const db = database(), ticket = await begin(db);
  assert.equal((await submit(db, playerB, ticket, 1, 0)).status, 403);
  for (const [level, xp, name] of [[-1,0,'ヘビ'], [2,7,'ヘビ'], [2,0,''], [2,0,'<script>'], [2,0,'あ'.repeat(13)], [100,0,'ヘビ']]) assert.equal((await submit(db, playerA, ticket, level, xp, name)).status, 400);
  assert.equal((await submit(db, playerA, ticket, 1, 0, 'ヘビ', 10000 + 49*3600000)).status, 410);
  assert.equal((await handleRankingRequest(request('/api/runs', null, {difficulty:'normal'}), db)).status, 401);
});
test('cross-origin preflight permits game and rejects other sites; large bodies and spam are bounded', async () => {
  const db = database();
  const preflight = await handleRankingRequest(new Request('https://ranking.example/api/records', { method:'OPTIONS', headers:{Origin:'https://shousui-works.github.io'} }), db);
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://shousui-works.github.io');
  assert.equal((await handleRankingRequest(request('/api/runs', playerA, {difficulty:'normal'}, 'https://other.example'), db)).status, 403);
  assert.equal((await handleRankingRequest(request('/api/runs', playerA, {difficulty:'x'.repeat(3000)}), db)).status, 413);
  for (let i=0;i<20;i++) await begin(db);
  assert.equal((await handleRankingRequest(request('/api/runs', playerA, {difficulty:'normal'}), db, 10001)).status, 429);
});
test('top 20 is bounded while personal rank remains visible outside that list', async () => {
  const db=database();
  for(let i=0;i<22;i++) { const token=i.toString(16).padStart(64,'0'), ticket=await begin(db,token); await submit(db,token,ticket,1+Math.floor(i/5),i%5,'ヘビ'+i); }
  const board=await (await handleRankingRequest(request('/api/leaderboard?difficulty=normal', '0'.repeat(64)),db)).json();
  assert.equal(board.entries.length,20); assert.equal(board.personal.rank,22); assert.equal(board.entries.some(row=>row.isYou),false);
});

test('deleting a personal record cannot remove another browser or another difficulty', async()=>{
  const db=database();
  await submit(db,playerA,await begin(db),2,0);
  await submit(db,playerB,await begin(db,playerB),2,0);
  await submit(db,playerA,await begin(db,playerA,'easy'),2,0);
  const response=await handleRankingRequest(new Request('https://ranking.example/api/records?difficulty=normal',{method:'DELETE',headers:{Origin:'https://shousui-works.github.io',Authorization:'Bearer '+playerA}}),db);
  const board=await response.json(); assert.equal(response.status,200); assert.equal(board.entries.length,1); assert.equal(board.personal,null);
  const easy=await (await handleRankingRequest(request('/api/leaderboard?difficulty=easy'),db)).json(); assert.equal(easy.personal.level,2);
});
