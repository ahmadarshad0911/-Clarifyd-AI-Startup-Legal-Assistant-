// Facebook Graph API helpers.

export interface FacebookProfile {
  id: string;
  name?: string;
  email?: string;
}

export async function getFacebookProfile(token: string): Promise<FacebookProfile> {
  const res = await fetch(
    `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) throw new Error(`facebook /me ${res.status}: ${await res.text()}`);
  return res.json() as Promise<FacebookProfile>;
}

// Post to a Facebook Page (requires page-scoped token + pages_manage_posts scope).
// Used by deadline.fire when user connects a Page integration.
export async function postToPage(pageToken: string, pageId: string, message: string) {
  const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: pageToken }),
  });
  return res.json();
}
