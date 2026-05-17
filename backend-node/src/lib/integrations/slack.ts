// Slack send helper used by deadline.fire + critical-finding notify.
export async function postToSlack(token: string, channel: string, text: string) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, text }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}
