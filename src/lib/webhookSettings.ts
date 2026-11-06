import { getServiceSupabase } from './supabaseAdmin';

export interface WebhookSettings {
  webhookUrl: string;
  testWebhookUrl: string;
  environment: 'test' | 'production';
  secret: string;
  source: 'database' | 'environment';
}

export async function getWebhookSettings(): Promise<WebhookSettings> {
  const fallbackSettings: WebhookSettings = {
    webhookUrl: process.env.N8N_WEBHOOK_URL || '',
    testWebhookUrl: process.env.N8N_WEBHOOK_TEST_URL || '',
    environment:
      process.env.N8N_ENVIRONMENT?.toLowerCase() === 'production' ? 'production' : 'test',
    secret: process.env.N8N_WEBHOOK_SECRET || '',
    source: 'environment',
  };

  const database = getServiceSupabase();
  if (!database) return fallbackSettings;

  const { data, error } = await database
    .from('integration_settings')
    .select('webhook_url, test_webhook_url, environment, webhook_secret')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load webhook settings from Supabase: ${error.message}`);
  }
  if (!data) return fallbackSettings;

  return {
    webhookUrl: data.webhook_url || fallbackSettings.webhookUrl,
    testWebhookUrl: data.test_webhook_url || fallbackSettings.testWebhookUrl,
    environment: data.environment || fallbackSettings.environment,
    secret: data.webhook_secret || fallbackSettings.secret,
    source: 'database',
  };
}

export function getActiveWebhookUrl(settings: WebhookSettings): string {
  return settings.environment === 'production'
    ? settings.webhookUrl
    : settings.testWebhookUrl || settings.webhookUrl;
}
