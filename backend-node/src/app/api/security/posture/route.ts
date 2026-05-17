export const runtime = 'nodejs';

// Static posture snapshot used by frontend TrustStrip.
// Update as certs land.
export async function GET() {
  return Response.json({
    encryptionAtRest: { algorithm: 'AES-256', status: 'active' },
    encryptionInTransit: { algorithm: 'TLS 1.3', status: 'active' },
    zeroTraining: { status: 'active', header: 'X-Kimi-Train: false' },
    hashChainAudit: { status: 'active' },
    soc2: { status: 'in-progress', type: 'Type II', target: '2027-Q2' },
    iso27001: { status: 'planned' },
    gdpr: { status: 'aligned' },
    attorneyClientPrivilege: { status: 'enterprise-only' },
  });
}
