export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({
    runtime: process.versions?.node ? 'nodejs' : 'edge',
    region: process.env.VERCEL_REGION,
    now: Date.now()
  });
}
