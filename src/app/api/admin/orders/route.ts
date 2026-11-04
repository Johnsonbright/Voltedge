import { NextRequest, NextResponse } from 'next/server';
import { getAllOrdersForAdmin } from '@/lib/orderSimulator';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const adminPass = req.headers.get('x-admin-pass');
    
    // Check either basic demo pass, Bearer token, or dev bypass
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET || 'voltedge_super_secret_shared_token_2026';
    const isAuthorized =
      adminPass === 'voltedge2026' ||
      adminPass === expectedSecret ||
      authHeader?.includes(expectedSecret) ||
      process.env.NODE_ENV !== 'production';

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized access to admin dashboard.' },
        { status: 401 }
      );
    }

    const orders = await getAllOrdersForAdmin();

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown admin query error';
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve admin orders', error: errorMsg },
      { status: 500 }
    );
  }
}
