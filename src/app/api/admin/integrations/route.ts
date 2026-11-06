import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { getWebhookSettings } from '@/lib/webhookSettings';

function isAllowedWebhookUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !isIP(url.hostname) &&
      url.hostname !== 'localhost' &&
      !url.hostname.endsWith('.localhost') &&
      !url.hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

const settingsSchema = z.object({
  webhook_url: z.string().trim().refine(isAllowedWebhookUrl, 'Use an HTTPS webhook URL on a public hostname.'),
  test_webhook_url: z.string().trim().refine(isAllowedWebhookUrl, 'Use an HTTPS webhook URL on a public hostname.'),
  environment: z.enum(['test', 'production']),
  webhook_secret: z.string().max(500).optional(),
  clear_secret: z.boolean().optional(),
});

export async function GET() {
  const access = await requireSuperAdmin();
  if (!access.authorized) return access.response;

  try {
    const settings = await getWebhookSettings();
    return NextResponse.json({
      success: true,
      settings: {
        webhook_url: settings.webhookUrl,
        test_webhook_url: settings.testWebhookUrl,
        environment: settings.environment,
        secret_configured: Boolean(settings.secret),
        source: settings.source,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unable to load settings.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const access = await requireSuperAdmin();
  if (!access.authorized) return access.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Check the integration settings and try again.', errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data: current, error: readError } = await access.database
    .from('integration_settings')
    .select('webhook_secret')
    .eq('id', 1)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { success: false, message: 'Unable to read existing integration settings. Apply the integration migration first.' },
      { status: 500 }
    );
  }

  const secret = parsed.data.clear_secret
    ? null
    : parsed.data.webhook_secret?.trim() ||
      current?.webhook_secret ||
      process.env.N8N_WEBHOOK_SECRET ||
      null;

  const { error } = await access.database.from('integration_settings').upsert({
    id: 1,
    webhook_url: parsed.data.webhook_url || null,
    test_webhook_url: parsed.data.test_webhook_url || null,
    environment: parsed.data.environment,
    webhook_secret: secret,
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to save integration settings.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, secret_configured: Boolean(secret) });
}

export async function POST() {
  const access = await requireSuperAdmin();
  if (!access.authorized) return access.response;

  try {
    const { data, error } = await access.database
      .from('integration_settings')
      .select('webhook_url, test_webhook_url, environment, webhook_secret')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: 'Save webhook settings before testing the connection.' },
        { status: 400 }
      );
    }

    const webhookUrl =
      data.environment === 'production'
        ? data.webhook_url
        : data.test_webhook_url || data.webhook_url;
    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, message: 'No webhook URL is configured for the selected environment.' },
        { status: 400 }
      );
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          'x-voltedge-secret': data.webhook_secret || '',
          'x-voltedge-event': 'connection_test',
        },
        body: JSON.stringify({
          event: 'connection_test',
          source: 'voltedge-admin',
          sent_at: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      return NextResponse.json({
        success: response.ok,
        message: response.ok
          ? `Webhook responded with HTTP ${response.status}.`
          : `Webhook responded with HTTP ${response.status}. Check the n8n execution log.`,
      }, { status: response.ok ? 200 : 502 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error && error.name === 'AbortError'
            ? 'The webhook did not respond within 10 seconds.'
            : 'Could not reach the webhook. Check the URL and n8n status.',
      },
      { status: 502 }
    );
  }
}
