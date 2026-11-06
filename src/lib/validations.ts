import { z } from 'zod';
import { isValidNigerianPhone } from './formatters';

// Nigerian phone schema
export const nigerianPhoneSchema = z
  .string()
  .trim()
  .min(10, 'Phone number must be at least 10 digits')
  .max(16, 'Phone number cannot exceed 16 characters')
  .refine(
    (val) => isValidNigerianPhone(val),
    'Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)'
  );

// Customer details schema
export const orderCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
  phone: nigerianPhoneSchema,
});

// Delivery details schema
export const orderDeliverySchema = z.object({
  address: z
    .string()
    .trim()
    .max(300, 'Address cannot exceed 300 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(500, 'Order notes cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

// Item submission schema
export const orderItemSubmissionSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  name: z.string().min(1, 'Product name is required'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1'),
  unit_price_displayed: z
    .number()
    .nonnegative('Displayed price cannot be negative'),
  unit_price_client_submitted: z.number().nonnegative().optional(),
});

// Complete order submission payload schema
export const orderSubmissionPayloadSchema = z.object({
  idempotency_key: z
    .string()
    .uuid('Idempotency key must be a valid UUID'),
  submitted_at: z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' }),
  source: z.literal('storefront-web').default('storefront-web'),
  customer: orderCustomerSchema,
  delivery: orderDeliverySchema,
  items: z
    .array(orderItemSubmissionSchema)
    .min(1, 'Order must contain at least one product item')
    .max(50, 'An order cannot contain more than 50 product lines'),
});

export type OrderSubmissionInput = z.infer<typeof orderSubmissionPayloadSchema>;

const orderClassificationTagSchema = z.enum([
  'PAYMENT_PENDING',
  'STANDARD_ORDER',
  'HIGH_VALUE_ORDER',
  'INCOMPLETE_ORDER',
  'REVIEW_REQUIRED',
]);

const acceptedOrderReplyFields = {
  success: z.literal(true),
  order_ref: z.string().trim().min(1).max(100),
  payment_status: z.literal('PAYMENT_PENDING'),
  tags: z.array(orderClassificationTagSchema),
  total: z.number().finite().nonnegative(),
  bonus_amount: z.number().finite().nonnegative(),
  bonus_status: z.enum(['NOT_ELIGIBLE', 'PENDING_VERIFICATION']),
  message: z.string().trim().min(1).max(1000),
  errors: z.array(z.string()).optional(),
  review_reasons: z.array(z.string()).optional(),
};

const acceptedOrderReplySchema = z
  .object({
    ...acceptedOrderReplyFields,
    outcome: z.literal('ACCEPTED'),
    order_status: z.literal('PAYMENT_PENDING'),
  })
  .strict();

const reviewOrderReplySchema = z
  .object({
    ...acceptedOrderReplyFields,
    outcome: z.literal('ACCEPTED_FOR_REVIEW'),
    order_status: z.literal('REVIEW_REQUIRED'),
  })
  .strict();

const duplicateOrderReplySchema = z
  .object({
    ...acceptedOrderReplyFields,
    outcome: z.literal('DUPLICATE'),
    order_status: z.literal('PAYMENT_PENDING'),
  })
  .strict();

const rejectedOrderReplySchema = z
  .object({
    success: z.literal(false),
    outcome: z.literal('REJECTED_INCOMPLETE'),
    tags: z.array(orderClassificationTagSchema).refine((tags) => tags.includes('INCOMPLETE_ORDER')),
    message: z.string().trim().min(1).max(1000),
    errors: z.array(z.string().trim().min(1)).min(1),
    idempotency_key: z.string().uuid().optional(),
  })
  .strict();

export const n8nWebhookReplySchema = z
  .discriminatedUnion('outcome', [
    acceptedOrderReplySchema,
    reviewOrderReplySchema,
    duplicateOrderReplySchema,
    rejectedOrderReplySchema,
  ])
  .superRefine((reply, context) => {
    if (!reply.success) return;

    if (!reply.tags.includes('PAYMENT_PENDING')) {
      context.addIssue({
        code: 'custom',
        path: ['tags'],
        message: 'Accepted submissions must include the PAYMENT_PENDING tag.',
      });
    }

    const expectedBonusStatus =
      reply.bonus_amount > 0 ? 'PENDING_VERIFICATION' : 'NOT_ELIGIBLE';
    if (reply.bonus_status !== expectedBonusStatus) {
      context.addIssue({
        code: 'custom',
        path: ['bonus_status'],
        message: `bonus_status must be ${expectedBonusStatus} for the supplied bonus_amount.`,
      });
    }

    if (
      reply.outcome === 'ACCEPTED_FOR_REVIEW' &&
      !reply.tags.includes('REVIEW_REQUIRED')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['tags'],
        message: 'Review submissions must include the REVIEW_REQUIRED tag.',
      });
    }

    if (
      reply.outcome === 'ACCEPTED' &&
      reply.tags.includes('REVIEW_REQUIRED')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['tags'],
        message: 'Accepted submissions must not include the REVIEW_REQUIRED tag.',
      });
    }
  });

export type N8nWebhookReply = z.infer<typeof n8nWebhookReplySchema>;
