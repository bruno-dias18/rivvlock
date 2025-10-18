import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { calculatePlatformFees, toStripeAmount, fromStripeAmount } from '../payment-utils.ts';

Deno.test('calculatePlatformFees - should calculate fees correctly with 0% client ratio', () => {
  const result = calculatePlatformFees(1000, 0);
  assertEquals(result.totalFee, 50); // 5% of 1000
  assertEquals(result.buyerFee, 0);
  assertEquals(result.sellerFee, 50);
});

Deno.test('calculatePlatformFees - should calculate fees correctly with 50% client ratio', () => {
  const result = calculatePlatformFees(1000, 50);
  assertEquals(result.totalFee, 50);
  assertEquals(result.buyerFee, 25);
  assertEquals(result.sellerFee, 25);
});

Deno.test('calculatePlatformFees - should calculate fees correctly with 100% client ratio', () => {
  const result = calculatePlatformFees(1000, 100);
  assertEquals(result.totalFee, 50);
  assertEquals(result.buyerFee, 50);
  assertEquals(result.sellerFee, 0);
});

Deno.test('toStripeAmount - should convert to cents', () => {
  assertEquals(toStripeAmount(10.50), 1050);
  assertEquals(toStripeAmount(100), 10000);
  assertEquals(toStripeAmount(0.99), 99);
});

Deno.test('fromStripeAmount - should convert from cents', () => {
  assertEquals(fromStripeAmount(1050), 10.50);
  assertEquals(fromStripeAmount(10000), 100);
  assertEquals(fromStripeAmount(99), 0.99);
});

Deno.test('round-trip conversion - should maintain value', () => {
  const original = 99.99;
  const converted = fromStripeAmount(toStripeAmount(original));
  assertEquals(converted, original);
});
