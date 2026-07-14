import { describe, it, expect } from 'vitest';

describe('Sanity Test Suite', () => {
  it('should verify basic math operations', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify environment check', () => {
    expect(true).toBe(true);
  });
});
