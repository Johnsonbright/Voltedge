import { NextRequest, NextResponse } from 'next/server';
import { orderSubmissionPayloadSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rateLimit';
import { processOrderLocally } from '@/lib/orderSimulator';
import { WebhookResponse } from '@/types';

export async function POST(req: NextRequest) {
  // 1. Rate Limiting Check (by client IP)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const rateLimitResult = checkRateLimit(ip, 12, 60000); // 12 requests per minute max

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        outcome: 'REJECTED_INCOMPLETE',
        message: 'Too many order requests submitted. Please wait a moment before trying again.',
        errors: ['Rate limit exceeded. Try again in 60 seconds.'],
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)),
        },
      }
    );
  }

  // 2. Parse and Validate Request Body with Zod
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        outcome: 'REJECTED_INCOMPLETE',
        message: 'Invalid JSON request payload.',
        errors: ['Malformed JSON body'],
      },
      { status: 400 }
    );
  }

  const validationResult = orderSubmissionPayloadSchema.safeParse(bodyJson);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );

    return NextResponse.json(
      {
        success: false,
        outcome: 'REJECTED_INCOMPLETE',
        message: 'Order submission validation failed. Please check customer and item fields.',
        errors: errorDetails,
      },
      { status: 400 }
    );
  }

  const payload = validationResult.data;

  // 3. Determine webhook target URL and environment
  const n8nEnv = (process.env.N8N_ENVIRONMENT || 'test').toLowerCase();
  const webhookUrl =
    n8nEnv === 'production'
      ? process.env.N8N_WEBHOOK_URL
      : process.env.N8N_WEBHOOK_TEST_URL || process.env.N8N_WEBHOOK_URL;

  const webhookSecret = process.env.N8N_WEBHOOK_SECRET || '';
  const enableMock =
    process.env.ENABLE_MOCK_WEBHOOK === 'true' ||
    !webhookUrl ||
    webhookUrl.includes('your-n8n-instance');

  // 4. If mock simulation is active (dev mode or before user connects remote n8n)
  if (enableMock) {
    try {
      const simulatedResponse = await processOrderLocally(payload);
      return NextResponse.json(simulatedResponse, { status: 200 });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown simulation error';
      return NextResponse.json(
        {
          success: false,
          outcome: 'REJECTED_INCOMPLETE',
          message: 'Error processing order locally in mock mode.',
          errors: [errorMsg],
        },
        { status: 500 }
      );
    }
  }

  // 5. Production Forwarding to n8n Webhook
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second abort timeout

    const upstreamResponse = await fetch(webhookUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-voltedge-secret': webhookSecret,
        'x-idempotency-key': payload.idempotency_key,
        'User-Agent': 'VoltEdge-Storefront/1.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // If n8n returned non-2xx
    if (!upstreamResponse.ok) {
      const upstreamText = await upstreamResponse.text();
      return NextResponse.json(
        {
          success: false,
          outcome: null,
          message:
            'Order intake engine returned a temporary error. Your cart is preserved and no payment has been requested. Please retry with your submission key.',
          errors: [`Upstream n8n error: ${upstreamResponse.status} ${upstreamText}`],
          retryable: true,
          idempotency_key: payload.idempotency_key,
        },
        { status: 502 }
      );
    }

    const responseData = (await upstreamResponse.json()) as WebhookResponse;
    return NextResponse.json(responseData, { status: 200 });
  } catch (error: unknown) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('aborted'));

    return NextResponse.json(
      {
        success: false,
        outcome: null,
        message: isTimeout
          ? 'The order intake server timed out while processing. Your cart remains intact and no payment was initiated. Please try submitting again.'
          : 'Unable to reach the order intake service. Your cart has been preserved. Please check your connection and retry.',
        errors: [
          isTimeout ? 'Request timed out after 12 seconds' : 'Network/service unreachable',
        ],
        retryable: true,
        idempotency_key: payload.idempotency_key,
      },
      { status: 504 }
    );
  }
}
