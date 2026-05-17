export const PROVIDERS = ['slack', 'gmail', 'drive', 'notion', 'facebook'] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  redirectUri: string;
}

const baseRedirect = (provider: Provider) =>
  `${process.env.APP_URL ?? 'http://localhost:3001'}/api/integrations/${provider}/callback`;

export const configs: Record<Provider, () => OAuthConfig> = {
  slack: () => ({
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    scope: 'chat:write,channels:read',
    redirectUri: baseRedirect('slack'),
  }),
  gmail: () => ({
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? baseRedirect('gmail'),
  }),
  drive: () => ({
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    redirectUri: baseRedirect('drive'),
  }),
  notion: () => ({
    authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    clientId: process.env.NOTION_CLIENT_ID!,
    clientSecret: process.env.NOTION_CLIENT_SECRET!,
    scope: '',
    redirectUri: baseRedirect('notion'),
  }),
  facebook: () => ({
    authorizeUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    scope: 'email,public_profile',
    redirectUri: baseRedirect('facebook'),
  }),
};

export function authorizeUrl(provider: Provider, state: string): string {
  const c = configs[provider]();
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    state,
  });
  if (c.scope) params.set('scope', c.scope);
  if (provider === 'notion') params.set('owner', 'user');
  return `${c.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCode(provider: Provider, code: string): Promise<{ accessToken: string; refreshToken?: string }> {
  const c = configs[provider]();
  const body = new URLSearchParams({
    code,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(c.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(provider === 'notion'
        ? { Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}` }
        : {}),
    },
    body,
  });
  if (!res.ok) throw new Error(`${provider} token: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as Record<string, unknown>;
  const accessToken = (j.access_token as string) ?? (j.authed_user as { access_token?: string } | undefined)?.access_token ?? '';
  const refreshToken = j.refresh_token as string | undefined;
  if (!accessToken) throw new Error(`${provider} missing access_token`);
  return { accessToken, refreshToken };
}
