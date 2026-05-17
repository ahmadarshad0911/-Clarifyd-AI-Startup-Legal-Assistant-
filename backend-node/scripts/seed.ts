// Load env BEFORE any db import so @vercel/postgres sees POSTGRES_URL.
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: true });

const main = async () => {
  const { db, schema } = await import('../src/db');

  const [u] = await db
    .insert(schema.users)
    .values({ email: 'demo@clarifyd.dev', plan: 'pro' })
    .onConflictDoNothing()
    .returning({ id: schema.users.id });
  console.log('user', u?.id ?? '(exists)');

  // Lawyers — 5 jurisdictions × 1-3 each. Replace placeholder emails before prod.
  const lawyers = [
    { name: 'Maya Okonkwo',  firm: 'Okonkwo Law',          email: 'maya@okonkwo.example',     jurisdictions: ['US'],       flatFeeUsd: 250 },
    { name: 'Daniel Ramirez',firm: 'Ramirez Ventures',     email: 'dan@ramirezvc.example',    jurisdictions: ['US'],       flatFeeUsd: 300 },
    { name: 'Priya Iyer',    firm: 'Iyer Legal',           email: 'priya@iyerlegal.example',  jurisdictions: ['US','IN'],  flatFeeUsd: 220 },
    { name: 'Owen Tindall',  firm: 'Tindall & Co.',        email: 'owen@tindallco.example',   jurisdictions: ['UK'],       flatFeeUsd: 290 },
    { name: 'Lena Faber',    firm: 'Faber Berlin',         email: 'lena@faberberlin.example', jurisdictions: ['EU'],       flatFeeUsd: 270 },
    { name: 'Wei Tan',       firm: 'Tan Chambers',         email: 'wei@tanchambers.example',  jurisdictions: ['SG'],       flatFeeUsd: 310 },
    { name: 'Hannah Gold',   firm: 'Gold Startup Counsel', email: 'hannah@goldlegal.example', jurisdictions: ['US'],       flatFeeUsd: 280 },
  ];
  for (const l of lawyers) await db.insert(schema.lawyers).values(l).onConflictDoNothing();
  console.log('lawyers seeded:', lawyers.length);

  // Playbook clauses — YC W26 SAFE + UK NDA + EU MSA baselines
  const playbook = [
    // YC W26 SAFE
    { corpus: 'yc-w26', docType: 'SAFE', clauseId: 'LIABILITY_CAP',    text: 'Aggregate liability shall not exceed greater of fees paid in prior 12 months or $50,000.', medianValue: '$50,000 or 12mo fees', p25Value: '$25,000',  p75Value: '$100,000', sampleSize: 1247 },
    { corpus: 'yc-w26', docType: 'SAFE', clauseId: 'IP_ASSIGNMENT',    text: 'Founder assigns work product made for Company; pre-existing IP retained.',                  medianValue: 'work-product only',    p25Value: 'work-product only', p75Value: 'work-product + improvements', sampleSize: 1247 },
    { corpus: 'yc-w26', docType: 'SAFE', clauseId: 'NON_COMPETE',      text: '12 months, defined geographic scope.',                                                     medianValue: '12mo / state',         p25Value: '6mo / state',  p75Value: '18mo / multi-state', sampleSize: 1247 },
    { corpus: 'yc-w26', docType: 'SAFE', clauseId: 'INDEMNITY',        text: 'Indemnification capped at consideration paid, excluding fraud or willful misconduct.',     medianValue: 'cap = consideration',  p25Value: 'mutual carve-out', p75Value: 'no cap on IP claims', sampleSize: 1247 },
    { corpus: 'yc-w26', docType: 'SAFE', clauseId: 'GOVERNING_LAW',    text: 'Delaware law, Delaware courts (exclusive).',                                               medianValue: 'Delaware',             p25Value: 'Delaware',     p75Value: 'Delaware', sampleSize: 1247 },
    { corpus: 'yc-w26', docType: 'SAFE', clauseId: 'CHANGE_OF_CONTROL', text: 'Single trigger acceleration for founders on involuntary termination after change of control.', medianValue: 'double-trigger',  p25Value: 'single-trigger 25%', p75Value: 'double-trigger 100%', sampleSize: 1247 },

    // UK Standard NDA
    { corpus: 'uk-standard', docType: 'NDA', clauseId: 'CONFIDENTIALITY', text: 'Confidentiality obligations survive for 3 years post-termination.', medianValue: '3 years', p25Value: '2 years', p75Value: '5 years', sampleSize: 412 },
    { corpus: 'uk-standard', docType: 'NDA', clauseId: 'GOVERNING_LAW',   text: 'Laws of England and Wales; English courts.',                       medianValue: 'England & Wales', p25Value: 'England & Wales', p75Value: 'England & Wales', sampleSize: 412 },

    // EU vendor MSA baseline
    { corpus: 'eu-standard', docType: 'MSA', clauseId: 'LIABILITY_CAP', text: 'Liability capped at 12 months of fees paid, GDPR fines excluded from cap.', medianValue: '12mo fees', p25Value: '6mo fees', p75Value: 'unlimited for breach', sampleSize: 587 },
    { corpus: 'eu-standard', docType: 'MSA', clauseId: 'PAYMENT_TERMS',  text: 'Net 30 from invoice date; 1.5% monthly interest on late payment.',                       medianValue: 'Net 30',                p25Value: 'Net 15',       p75Value: 'Net 60', sampleSize: 587 },
  ];
  for (const p of playbook) await db.insert(schema.playbookClauses).values(p).onConflictDoNothing();
  console.log('playbook seeded:', playbook.length);

  console.log('seed complete');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
