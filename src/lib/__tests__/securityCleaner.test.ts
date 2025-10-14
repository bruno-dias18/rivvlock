import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleCleanup, cleanupExpiredData } from '../securityCleaner';

describe('securityCleaner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scheduleCleanup', () => {
    it('should schedule cleanup at regular intervals', () => {
      const cleanup = vi.fn();
      scheduleCleanup(cleanup, 60000); // 1 minute

      // Fast-forward time
      vi.advanceTimersByTime(60000);
      expect(cleanup).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60000);
      expect(cleanup).toHaveBeenCalledTimes(2);
    });

    it('should allow cancellation of scheduled cleanup', () => {
      const cleanup = vi.fn();
      const cancel = scheduleCleanup(cleanup, 60000);

      cancel();
      vi.advanceTimersByTime(60000);
      
      expect(cleanup).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredData', () => {
    it('should identify expired tokens', () => {
      const now = Date.now();
      const expiredToken = {
        token: 'test-token',
        expires_at: new Date(now - 1000).toISOString(),
      };
      const validToken = {
        token: 'valid-token',
        expires_at: new Date(now + 1000).toISOString(),
      };

      const expired = cleanupExpiredData([expiredToken, validToken]);
      
      expect(expired).toContain(expiredToken);
      expect(expired).not.toContain(validToken);
    });

    it('should handle empty data', () => {
      const result = cleanupExpiredData([]);
      expect(result).toEqual([]);
    });
  });
});
