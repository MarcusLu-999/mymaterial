import { describe, it, expect } from 'vitest';
import { calculateRiskLevel } from '../server/riskEvaluator.js';

describe('Risk Evaluator (riskEvaluator.ts)', () => {
  describe('Low Risk', () => {
    it('should return Low when shortage is 0', () => {
      expect(calculateRiskLevel(0, 10)).toBe('Low');
      expect(calculateRiskLevel(0, 30)).toBe('Low');
      expect(calculateRiskLevel(0, null)).toBe('Low');
      expect(calculateRiskLevel(0, undefined)).toBe('Low');
      expect(calculateRiskLevel(0, 5, '2026-08-01', '2026-07-01')).toBe('Low');
    });
  });

  describe('Medium Risk', () => {
    it('should return Medium when shortage > 0 and leadTime <= 15 (without shipping date past deadline)', () => {
      expect(calculateRiskLevel(5, 10)).toBe('Medium');
      expect(calculateRiskLevel(1, 15)).toBe('Medium');
      expect(calculateRiskLevel(10, 5, '2026-07-15', '2026-07-20')).toBe('Medium');
    });

    it('should return Medium when shipping date is exactly equal to deadline and leadTime <= 15', () => {
      expect(calculateRiskLevel(5, 10, '2026-07-15', '2026-07-15')).toBe('Medium');
    });
  });

  describe('High Risk', () => {
    it('should return High when shortage > 0 and leadTime > 15', () => {
      expect(calculateRiskLevel(5, 16)).toBe('High');
      expect(calculateRiskLevel(1, 30)).toBe('High');
    });

    it('should return High when shortage > 0 and leadTime is null, undefined, or NaN', () => {
      expect(calculateRiskLevel(5, null)).toBe('High');
      expect(calculateRiskLevel(5, undefined)).toBe('High');
      expect(calculateRiskLevel(5, NaN)).toBe('High');
    });

    it('should return High when shortage > 0 and shipping date is strictly after project deadline', () => {
      expect(calculateRiskLevel(5, 10, '2026-07-16', '2026-07-15')).toBe('High');
      expect(calculateRiskLevel(1, 1, '2026-10-01', '2026-09-30')).toBe('High');
    });

    it('should return Medium when shortage > 0, leadTime <= 15, and shipping/deadline dates are invalid or missing', () => {
      expect(calculateRiskLevel(5, 10, 'invalid-date', '2026-07-15')).toBe('Medium');
      expect(calculateRiskLevel(5, 10, '2026-07-16', 'invalid-date')).toBe('Medium');
      expect(calculateRiskLevel(5, 10, undefined, '2026-07-15')).toBe('Medium');
      expect(calculateRiskLevel(5, 10, '2026-07-16', undefined)).toBe('Medium');
    });
  });
});
