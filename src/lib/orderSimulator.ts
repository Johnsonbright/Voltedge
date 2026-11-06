import { OrderSubmissionPayload, WebhookResponse, OrderRecord } from '@/types';
import { getProductById } from './products';
import { PROMO_THRESHOLD, PROMO_PERCENTAGE } from './formatters';
import { getServiceSupabase } from './supabaseAdmin';

// In-memory cache for idempotency and orders fallback when Supabase isn't connected
const processedOrders = new Map<string, { response: WebhookResponse; order: OrderRecord }>();

export async function processOrderLocally(
  payload: OrderSubmissionPayload
): Promise<WebhookResponse> {
  const { idempotency_key, customer, delivery, items } = payload;

  // 1. Check idempotency for duplicates
  if (processedOrders.has(idempotency_key)) {
    const existing = processedOrders.get(idempotency_key)!;
    return {
      ...existing.response,
      outcome: 'DUPLICATE',
      message: `This order submission was already received and recorded under reference ${existing.response.order_ref}. No duplicate charge or submission created.`,
    };
  }

  // Also check Supabase for idempotency if connected
  const serviceSupabase = getServiceSupabase();
  if (serviceSupabase) {
    try {
      const { data: existingDbOrder } = await serviceSupabase
        .from('orders')
        .select('*')
        .eq('idempotency_key', idempotency_key)
        .maybeSingle();

      if (existingDbOrder) {
        return {
          success: true,
          outcome: 'DUPLICATE',
          order_ref: existingDbOrder.order_ref,
          order_status: existingDbOrder.order_status,
          payment_status: existingDbOrder.payment_status,
          tags: existingDbOrder.tags || [],
          total: Number(existingDbOrder.total),
          bonus_amount: Number(existingDbOrder.bonus_amount),
          bonus_status: existingDbOrder.bonus_status,
          message: `This order submission was already recorded in database under reference ${existingDbOrder.order_ref}.`,
        };
      }
    } catch {
      // Continue to local processing
    }
  }

  // 2. Validate items and recalculate official prices (authoritative pricing)
  let computedTotal = 0;
  const reviewReasons: string[] = [];
  const tags: string[] = ['STANDARD_ORDER', 'PAYMENT_PENDING'];

  const validatedItems = [];

  for (const item of items) {
    const officialProduct = await getProductById(item.product_id);
    if (!officialProduct) {
      throw new Error(`Product "${item.product_id}" is no longer available.`);
    }

    const unitPrice = officialProduct.price;
    const stockAvailable = officialProduct.stock_quantity;
    if (item.quantity > stockAvailable) {
      throw new Error(
        `Requested quantity for "${officialProduct.name}" exceeds current stock (${stockAvailable}).`
      );
    }
    const subtotal = unitPrice * item.quantity;
    computedTotal += subtotal;

    // Price mismatch detection
    const clientSubmittedPrice = item.unit_price_client_submitted ?? item.unit_price_displayed;
    if (Math.abs(unitPrice - clientSubmittedPrice) > 0.01) {
      reviewReasons.push(
        `Price mismatch for "${officialProduct.name}": submitted ₦${clientSubmittedPrice}, authoritative ₦${unitPrice}`
      );
      tags.push('INCOMPLETE_ORDER');
    }

    validatedItems.push({
      product_id: officialProduct.id,
      product_name: officialProduct.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal,
    });
  }

  // 3. Compute High-Value Bonus (Promo Rule: ₦500,000 threshold -> 5% bonus credit)
  const qualifiesForBonus = computedTotal >= PROMO_THRESHOLD;
  const bonusAmount = qualifiesForBonus ? Math.round(computedTotal * PROMO_PERCENTAGE) : 0;
  const bonusStatus = qualifiesForBonus ? 'PENDING_VERIFICATION' : 'NOT_ELIGIBLE';

  if (qualifiesForBonus) {
    const standardIndex = tags.indexOf('STANDARD_ORDER');
    if (standardIndex >= 0) tags.splice(standardIndex, 1);
    tags.push('HIGH_VALUE_ORDER');
  }

  // 4. Generate Order Reference
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const orderRef = `VE-${dateStr}-${randomSuffix}`;

  const outcome = 'ACCEPTED';
  const orderStatus = 'PAYMENT_PENDING';
  const paymentStatus = 'PAYMENT_PENDING';

  const message = `Your order ${orderRef} has been successfully registered. Payment verification is pending. No charges have been debited.`;

  const webhookResponse: WebhookResponse = {
    success: true,
    outcome,
    order_ref: orderRef,
    order_status: orderStatus,
    payment_status: paymentStatus,
    tags,
    total: computedTotal,
    bonus_amount: bonusAmount,
    bonus_status: bonusStatus,
    message,
    review_reasons: reviewReasons.length > 0 ? reviewReasons : undefined,
  };

  const orderRecord: OrderRecord = {
    id: crypto.randomUUID(),
    order_ref: orderRef,
    user_id: payload.user_id || null,
    customer_name: customer.name,
    customer_email: customer.email.toLowerCase().trim(),
    customer_phone: customer.phone,
    delivery_address: delivery.address || null,
    delivery_notes: delivery.notes || null,
    total: computedTotal,
    bonus_amount: bonusAmount,
    bonus_status: bonusStatus,
    payment_status: paymentStatus,
    order_status: orderStatus,
    tags,
    review_reasons: reviewReasons,
    idempotency_key,
    customer_type: 'STANDARD',
    raw_payload: payload as unknown as Record<string, unknown>,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_items: validatedItems.map((vi) => ({
      id: crypto.randomUUID(),
      ...vi,
    })),
  };

  // Cache locally
  processedOrders.set(idempotency_key, {
    response: webhookResponse,
    order: orderRecord,
  });

  // Persist to Supabase if service role is available
  if (serviceSupabase) {
    try {
      const { data: insertedOrder, error: orderErr } = await serviceSupabase
        .from('orders')
        .insert({
          order_ref: orderRef,
          user_id: payload.user_id || null,
          customer_name: customer.name,
          customer_email: customer.email.toLowerCase().trim(),
          customer_phone: customer.phone,
          delivery_address: delivery.address || null,
          delivery_notes: delivery.notes || null,
          total: computedTotal,
          bonus_amount: bonusAmount,
          bonus_status: bonusStatus,
          payment_status: paymentStatus,
          order_status: orderStatus,
          tags,
          review_reasons: reviewReasons,
          idempotency_key,
          customer_type: 'STANDARD',
          raw_payload: payload,
        })
        .select()
        .single();

      if (!orderErr && insertedOrder && validatedItems.length > 0) {
        const itemsToInsert = validatedItems.map((vi) => ({
          order_id: insertedOrder.id,
          product_id: vi.product_id,
          product_name: vi.product_name,
          quantity: vi.quantity,
          unit_price: vi.unit_price,
          subtotal: vi.subtotal,
        }));

        await serviceSupabase.from('order_items').insert(itemsToInsert);
      }
    } catch {
      // Memory fallback continues safely
    }
  }

  return webhookResponse;
}

// Function to find an order by reference and email for tracking
export async function findOrderForTracking(
  orderRef: string,
  email: string
): Promise<OrderRecord | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedRef = orderRef.toUpperCase().trim();

  // Try Supabase first if configured
  const serviceSupabase = getServiceSupabase();
  if (serviceSupabase) {
    try {
      const { data: order, error } = await serviceSupabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('order_ref', normalizedRef)
        .ilike('customer_email', normalizedEmail)
        .maybeSingle();

      if (!error && order) {
        return order as OrderRecord;
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  // Look in memory
  for (const { order } of processedOrders.values()) {
    if (
      order.order_ref === normalizedRef &&
      order.customer_email.toLowerCase() === normalizedEmail
    ) {
      return order;
    }
  }

  return null;
}

// Helper for admin dashboard to list all orders
export async function getAllOrdersForAdmin(): Promise<OrderRecord[]> {
  const serviceSupabase = getServiceSupabase();
  if (serviceSupabase) {
    try {
      const { data, error } = await serviceSupabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as OrderRecord[];
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  return Array.from(processedOrders.values())
    .map((v) => v.order)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
