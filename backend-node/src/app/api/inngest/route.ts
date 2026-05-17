import { serve } from 'inngest/next';
import { functions, inngest } from '@/lib/inngest';

export const runtime = 'nodejs';
export const { GET, POST, PUT } = serve({ client: inngest, functions });
