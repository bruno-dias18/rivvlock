/**
 * Mock Sentry functions for testing
 * Prevents Sentry calls in test environment
 */
import { vi } from 'vitest';

export const mockSentry = {
  captureException: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  init: vi.fn(),
};

vi.mock('@/lib/sentry', () => ({
  initSentry: vi.fn(),
  captureException: mockSentry.captureException,
  setUser: mockSentry.setUser,
  addBreadcrumb: mockSentry.addBreadcrumb,
}));
