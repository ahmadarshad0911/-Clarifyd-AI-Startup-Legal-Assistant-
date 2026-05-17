import { sql } from 'drizzle-orm';
import {
  bigserial, boolean, customType, index, integer, jsonb,
  numeric, pgTable, primaryKey, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';

// citext custom type (kept for future use; DrizzleAdapter requires plain text for users.email)
const _citext = customType<{ data: string }>({ dataType: () => 'citext' });
// bytea for encrypted blobs
const bytea = customType<{ data: Buffer; notNull: false }>({ dataType: () => 'bytea' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // Auth.js DrizzleAdapter-required columns
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  // Clarifyd app
  plan: text('plan').notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const userContext = pgTable('user_context', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  jurisdiction: text('jurisdiction').notNull().default('US'),
  stage: text('stage').notNull().default('seed'),
  role: text('role').notNull().default('founder'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const contracts = pgTable(
  'contracts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    blobUrl: text('blob_url').notNull().default(''),
    fileBytes: bytea('file_bytes'),
    sha256: text('sha256').notNull(),
    docType: text('doc_type'),
    docTypeConf: numeric('doc_type_conf', { precision: 3, scale: 2 }),
    wordCount: integer('word_count'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    userCreated: index('contracts_user_created_idx').on(t.userId, t.createdAt),
    lastAccess: index('contracts_last_access_idx').on(t.lastAccessedAt),
  }),
);

export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'), // queued|running|done|error
  healthScore: integer('health_score'),
  criticalN: integer('critical_n').default(0),
  highN: integer('high_n').default(0),
  mediumN: integer('medium_n').default(0),
  cleanN: integer('clean_n').default(0),
  durationMs: integer('duration_ms'),
  model: text('model').default('kimi-k2'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const findings = pgTable(
  'findings',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    scanId: uuid('scan_id').references(() => scans.id, { onDelete: 'cascade' }),
    clauseId: text('clause_id').notNull(),
    severity: text('severity').notNull(),
    score: numeric('score', { precision: 3, scale: 1 }),
    confidence: numeric('confidence', { precision: 3, scale: 2 }),
    originalText: text('original_text').notNull(),
    rewriteText: text('rewrite_text'),
    rationale: text('rationale'),
    userDecision: text('user_decision'), // null|accepted|rejected|edited
    userEdit: text('user_edit'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => ({ scanSeverity: index('findings_scan_severity_idx').on(t.scanId, t.severity) }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    scanId: uuid('scan_id').references(() => scans.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    prevHash: text('prev_hash').notNull(),
    thisHash: text('this_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ scanOrder: index('audit_scan_id_idx').on(t.scanId, t.id) }),
);

export const consentEvents = pgTable('consent_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  ipHash: text('ip_hash'),
  choice: text('choice').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Auth.js required tables (Drizzle adapter)
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (a) => ({ pk: primaryKey({ columns: [a.provider, a.providerAccountId] }) }),
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);

// Deferred tables (Week 1+ scaffolding — defined here so future migrations are diffs only)
export const integrations = pgTable(
  'integrations',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    accessToken: bytea('access_token').notNull(),
    refreshToken: bytea('refresh_token'),
    config: jsonb('config'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.provider] }) }),
);

export const deadlines = pgTable(
  'deadlines',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    label: text('label').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    status: text('status').default('active'),
    snoozeUntil: timestamp('snooze_until', { withTimezone: true }),
  },
  (t) => ({ userActive: index('deadlines_user_status_due_idx').on(t.userId, t.status, t.dueAt) }),
);

export const lawyers = pgTable('lawyers', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  firm: text('firm'),
  email: text('email'),
  jurisdictions: text('jurisdictions').array().notNull(),
  flatFeeUsd: integer('flat_fee_usd'),
  hourlyUsd: integer('hourly_usd'),
  avatarUrl: text('avatar_url'),
  active: boolean('active').default(true),
});

export const lawyerHandoffs = pgTable('lawyer_handoffs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id),
  lawyerId: uuid('lawyer_id').references(() => lawyers.id),
  scanId: uuid('scan_id').references(() => scans.id),
  signedPayload: jsonb('signed_payload').notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
});

// Cross-contract Q&A embeddings (pgvector). nv-embedqa-e5-v5 = 1024 dims.
const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => 'vector(1024)',
  toDriver: (v) => `[${v.join(',')}]`,
});

export const scanEmbeddings = pgTable(
  'scan_embeddings',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    scanId: uuid('scan_id').references(() => scans.id, { onDelete: 'cascade' }),
    chunk: text('chunk').notNull(),
    embedding: vector('embedding'),
    metadata: jsonb('metadata'),
  },
  (t) => ({ userScan: index('embed_user_scan_idx').on(t.userId, t.scanId) }),
);

export const regulationSnapshots = pgTable('regulation_snapshots', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  source: text('source').notNull(),                       // ftc|sec|...
  feedUrl: text('feed_url').notNull(),
  itemId: text('item_id').notNull(),
  title: text('title').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow(),
  payload: jsonb('payload'),
});

export const weeklyDigestState = pgTable('weekly_digest_state', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  enabled: boolean('enabled').default(true),
});

export const playbookClauses = pgTable(
  'playbook_clauses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    corpus: text('corpus').notNull(),
    docType: text('doc_type').notNull(),
    clauseId: text('clause_id').notNull(),
    text: text('text').notNull(),
    medianValue: text('median_value'),
    p25Value: text('p25_value'),
    p75Value: text('p75_value'),
    sampleSize: integer('sample_size'),
  },
  (t) => ({ corpusDocClause: index('playbook_corpus_doc_clause_idx').on(t.corpus, t.docType, t.clauseId) }),
);
