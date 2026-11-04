import { z } from 'zod';
import { isValidNigerianPhone } from './formatters';

// Nigerian phone schema
export const nigerianPhoneSchema = z
  .string({ required_error: 'Phone number is required' })
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
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email address is required' })
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
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1'),
  unit_price_displayed: z
    .number({ required_error: 'Displayed price is required' })
    .nonnegative('Displayed price cannot be negative'),
});

// Complete order submission payload schema
export const orderSubmissionPayloadSchema = z.object({
  idempotency_key: z
    .string({ required_error: 'Idempotency key is required' })
    .uuid('Idempotency key must be a valid UUID'),
  submitted_at: z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' }),
  source: z.string().default('storefront-web'),
  customer: orderCustomerSchema,
  delivery: orderDeliverySchema,
  items: z
    .array(orderItemSubmissionSchema)
    .min(1, 'Order must contain at least one product item'),
});

export type OrderSubmissionInput = z.infer<typeof orderSubmissionPayloadSchema>;
