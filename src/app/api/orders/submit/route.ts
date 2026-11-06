import { NextRequest, NextResponse } from 'next/server';
import { n8nWebhookReplySchema, orderSubmissionPayloadSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rateLimit';
import { WebhookResponse } from '@/types';
import { getActiveWebhookUrl, getWebhookSettings, type WebhookSettings } from '@/lib/webhookSettings';
import { getProductById } from '@/lib/products';
import { requireAuthenticatedUser } from '@/lib/adminAuth';

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

  const auth = await requireAuthenticatedUser();
  if (!auth.authorized) return auth.response;

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

  const submittedPayload = validationResult.data;
  let authoritativeItems;
  try {
    authoritativeItems = await Promise.all(
      submittedPayload.items.map(async (item) => {
        const product = await getProductById(item.product_id);
        if (!product) {
          throw new Error(`Product "${item.product_id}" is no longer available.`);
        }
        return {
          ...item,
          name: product.name,
          stock_quantity: product.stock_quantity,
          unit_price_client_submitted: item.unit_price_displayed,
          unit_price_displayed: product.price,
        };
      })
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        outcome: 'REJECTED_INCOMPLETE',
        message: 'One or more products are unavailable or could not be verified.',
        errors: [error instanceof Error ? error.message : 'Product verification failed.'],
      },
      { status: 409 }
    );
  }
  const overStockItems = authoritativeItems.filter(
    (item) => item.quantity > item.stock_quantity
  );
  if (overStockItems.length > 0) {
    return NextResponse.json(
      {
        success: false,
        outcome: 'REJECTED_INCOMPLETE',
        message: 'One or more requested quantities exceed current stock. Update your cart before submitting.',
        errors: overStockItems.map(
          (item) => `${item.name}: requested ${item.quantity}, available ${item.stock_quantity}.`
        ),
      },
      { status: 409 }
    );
  }
  const payload = {
    ...submittedPayload,
    delivery: {
      address: submittedPayload.delivery.address || undefined,
      notes: submittedPayload.delivery.notes || undefined,
    },
    items: authoritativeItems,
    user_id: auth.user.id,
  };

  let webhookSettings: WebhookSettings;
  try {
    webhookSettings = await getWebhookSettings();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        outcome: 'REJECTED_INCOMPLETE',
        message: 'Order intake configuration is unavailable. Please try again later.',
        errors: [error instanceof Error ? error.message : 'Unable to load webhook settings.'],
      },
      { status: 500 }
    );
  }

  const webhookUrl = getActiveWebhookUrl(webhookSettings);
  const webhookSecret = webhookSettings.secret;
  if (!webhookUrl || webhookUrl.includes('your-n8n-instance')) {
    return NextResponse.json(
      {
        success: false,
        outcome: null,
        error_code: 'N8N_NOT_CONFIGURED',
        message: 'Order submission is unavailable because the n8n webhook is not configured. Please try again later.',
        errors: ['Configure an n8n webhook URL before accepting orders.'],
        retryable: false,
        idempotency_key: payload.idempotency_key,
      },
      { status: 503 }
    );
  }

  // Forward the validated order to the configured n8n webhook.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second abort timeout
  try {
    const upstreamResponse = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        'x-voltedge-secret': webhookSecret,
        'x-idempotency-key': payload.idempotency_key,
        'User-Agent': 'VoltEdge-Storefront/1.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // If n8n returned non-2xx
    if (!upstreamResponse.ok) {
      console.error('n8n returned a non-success HTTP status', {
        idempotency_key: payload.idempotency_key,
        status: upstreamResponse.status,
      });
      return NextResponse.json(
        {
          success: false,
          outcome: null,
          error_code: 'N8N_HTTP_ERROR',
          message: `n8n returned HTTP ${upstreamResponse.status}. Your order status may be unknown; retry using the same submission key.`,
          errors: [`n8n returned HTTP ${upstreamResponse.status}.`],
          retryable: true,
          idempotency_key: payload.idempotency_key,
        },
        { status: 502 }
      );
    }

    let responseText: string;
    try {
      responseText = await upstreamResponse.text();
    } catch (error) {
      if (controller.signal.aborted) throw error;

      console.error('Unable to read n8n response body', {
        idempotency_key: payload.idempotency_key,
        error: error instanceof Error ? error.name : 'unknown',
      });
      return NextResponse.json(
        {
          success: false,
          outcome: null,
          error_code: 'N8N_UNREACHABLE',
          message: 'The connection to n8n was interrupted while reading its reply. Your order status may be unknown; retry using the same submission key.',
          errors: ['The n8n response body could not be read.'],
          retryable: true,
          idempotency_key: payload.idempotency_key,
        },
        { status: 502 }
      );
    }

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error('n8n returned a response that was not valid JSON', {
        idempotency_key: payload.idempotency_key,
      });
      return NextResponse.json(
        {
          success: false,
          outcome: null,
          error_code: 'N8N_INVALID_REPLY',
          message: 'n8n returned a reply that failed validation. Your order status may be unknown; retry only with the same submission key.',
          errors: ['The n8n response body was not valid JSON.'],
          retryable: true,
          idempotency_key: payload.idempotency_key,
        },
        { status: 502 }
      );
    }

    const parsedReply = n8nWebhookReplySchema.safeParse(responseData);
    if (!parsedReply.success) {
      console.error('n8n reply failed contract validation', {
        idempotency_key: payload.idempotency_key,
        issues: parsedReply.error.issues.map(({ code, path, message }) => ({
          code,
          path: path.join('.'),
          message,
        })),
      });
      return NextResponse.json(
        {
          success: false,
          outcome: null,
          error_code: 'N8N_INVALID_REPLY',
          message: 'n8n returned a reply that failed validation. Your order status may be unknown; retry only with the same submission key.',
          errors: ['The n8n reply did not match the documented response schema.'],
          retryable: true,
          idempotency_key: payload.idempotency_key,
        },
        { status: 502 }
      );
    }

    const n8nReply = parsedReply.data;
    if (!n8nReply.success) {
      return NextResponse.json(
        {
          ...n8nReply,
          idempotency_key: payload.idempotency_key,
          retryable: false,
        },
        { status: 422 }
      );
    }

    const normalizedResponse: WebhookResponse = {
      ...n8nReply,
    };
    return NextResponse.json(normalizedResponse, { status: 200 });
  } catch (error: unknown) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('aborted'));
    console.error('Unable to reach n8n order webhook', {
      idempotency_key: payload.idempotency_key,
      error: isTimeout ? 'timeout' : error instanceof Error ? error.name : 'unknown',
    });

    return NextResponse.json(
      {
        success: false,
        outcome: null,
        error_code: 'N8N_UNREACHABLE',
        message: isTimeout
          ? 'n8n did not respond within 12 seconds. Your order status may be unknown; retry using the same submission key.'
          : 'n8n is unreachable. Your order status may be unknown; retry using the same submission key.',
        errors: [
          isTimeout ? 'n8n request timed out after 12 seconds.' : 'The connection to n8n could not be completed.',
        ],
        retryable: true,
        idempotency_key: payload.idempotency_key,
      },
      { status: isTimeout ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
