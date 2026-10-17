import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RankingClient, normalizePlayerName, formatRecordDate, RANKING_URL } from '../dist/game/ranking.js';
const storage = () => { const map = new Map(); return { get: (key,fallback) => map.get(key) ?? fallback, set: (key,value) => map.set(key,value) }; };
test('record dates always use Japan time, including midnight and year boundaries', () => {
  assert.equal(formatRecordDate('2026-10-17T09:25:10.000Z'), '2026/10/17 18:25');
  assert.equal(formatRecordDate('2026-10-17T15:00:00.000Z'), '2026/10/18 00:00');
  assert.equal(formatRecordDate('2026-12-31T23:59:00.000Z'), '2027/01/01 08:59');
  for (const missing of [null, undefined, '', '  ', 'not-a-date', '<script>', 0, {}]) assert.equal(formatRecordDate(missing), '');
});
test('a private random browser key persists, never appears in URLs, and requests omit cookies', async () => {
  const saved=storage(), calls=[];
  const fetcher=async (url,options)=>{ calls.push({url,options}); return Response.json({entries:[],personal:null}); };
  const client=new RankingClient(saved,fetcher), again=new RankingClient(saved,fetcher);
  assert.match(client.token,/^[a-f0-9]{64}$/); assert.equal(client.token,again.token);
  await client.load('easy');
  assert.equal(calls[0].url,RANKING_URL+'/api/leaderboard?difficulty=easy');
  assert.equal(calls[0].options.credentials,'omit'); assert.equal(calls[0].options.headers.Authorization,'Bearer '+client.token);
});
test('completed score uses its own run ticket; nickname is normalized and only saved after success', async () => {
  const saved=storage(), calls=[];
  const client=new RankingClient(saved,async (url,options)=>{ calls.push(JSON.parse(options.body)); return Response.json(url.endsWith('/runs')?{ticket:'first-ticket'}:{personal:{rank:1}}); });
  const run=client.begin('hard'); const result={run,level:3,xp:2,seconds:15};
  await client.submit(result,' りんご ヘビ ');
  assert.deepEqual(calls,[{difficulty:'hard'},{ticket:'first-ticket',name:'りんご ヘビ',level:3,xp:2,seconds:15}]);
  assert.equal(saved.get('snake-garden-nickname',''),'りんご ヘビ');
});
test('offline begin is handled without an unhandled rejection; registration surfaces failure and can retry',async()=>{
  const saved=storage(), client=new RankingClient(saved,async()=>{throw Error('offline');});
  const run=client.begin('normal'); assert.equal(await run.ready,null);
  await assert.rejects(client.submit({run,level:1,xp:1,seconds:2},'ヘビ'),/run_unavailable/);
  assert.equal(saved.get('snake-garden-nickname',''),'');
  const retry=new RankingClient(saved,async(url)=>Response.json(url.endsWith('/runs')?{ticket:'valid'}:{error:'unavailable'},{status:url.endsWith('/runs')?201:503}));
  const retryRun=retry.begin('easy'); await assert.rejects(retry.submit({run:retryRun,level:1,xp:0,seconds:1},'ヘビ'),/unavailable/);
});
test('nicknames accept short Japanese names and reject empty, oversized, control and HTML-like input',()=>{
  assert.equal(normalizePlayerName('  Ａヘビ  '),'Aヘビ'); assert.equal(normalizePlayerName('🍎'.repeat(12)),'🍎'.repeat(12));
  for(const name of ['', 'あ'.repeat(13), '<img>', 'ヘビ\u202e']) assert.equal(normalizePlayerName(name),null);
});
test('a rejected high-level result can be retried intact with its original ticket', async () => {
  const saved = storage(), requests = []; let attempts = 0;
  const client = new RankingClient(saved, async (url, options) => {
    if (url.endsWith('/runs')) return Response.json({ ticket: 'original-high-level-run' });
    requests.push(JSON.parse(options.body));
    return ++attempts === 1 ? Response.json({ error: 'invalid_score' }, { status: 400 }) : Response.json({ personal: { rank: 1, level: 99, xp: 200 } });
  });
  const result = { run: client.begin('hard'), level: 99, xp: 200, seconds: 120 };
  await assert.rejects(client.submit(result, 'ともも'), /invalid_score/);
  assert.equal(saved.get('snake-garden-nickname', ''), '');
  const board = await client.submit(result, 'ともも');
  assert.equal(board.personal.level, 99); assert.equal(result.level, 99); assert.equal(result.xp, 200);
  assert.deepEqual(requests, Array(2).fill({ ticket: 'original-high-level-run', name: 'ともも', level: 99, xp: 200, seconds: 120 }));
  assert.equal(saved.get('snake-garden-nickname', ''), 'ともも');
});
