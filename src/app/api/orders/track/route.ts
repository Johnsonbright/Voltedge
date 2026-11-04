import { NextRequest, NextResponse } from 'next/server';
import { findOrderForTracking } from '@/lib/orderSimulator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_ref, email } = body || {};

    if (!order_ref || typeof order_ref !== 'string' || !order_ref.trim()) {
      return NextResponse.json(
        { success: false, message: 'Order reference is required.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { success: false, message: 'Customer email address is required.' },
        { status: 400 }
      );
    }

    const order = await findOrderForTracking(order_ref, email);

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message:
            'No order found matching the provided reference number and email address. Please double-check your order details.',
        },
        { status: 404 }
      );
    }

    // Return sanitized order data (hide internal raw payload if sensitive)
    const sanitizedOrder = {
      id: order.id,
      order_ref: order.order_ref,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      delivery_address: order.delivery_address,
      delivery_notes: order.delivery_notes,
      total: order.total,
      bonus_amount: order.bonus_amount,
      bonus_status: order.bonus_status,
      payment_status: order.payment_status,
      order_status: order.order_status,
      tags: order.tags,
      review_reasons: order.review_reasons,
      created_at: order.created_at,
      order_items: order.order_items || [],
    };

    return NextResponse.json({
      success: true,
      order: sanitizedOrder,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown tracking error';
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to query order status at this time. Please try again.',
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
