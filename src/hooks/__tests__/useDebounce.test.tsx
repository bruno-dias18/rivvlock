import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 500));
    expect(result.current).toBe('test');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial'); // Still initial

    // Fast-forward time by 500ms
    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should cancel previous timeout on rapid changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    // Rapid changes
    rerender({ value: 'change1' });
    vi.advanceTimersByTime(200);
    
    rerender({ value: 'change2' });
    vi.advanceTimersByTime(200);
    
    rerender({ value: 'final' });
    
    // Only after full delay should we see the final value
    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(result.current).toBe('final');
    });
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce callback execution', async () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    result.current('test1');
    result.current('test2');
    result.current('test3');

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('test3');
    });
  });

  it('should handle multiple arguments', async () => {
    const callback = vi.fn();
    const { result } = renderHook(() => 
      useDebouncedCallback((a: number, b: number) => callback(a, b), 300)
    );

    result.current(1, 2);
    
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith(1, 2);
    });
  });
});
