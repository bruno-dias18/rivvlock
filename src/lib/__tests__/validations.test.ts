import { describe, it, expect } from 'vitest';
import { 
  validatePrice, 
  validateEmail, 
  validateSIRET, 
  validateAVS, 
  validateVAT 
} from '../validations';

describe('validations', () => {
  describe('validatePrice', () => {
    it('should accept valid prices', () => {
      expect(validatePrice(1)).toBe(true);
      expect(validatePrice(100)).toBe(true);
      expect(validatePrice(999999)).toBe(true);
      expect(validatePrice(1000000)).toBe(true);
    });

    it('should reject prices below minimum', () => {
      expect(validatePrice(0)).toBe(false);
      expect(validatePrice(0.99)).toBe(false);
      expect(validatePrice(-10)).toBe(false);
    });

    it('should reject prices above maximum', () => {
      expect(validatePrice(1000001)).toBe(false);
      expect(validatePrice(2000000)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validatePrice(1.00)).toBe(true);
      expect(validatePrice(1000000.00)).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@domain.co.uk')).toBe(true);
      expect(validateEmail('name+tag@company.io')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('no@domain')).toBe(false);
      expect(validateEmail('@nodomain.com')).toBe(false);
      expect(validateEmail('spaces in@email.com')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('a@b.c')).toBe(true);
    });
  });

  describe('validateSIRET', () => {
    it('should accept valid SIRET format', () => {
      expect(validateSIRET('12345678901234')).toBe(true);
      expect(validateSIRET('98765432109876')).toBe(true);
    });

    it('should reject invalid SIRET', () => {
      expect(validateSIRET('123')).toBe(false);
      expect(validateSIRET('12345678901')).toBe(false);
      expect(validateSIRET('123456789012345')).toBe(false);
      expect(validateSIRET('ABCD1234567890')).toBe(false);
    });

    it('should handle spaces', () => {
      expect(validateSIRET('123 456 789 01234')).toBe(false);
    });
  });

  describe('validateAVS', () => {
    it('should accept valid AVS format', () => {
      expect(validateAVS('756.1234.5678.97')).toBe(true);
      expect(validateAVS('756.9999.9999.99')).toBe(true);
    });

    it('should reject invalid AVS', () => {
      expect(validateAVS('123.4567.8901.23')).toBe(false);
      expect(validateAVS('756.123.456.78')).toBe(false);
      expect(validateAVS('756123456789')).toBe(false);
    });
  });

  describe('validateVAT', () => {
    it('should accept valid VAT formats', () => {
      // France
      expect(validateVAT('FR12345678901')).toBe(true);
      // Switzerland
      expect(validateVAT('CHE123456789')).toBe(true);
      // Germany
      expect(validateVAT('DE123456789')).toBe(true);
    });

    it('should reject invalid VAT', () => {
      expect(validateVAT('INVALID')).toBe(false);
      expect(validateVAT('FR123')).toBe(false);
      expect(validateVAT('12345678')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(validateVAT('fr12345678901')).toBe(true);
      expect(validateVAT('Fr12345678901')).toBe(true);
    });
  });
});
