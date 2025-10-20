import { assertEquals, assertThrows } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.190.0/testing/bdd.ts";
import { 
  calculateRefund, 
  validateRefundCalculation,
  formatRefundCalculation 
} from "../refund-calculator.ts";

/**
 * Comprehensive tests for the centralized refund calculator
 * These tests MUST all pass before deploying any changes
 */

describe("calculateRefund - Basic Calculations", () => {
  it("should calculate full refund correctly (100%)", () => {
    const result = calculateRefund(100, 100);
    
    assertEquals(result.totalAmount, 10000);
    assertEquals(result.refundAmount, 10000);
    assertEquals(result.sellerAmount, -500);
    assertEquals(result.platformFee, 500);
    assertEquals(result.refundPercentage, 100);
  });

  it("should calculate 50% refund correctly", () => {
    const result = calculateRefund(100, 50);
    
    assertEquals(result.totalAmount, 10000);
    assertEquals(result.refundAmount, 5000);
    assertEquals(result.sellerAmount, 4500);
    assertEquals(result.platformFee, 500);
    assertEquals(result.refundPercentage, 50);
  });

  it("should calculate 0% refund correctly (full release)", () => {
    const result = calculateRefund(100, 0);
    
    assertEquals(result.totalAmount, 10000);
    assertEquals(result.refundAmount, 0);
    assertEquals(result.sellerAmount, 9500);
    assertEquals(result.platformFee, 500);
    assertEquals(result.refundPercentage, 0);
  });

  it("should calculate 25% refund correctly", () => {
    const result = calculateRefund(200, 25);
    
    assertEquals(result.totalAmount, 20000);
    assertEquals(result.refundAmount, 5000);
    assertEquals(result.sellerAmount, 14000);
    assertEquals(result.platformFee, 1000);
  });

  it("should calculate 75% refund correctly", () => {
    const result = calculateRefund(120, 75);
    
    assertEquals(result.totalAmount, 12000);
    assertEquals(result.refundAmount, 9000);
    assertEquals(result.sellerAmount, 2400);
    assertEquals(result.platformFee, 600);
  });
});

describe("calculateRefund - Edge Cases", () => {
  it("should handle small amounts (10 CHF)", () => {
    const result = calculateRefund(10, 50);
    
    assertEquals(result.totalAmount, 1000);
    assertEquals(result.refundAmount, 500);
    assertEquals(result.sellerAmount, 450);
    assertEquals(result.platformFee, 50);
  });

  it("should handle large amounts (10000 CHF)", () => {
    const result = calculateRefund(10000, 50);
    
    assertEquals(result.totalAmount, 1000000);
    assertEquals(result.refundAmount, 500000);
    assertEquals(result.sellerAmount, 450000);
    assertEquals(result.platformFee, 50000);
  });

  it("should handle decimal amounts (123.45 CHF)", () => {
    const result = calculateRefund(123.45, 50);
    
    assertEquals(result.totalAmount, 12345);
    assertEquals(result.refundAmount, 6173); // Rounded
    assertEquals(result.platformFee, 617);
  });

  it("should handle 1% refund", () => {
    const result = calculateRefund(100, 1);
    
    assertEquals(result.refundAmount, 100);
    assertEquals(result.sellerAmount, 9400);
  });

  it("should handle 99% refund", () => {
    const result = calculateRefund(100, 99);
    
    assertEquals(result.refundAmount, 9900);
    assertEquals(result.sellerAmount, -400);
  });
});

describe("calculateRefund - Validation", () => {
  it("should throw error for negative refund percentage", () => {
    assertThrows(
      () => calculateRefund(100, -1),
      Error,
      "Invalid refund percentage"
    );
  });

  it("should throw error for refund percentage > 100", () => {
    assertThrows(
      () => calculateRefund(100, 101),
      Error,
      "Invalid refund percentage"
    );
  });

  it("should throw error for negative transaction price", () => {
    assertThrows(
      () => calculateRefund(-100, 50),
      Error,
      "Invalid transaction price"
    );
  });

  it("should accept 0 CHF transaction", () => {
    const result = calculateRefund(0, 50);
    
    assertEquals(result.totalAmount, 0);
    assertEquals(result.refundAmount, 0);
    assertEquals(result.sellerAmount, 0);
    assertEquals(result.platformFee, 0);
  });
});

