// Lightweight PII tokenizer for counter-proposal templates.
// Pulls vendor name from filename + contract metadata; founder from session email.
// Never sends names to the model — only used for outbound email rendering.

export interface Tokens {
  founder: string;
  founderEmail: string;
  company: string;
  vendor: string;
  vendorEmail: string;
}

export function extractTokens(args: {
  userEmail: string;
  filename: string;
  docType?: string | null;
}): Tokens {
  const founderEmail = args.userEmail;
  const founder = titleCase(founderEmail.split('@')[0].replace(/[._-]+/g, ' '));
  const company = titleCase(founderEmail.split('@')[1]?.split('.')[0] ?? '');

  // Vendor: try to parse "VendorName_SAFE_v3.pdf" or "VENDOR_SAFE.docx" patterns.
  const base = args.filename
    .replace(/\.(pdf|docx|doc)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(safe|nda|msa|term ?sheet|agreement|contract|v\d+|final|draft)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const vendor = base ? titleCase(base) : 'Counterparty';
  const vendorEmail = 'counsel@example.com';

  return { founder, founderEmail, company, vendor, vendorEmail };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
