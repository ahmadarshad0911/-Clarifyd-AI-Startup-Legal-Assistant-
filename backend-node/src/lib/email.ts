import { Resend } from 'resend';

const client = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  return new Resend(key);
};

const FROM = () => process.env.RESEND_FROM ?? 'noreply@clarifyd.dev';

export async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  return client().emails.send({
    from: FROM(),
    to,
    subject,
    html,
    replyTo,
  });
}
