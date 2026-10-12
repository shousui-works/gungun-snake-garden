import { env } from 'cloudflare:workers';
import { handleRankingRequest } from '../../../lib/ranking-api';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  if (!env.DB) return Response.json({ error: 'unavailable' }, { status: 503 });
  return handleRankingRequest(request, env.DB);
}
export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
export const DELETE = handle;
