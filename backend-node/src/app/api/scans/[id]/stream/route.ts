import { and, asc, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// SSE — replays audit events for a scan and tails new ones until status=done|error.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  // Ownership check
  const [own] = await db
    .select({ contractUserId: schema.contracts.userId })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(eq(schema.scans.id, id));
  if (!own || own.contractUserId !== user.id) return new Response('not found', { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastId = 0;
      const tick = async () => {
        const events = await db
          .select()
          .from(schema.auditLog)
          .where(and(eq(schema.auditLog.scanId, id), gt(schema.auditLog.id, lastId)))
          .orderBy(asc(schema.auditLog.id));
        for (const e of events) {
          lastId = e.id;
          controller.enqueue(encoder.encode(`event: ${e.eventType}\ndata: ${JSON.stringify(e.payload)}\n\n`));
          if (e.eventType === 'scan_done' || e.eventType === 'scan_error') {
            controller.close();
            return true;
          }
        }
        return false;
      };
      const interval = setInterval(async () => {
        try {
          const done = await tick();
          if (done) clearInterval(interval);
        } catch (err) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`));
          clearInterval(interval);
          controller.close();
        }
      }, 500);
      // Initial flush
      await tick();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
