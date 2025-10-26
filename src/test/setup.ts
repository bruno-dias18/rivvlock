import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock Sentry before any imports
vi.mock('@/lib/sentry', () => ({
  initSentry: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// Mock scrollIntoView (not supported in jsdom)
Element.prototype.scrollIntoView = vi.fn();
// Ensure HTMLElement/SVGElement also have it
// @ts-ignore
window.HTMLElement && (window.HTMLElement.prototype.scrollIntoView = vi.fn());
// @ts-ignore
window.SVGElement && (window.SVGElement.prototype.scrollIntoView = vi.fn());

// Mock IntersectionObserver (not supported in jsdom)
// @ts-ignore
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Stabilize timers-based tests using performance.now
const base = Date.now();
vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - base);

// Mock jsPDF to provide required methods in tests
vi.mock('jspdf', () => {
  const mockDoc = () => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    addPage: vi.fn(),
    setLineWidth: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFillColor: vi.fn(),
    save: vi.fn(),
    getTextWidth: vi.fn().mockReturnValue(100),
    internal: { pageSize: { getWidth: () => 595.28, getHeight: () => 841.89 } },
  });
  return { jsPDF: vi.fn().mockImplementation(mockDoc) };
});