describe("calculateRefund - Invariant: Sum = Total", () => {
  it("should maintain invariant for all percentages", () => {
    const percentages = [0, 1, 10, 25, 33, 50, 67, 75, 90, 99, 100];
    
    percentages.forEach(pct => {
      const result = calculateRefund(100, pct);
      const sum = result.refundAmount + result.sellerAmount + result.platformFee;
      
      assertEquals(
        sum,
        result.totalAmount,
        `Sum must equal total for ${pct}% refund`
      );
    });
  });

  it("should maintain invariant for various amounts", () => {
    const amounts = [1, 10, 50, 100, 123.45, 500, 999.99, 10000];
    
    amounts.forEach(amount => {
      const result = calculateRefund(amount, 50);
      const sum = result.refundAmount + result.sellerAmount + result.platformFee;
      
      assertEquals(
        sum,
        result.totalAmount,
        `Sum must equal total for ${amount} CHF`
      );
    });
  });

  it("should maintain invariant for random combinations", () => {
    const testCases = [
      { price: 99.99, pct: 33 },
      { price: 250, pct: 67 },
      { price: 1500, pct: 15 },
      { price: 37.50, pct: 88 },
      { price: 777, pct: 42 },
    ];
    
    testCases.forEach(({ price, pct }) => {
      const result = calculateRefund(price, pct);
      const sum = result.refundAmount + result.sellerAmount + result.platformFee;
      
      assertEquals(
        sum,
        result.totalAmount,
        `Sum must equal total for ${price} CHF at ${pct}%`
      );
    });
  });
});

describe("calculateRefund - Platform Fee Always 5%", () => {
  it("should calculate 5% platform fee regardless of refund", () => {
    const refundPercentages = [0, 25, 50, 75, 100];
    const price = 100;
    const expectedFee = 500; // 5% of 100 CHF = 5 CHF = 500 cents
    
    refundPercentages.forEach(pct => {
      const result = calculateRefund(price, pct);
      
      assertEquals(
        result.platformFee,
        expectedFee,
        `Platform fee must be 5% of original (${pct}% refund)`
      );
    });
  });

  it("should calculate correct platform fee for various amounts", () => {
    const amounts = [10, 50, 100, 200, 500, 1000];
    
    amounts.forEach(amount => {
      const result = calculateRefund(amount, 50);
      const expectedFee = Math.round(amount * 100 * 0.05);
      
      assertEquals(
        result.platformFee,
        expectedFee,
        `Platform fee must be 5% of ${amount} CHF`
      );
    });
  });
});

describe("validateRefundCalculation", () => {
  it("should return true for valid calculation", () => {
    const result = calculateRefund(100, 50);
    assertEquals(validateRefundCalculation(result), true);
  });

  it("should return true for all valid calculations", () => {
    const testCases = [
      { price: 100, pct: 0 },
      { price: 100, pct: 50 },
      { price: 100, pct: 100 },
      { price: 123.45, pct: 37 },
    ];
    
    testCases.forEach(({ price, pct }) => {
      const result = calculateRefund(price, pct);
      assertEquals(
        validateRefundCalculation(result),
        true,
        `Validation must pass for ${price} CHF at ${pct}%`
      );
    });
  });

  it("should detect invalid calculation", () => {
    const result = calculateRefund(100, 50);
    // Manually corrupt the result
    result.sellerAmount += 100;
    
    assertEquals(validateRefundCalculation(result), false);
  });
});

describe("formatRefundCalculation", () => {
  it("should format calculation for logging", () => {
    const result = calculateRefund(100, 50);
    const formatted = formatRefundCalculation(result);
    
    assertEquals(typeof formatted, "string");
    assertEquals(formatted.includes("50%"), true);
    assertEquals(formatted.includes("100.00 CHF"), true);
    assertEquals(formatted.includes("50.00 CHF"), true);
    assertEquals(formatted.includes("45.00 CHF"), true);
    assertEquals(formatted.includes("5.00 CHF"), true);
    assertEquals(formatted.includes("✅"), true);
  });

  it("should support custom currency", () => {
    const result = calculateRefund(100, 50);
    const formatted = formatRefundCalculation(result, "EUR");
    
    assertEquals(formatted.includes("EUR"), true);
    assertEquals(formatted.includes("CHF"), false);
  });
});

describe("calculateRefund - Real-world Scenarios", () => {
  it("should handle typical service transaction (250 CHF, 50% refund)", () => {
    const result = calculateRefund(250, 50);
    
    // Buyer gets 125 CHF back
    assertEquals(result.refundAmount, 12500);
    // Seller gets 95% of remaining 125 CHF = 118.75 CHF
    assertEquals(result.sellerAmount, 11875);
    // Platform gets 5% of original 250 CHF = 12.50 CHF
    assertEquals(result.platformFee, 1250);
    
    assertEquals(validateRefundCalculation(result), true);
  });

  it("should handle quality dispute (500 CHF, 30% refund)", () => {
    const result = calculateRefund(500, 30);
    
    // Buyer gets 150 CHF back
    assertEquals(result.refundAmount, 15000);
    // Seller gets 95% of remaining 350 CHF = 332.50 CHF
    assertEquals(result.sellerAmount, 33250);
    // Platform gets 25 CHF
    assertEquals(result.platformFee, 2500);
    
    assertEquals(validateRefundCalculation(result), true);
  });

  it("should handle admin no-refund decision (1000 CHF, 0% refund)", () => {
    const result = calculateRefund(1000, 0);
    
    // No refund to buyer
    assertEquals(result.refundAmount, 0);
    // Seller gets 95% of 1000 CHF = 950 CHF
    assertEquals(result.sellerAmount, 95000);
    // Platform gets 50 CHF
    assertEquals(result.platformFee, 5000);
    
    assertEquals(validateRefundCalculation(result), true);
  });
});
