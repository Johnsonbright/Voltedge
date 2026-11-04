// VoltEdge Type Definitions

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  stock_quantity: number;
  image_url: string;
  description: string;
  category: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type WebhookOutcome =
  | 'ACCEPTED'
  | 'ACCEPTED_FOR_REVIEW'
  | 'REJECTED_INCOMPLETE'
  | 'DUPLICATE';

export type OrderStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'REJECTED';

export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'FAILED';

export type BonusStatus =
  | 'NOT_ELIGIBLE'
  | 'PENDING_VERIFICATION'
  | 'ACTIVATED'
  | 'REJECTED';

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface OrderDelivery {
  address?: string;
  notes?: string;
}

export interface OrderItemSubmission {
  product_id: string;
  name: string;
  quantity: number;
  unit_price_displayed: number;
}

export interface OrderSubmissionPayload {
  idempotency_key: string;
  submitted_at: string;
  source: string;
  customer: OrderCustomer;
  delivery: OrderDelivery;
  items: OrderItemSubmission[];
}

export interface WebhookResponse {
  success: boolean;
  outcome: WebhookOutcome;
  order_ref: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  tags: string[];
  total: number;
  bonus_amount: number;
  bonus_status: BonusStatus;
  message: string;
  errors?: string[];
  review_reasons?: string[];
}

export interface OrderRecord {
  id: string;
  order_ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_notes: string | null;
  total: number;
  bonus_amount: number;
  bonus_status: BonusStatus;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  tags: string[];
  review_reasons: string[];
  idempotency_key: string;
  customer_type: string;
  raw_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  order_items?: {
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
}

export interface TrackOrderResponse {
  success: boolean;
  order?: OrderRecord;
  message?: string;
}
