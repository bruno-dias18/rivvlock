/**
 * Tests for copy/share utilities
 * Validates clipboard and sharing functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareOrCopy } from '../copyUtils';

describe('copyUtils', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('shareOrCopy', () => {
    it('should return success when clipboard write succeeds', async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      const result = await shareOrCopy('test text', 'Test Title');

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard');
      expect(mockWriteText).toHaveBeenCalledWith('test text');
    });

    it('should handle empty text gracefully', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      const result = await shareOrCopy('', 'Test Title');

      expect(result.success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('');
    });

    it('should return failure when clipboard write fails', async () => {
      const mockWriteText = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      const result = await shareOrCopy('test text', 'Test Title', { fallbackToPrompt: false });

      expect(result.success).toBe(false);
      expect(result.method).toBe('none');
    });
  });
});
