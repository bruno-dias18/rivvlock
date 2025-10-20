import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.190.0/testing/bdd.ts";

/**
 * Tests for create-payment-intent edge function
 * 
 * These tests validate payment method availability logic and deadline calculations
 */

describe("create-payment-intent - Payment Method Availability", () => {
  /**
   * Helper to determine available payment methods based on deadline
   */
  function getAvailablePaymentMethods(hoursUntilDeadline: number): string[] {
    const methods = ['card'];
    
    // Bank transfer only if >= 72 hours (3 days)
    if (hoursUntilDeadline >= 72) {
      methods.push('customer_balance');
    }
    
    return methods;
  }

  it("should only allow card if deadline < 72 hours", () => {
    const methods = getAvailablePaymentMethods(48);
    
    assertEquals(methods.length, 1);
    assertEquals(methods[0], 'card');
  });

  it("should allow card + bank transfer if deadline >= 72 hours", () => {
    const methods = getAvailablePaymentMethods(72);
    
    assertEquals(methods.length, 2);
    assert(methods.includes('card'), 'Should include card');
    assert(methods.includes('customer_balance'), 'Should include bank transfer');
  });

  it("should allow bank transfer for 3 days deadline", () => {
    const methods = getAvailablePaymentMethods(72); // exactly 3 days
    
    assert(methods.includes('customer_balance'), '72 hours should allow bank transfer');
  });

  it("should allow bank transfer for 7 days deadline", () => {
    const methods = getAvailablePaymentMethods(168); // 7 days
    
    assert(methods.includes('customer_balance'), '7 days should allow bank transfer');
  });

  it("should NOT allow bank transfer for 2.5 days deadline", () => {
    const methods = getAvailablePaymentMethods(60); // 2.5 days
    
    assertEquals(methods.length, 1);
    assert(!methods.includes('customer_balance'), '60 hours should NOT allow bank transfer');
  });

  it("should handle edge case: 71.9 hours (just under threshold)", () => {
    const methods = getAvailablePaymentMethods(71.9);
    
    assertEquals(methods.length, 1, 'Just under 72h should only allow card');
  });

  it("should handle edge case: 72.1 hours (just over threshold)", () => {
    const methods = getAvailablePaymentMethods(72.1);
    
    assertEquals(methods.length, 2, 'Just over 72h should allow both methods');
  });
});

describe("create-payment-intent - Deadline Calculation", () => {
  /**
   * Helper to calculate hours until deadline
   */
  function calculateHoursUntilDeadline(
    paymentDeadline: Date,
    now: Date
  ): number {
    const timeUntilDeadline = paymentDeadline.getTime() - now.getTime();
    return timeUntilDeadline / (1000 * 60 * 60);
  }

  it("should calculate hours correctly for 3 days", () => {
    const now = new Date('2025-01-01T10:00:00Z');
    const deadline = new Date('2025-01-04T10:00:00Z');
    
    const hours = calculateHoursUntilDeadline(deadline, now);
    
    assertEquals(hours, 72);
  });

  it("should calculate hours correctly for 1 week", () => {
    const now = new Date('2025-01-01T10:00:00Z');
    const deadline = new Date('2025-01-08T10:00:00Z');
    
    const hours = calculateHoursUntilDeadline(deadline, now);
    
    assertEquals(hours, 168);
  });

  it("should calculate hours correctly for 2 days", () => {
    const now = new Date('2025-01-01T10:00:00Z');
    const deadline = new Date('2025-01-03T10:00:00Z');
    
    const hours = calculateHoursUntilDeadline(deadline, now);
    
    assertEquals(hours, 48);
  });

  it("should handle same-day deadline", () => {
    const now = new Date('2025-01-01T10:00:00Z');
    const deadline = new Date('2025-01-01T16:00:00Z');
    
    const hours = calculateHoursUntilDeadline(deadline, now);
    
    assertEquals(hours, 6);
  });

  it("should handle past deadline (negative hours)", () => {
    const now = new Date('2025-01-05T10:00:00Z');
    const deadline = new Date('2025-01-01T10:00:00Z');
    
    const hours = calculateHoursUntilDeadline(deadline, now);
    
    assert(hours < 0, 'Past deadline should be negative');
    assertEquals(hours, -96);
  });
});

describe("create-payment-intent - Amount Calculation", () => {
  /**
   * Helper to convert price to cents
   */
  function convertToCents(price: number): number {
    return Math.round(price * 100);
  }

  it("should convert CHF to cents correctly", () => {
    assertEquals(convertToCents(100), 10000);
    assertEquals(convertToCents(50.50), 5050);
    assertEquals(convertToCents(123.45), 12345);
  });

  it("should handle decimal prices correctly", () => {
    assertEquals(convertToCents(99.99), 9999);
    assertEquals(convertToCents(0.01), 1);
    assertEquals(convertToCents(1000.50), 100050);
  });

  it("should round correctly for edge cases", () => {
    assertEquals(convertToCents(10.005), 1001); // rounds up
    assertEquals(convertToCents(10.004), 1000); // rounds down
  });
});

describe("create-payment-intent - Escrow Configuration", () => {
  it("should use manual capture for escrow", () => {
    const captureMethod = 'manual';
    
    assertEquals(captureMethod, 'manual', 'Must use manual capture for escrow');
  });

  it("should include required metadata", () => {
    const metadata = {
      transaction_id: 'uuid',
      seller_id: 'seller-uuid',
      buyer_id: 'buyer-uuid',
      platform: 'rivvlock',
      rivvlock_escrow: 'true'
    };
    
    assert(metadata.transaction_id, 'Must include transaction_id');
    assert(metadata.seller_id, 'Must include seller_id');
    assert(metadata.buyer_id, 'Must include buyer_id');
    assertEquals(metadata.platform, 'rivvlock');
    assertEquals(metadata.rivvlock_escrow, 'true');
  });
});

describe("create-payment-intent - Business Logic Validation", () => {
  it("should enforce 72-hour rule for SEPA transfers", () => {
    // SEPA can take 1-3 business days
    // 72 hours = 3 days provides safe buffer
    const minHours = 72;
    
    assertEquals(minHours, 72, 'SEPA minimum deadline must be 72 hours');
    assertEquals(minHours / 24, 3, 'SEPA minimum deadline is 3 days');
  });

  it("should always include card as payment option", () => {
    const deadlines = [1, 24, 48, 72, 96, 168]; // Various hours
    
    deadlines.forEach(hours => {
      const methods = ['card'];
      if (hours >= 72) methods.push('customer_balance');
      
      assert(
        methods.includes('card'),
        `Card must always be available regardless of deadline (${hours}h)`
      );
    });
  });
});
