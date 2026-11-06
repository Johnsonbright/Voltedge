// Automated End-to-End Scenario Verification Script for VoltEdge Electronics
const BASE_URL = 'http://localhost:3005';

async function runScenario(title, fn) {
  process.stdout.write(`🧪 [Scenario] ${title}... `);
  try {
    await fn();
    console.log('✅ PASSED');
    return true;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function main() {
  console.log('⚡ Starting VoltEdge Electronics Scenario Verifications against', BASE_URL, '\n');

  let passed = 0;
  let total = 0;

  // Scenario 1: Standard Order Below ₦500,000
  total++;
  const s1Key = crypto.randomUUID();
  let s1OrderRef = '';
  if (
    await runScenario('Standard order below ₦500,000 (No promo bonus)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: s1Key,
          submitted_at: new Date().toISOString(),
          source: 'storefront-web',
          customer: {
            name: 'Chinedu Eze',
            email: 'chinedu.eze@example.com',
            phone: '08023456789',
          },
          delivery: { address: 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos' },
          items: [
            {
              product_id: 'a1b2c3d4-0007-4000-8000-000000000007',
              name: 'Logitech Wireless Mouse',
              quantity: 1,
              unit_price_displayed: 180000,
            },
          ],
        }),
      });
      assert(res.ok, `Status ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Response must be success: true');
      assert(data.outcome === 'ACCEPTED', `Outcome expected ACCEPTED, got ${data.outcome}`);
      assert(data.total === 180000, `Total expected 180,000, got ${data.total}`);
      assert(data.bonus_amount === 0, `Bonus amount expected 0, got ${data.bonus_amount}`);
      assert(data.bonus_status === 'NOT_ELIGIBLE', `Bonus status expected NOT_ELIGIBLE, got ${data.bonus_status}`);
      assert(data.payment_status === 'PAYMENT_PENDING', 'Payment status must be PAYMENT_PENDING');
      assert(data.order_status === 'PENDING', 'Order status must be PENDING');
      assert(data.order_ref.startsWith('VE-'), 'Order ref format invalid');
      s1OrderRef = data.order_ref;
    })
  ) passed++;

  // Scenario 2: High-Value Order (MacBook Air M4 = ₦1,850,000)
  total++;
  const s2Key = crypto.randomUUID();
  if (
    await runScenario('High-value order (MacBook Air M4 ₦1,850,000 with 5% bonus credit pending)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: s2Key,
          submitted_at: new Date().toISOString(),
          source: 'storefront-web',
          customer: {
            name: 'Amina Bello',
            email: 'amina.bello@example.com',
            phone: '+2348123456789',
          },
          delivery: { address: 'Maitama, Abuja' },
          items: [
            {
              product_id: 'a1b2c3d4-0001-4000-8000-000000000001',
              name: 'MacBook Air M4',
              quantity: 1,
              unit_price_displayed: 1850000,
            },
          ],
        }),
      });
      assert(res.ok, `Status ${res.status}`);
      const data = await res.json();
      assert(data.outcome === 'ACCEPTED', 'Outcome should be ACCEPTED');
      assert(data.total === 1850000, `Total mismatch: ${data.total}`);
      const expectedBonus = Math.round(1850000 * 0.05); // 92,500
      assert(data.bonus_amount === expectedBonus, `Expected bonus ${expectedBonus}, got ${data.bonus_amount}`);
      assert(data.bonus_status === 'PENDING_VERIFICATION', 'Bonus status must be PENDING_VERIFICATION');
      assert(data.tags.includes('HIGH_VALUE_ORDER'), 'Must have HIGH_VALUE_ORDER tag');
    })
  ) passed++;

  // Scenario 3: Multi-item cart crossing the ₦500,000 threshold
  total++;
  const s3Key = crypto.randomUUID();
  if (
    await runScenario('Multi-item cart crossing ₦500,000 threshold (Mouse + Headphones = ₦830,000)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: s3Key,
          submitted_at: new Date().toISOString(),
          source: 'storefront-web',
          customer: {
            name: 'Emeka Okafor',
            email: 'emeka.okafor@example.com',
            phone: '09012345678',
          },
          delivery: { address: 'Ikeja GRA, Lagos' },
          items: [
            {
              product_id: 'a1b2c3d4-0007-4000-8000-000000000007',
              name: 'Logitech Wireless Mouse',
              quantity: 1,
              unit_price_displayed: 180000,
            },
            {
              product_id: 'a1b2c3d4-0005-4000-8000-000000000005',
              name: 'Sony WH-1000XM5',
              quantity: 1,
              unit_price_displayed: 650000,
            },
          ],
        }),
      });
      assert(res.ok, `Status ${res.status}`);
      const data = await res.json();
      assert(data.total === 830000, `Expected total 830,000, got ${data.total}`);
      const expectedBonus = Math.round(830000 * 0.05); // 41,500
      assert(data.bonus_amount === expectedBonus, `Expected bonus ${expectedBonus}, got ${data.bonus_amount}`);
      assert(data.bonus_status === 'PENDING_VERIFICATION', 'Bonus must be pending verification');
      assert(data.tags.includes('HIGH_VALUE_ORDER'), 'Must include HIGH_VALUE_ORDER tag');
    })
  ) passed++;

  // Scenario 4: Quantity Above Shelved Stock (PlayStation 5 Slim shelf = 2, requested = 4)
  total++;
  const s4Key = crypto.randomUUID();
  let s4OrderRef = '';
  if (
    await runScenario('Quantity above shelf stock (Flags ACCEPTED_FOR_REVIEW, honest wording)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: s4Key,
          submitted_at: new Date().toISOString(),
          source: 'storefront-web',
          customer: {
            name: 'Tunde Bakare',
            email: 'tunde.bakare@example.com',
            phone: '07034567890',
          },
          delivery: { address: 'Victoria Island, Lagos' },
          items: [
            {
              product_id: 'a1b2c3d4-0003-4000-8000-000000000003',
              name: 'PlayStation 5 Slim',
              quantity: 4, // Exceeds shelf stock of 2!
              unit_price_displayed: 950000,
            },
          ],
        }),
      });
      assert(res.ok, `Status ${res.status}`);
      const data = await res.json();
      assert(data.outcome === 'ACCEPTED_FOR_REVIEW', `Expected ACCEPTED_FOR_REVIEW, got ${data.outcome}`);
      assert(data.order_status === 'UNDER_REVIEW', `Expected order_status UNDER_REVIEW, got ${data.order_status}`);
      assert(data.tags.includes('OVER_STOCK'), 'Must include OVER_STOCK tag');
      assert(data.tags.includes('REVIEW_REQUIRED'), 'Must include REVIEW_REQUIRED tag');
      assert(Array.isArray(data.review_reasons) && data.review_reasons.length > 0, 'Must have review reasons');
      assert(data.message.includes('availability review'), 'Message must explain availability review');
      s4OrderRef = data.order_ref;
    })
  ) passed++;

  // Scenario 5: Duplicate Submission (Submitting the same idempotency key again)
  total++;
  if (
    await runScenario('Duplicate submission detection (Reuses idempotency key, returns DUPLICATE outcome)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: s4Key, // SAME KEY as Scenario 4!
          submitted_at: new Date().toISOString(),
          source: 'storefront-web',
          customer: {
            name: 'Tunde Bakare',
            email: 'tunde.bakare@example.com',
            phone: '07034567890',
          },
          delivery: {},
          items: [
            {
              product_id: 'a1b2c3d4-0003-4000-8000-000000000003',
              name: 'PlayStation 5 Slim',
              quantity: 4,
              unit_price_displayed: 950000,
            },
          ],
        }),
      });
      assert(res.ok, `Status ${res.status}`);
      const data = await res.json();
      assert(data.outcome === 'DUPLICATE', `Expected outcome DUPLICATE, got ${data.outcome}`);
      assert(data.order_ref === s4OrderRef, `Expected order_ref ${s4OrderRef}, got ${data.order_ref}`);
      assert(data.message.includes('already'), 'Message must indicate already received');
    })
  ) passed++;

  // Scenario 6: Invalid or Missing Fields (Client & Server Zod Validation)
  total++;
  if (
    await runScenario('Invalid fields rejection (Non-Nigerian phone, empty items, bad email)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          submitted_at: new Date().toISOString(),
          source: 'storefront-web',
          customer: {
            name: 'A', // Too short
            email: 'not-an-email',
            phone: '12345', // Not valid Nigerian format
          },
          delivery: {},
          items: [], // Empty items
        }),
      });
      assert(res.status === 400, `Expected status 400 Bad Request, got ${res.status}`);
      const data = await res.json();
      assert(data.success === false, 'success must be false');
      assert(data.outcome === 'REJECTED_INCOMPLETE', `Expected REJECTED_INCOMPLETE, got ${data.outcome}`);
      assert(Array.isArray(data.errors) && data.errors.length >= 3, 'Must report field errors');
    })
  ) passed++;

  // Scenario 7: Order Tracking Query (Ref + Email matching)
  total++;
  if (
    await runScenario('Order tracking lookup (Querying valid ref and email via server route)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ref: s1OrderRef,
          email: 'chinedu.eze@example.com',
        }),
      });
      assert(res.ok, `Status ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Tracking must return success');
      assert(data.order.order_ref === s1OrderRef, 'Order ref must match');
      assert(data.order.payment_status === 'PAYMENT_PENDING', 'Payment must be pending verification');
      assert(Array.isArray(data.order.order_items), 'Order items must be present');
    })
  ) passed++;

  // Scenario 8: Unknown Order Ref on Tracking
  total++;
  if (
    await runScenario('Unknown order ref on tracking (Returns 404 with honest message)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ref: 'VE-99999999-NONEXIST',
          email: 'nobody@example.com',
        }),
      });
      assert(res.status === 404, `Expected 404 Not Found, got ${res.status}`);
      const data = await res.json();
      assert(data.success === false, 'Success must be false');
      assert(data.message.includes('No order found'), 'Must explain order was not found');
    })
  ) passed++;

  // Scenario 9: Admin API rejects requests without a verified Supabase session
  total++;
  if (
    await runScenario('Admin API rejects unauthenticated access', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/orders`, {
      });
      assert(res.status === 401, `Expected status 401, got ${res.status}`);
      const data = await res.json();
      assert(data.success === false, 'Unauthenticated admin request must fail');
    })
  ) passed++;

  console.log(`\n========================================`);
  console.log(`🏁 Verification Results: ${passed}/${total} Scenarios Passed`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
