import { describe, it, expect } from 'vitest';
import {
  calculateRequiredQty,
  calculateShortage,
  calculateEstimatedBuildable,
} from '../server/calcEngine.js';

describe('Calculation Engine (calcEngine.ts)', () => {
  describe('calculateRequiredQty', () => {
    it('should calculate required quantity correctly', () => {
      expect(calculateRequiredQty(10, 2)).toBe(20);
      expect(calculateRequiredQty(5, 0)).toBe(0);
      expect(calculateRequiredQty(0, 5)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(calculateRequiredQty(-5, 2)).toBe(-10);
      expect(calculateRequiredQty(5, -2)).toBe(-10);
    });
  });

  describe('calculateShortage', () => {
    it('should return shortage as Required Qty - Current Stock when stock is insufficient', () => {
      expect(calculateShortage(20, 15)).toBe(5);
      expect(calculateShortage(10, 0)).toBe(10);
    });

    it('should return 0 when current stock is equal to or greater than required quantity', () => {
      expect(calculateShortage(10, 10)).toBe(0);
      expect(calculateShortage(10, 15)).toBe(0);
    });

    it('should handle negative stock by treating it as reducing the available stock (increasing shortage)', () => {
      // Required Qty = 10, Current Stock = -5. Shortage should be 15.
      expect(calculateShortage(10, -5)).toBe(15);
    });

    it('should handle null or undefined stock values', () => {
      // @ts-ignore
      expect(calculateShortage(10, null)).toBe(10); // null coerces to 0
      // @ts-ignore
      expect(isNaN(calculateShortage(10, undefined))).toBe(true); // undefined resolves to NaN
    });
  });

  describe('calculateEstimatedBuildable', () => {
    it('should calculate estimated buildable machines based on limiting component', () => {
      const items = [
        { currentStock: 15, qtyPerMachine: 2 }, // floor(15/2) = 7
        { currentStock: 10, qtyPerMachine: 1 }, // floor(10/1) = 10
        { currentStock: 5, qtyPerMachine: 1 },  // floor(5/1) = 5
      ];
      // The limiting component is the third one, which can build only 5 machines.
      expect(calculateEstimatedBuildable(items, 10)).toBe(5);
    });

    it('should ignore components with qtyPerMachine equal to 0 (avoid division by zero)', () => {
      const items = [
        { currentStock: 15, qtyPerMachine: 2 }, // 7
        { currentStock: 0, qtyPerMachine: 0 },  // ignored
      ];
      expect(calculateEstimatedBuildable(items, 10)).toBe(7);
    });

    it('should return targetBuildQty if there are no valid items or all qtyPerMachine are 0', () => {
      expect(calculateEstimatedBuildable([], 10)).toBe(10);
      expect(calculateEstimatedBuildable([{ currentStock: 100, qtyPerMachine: 0 }], 8)).toBe(8);
    });

    it('should handle negative stock values', () => {
      const items = [
        { currentStock: -5, qtyPerMachine: 2 }, // floor(-5/2) = -3
        { currentStock: 10, qtyPerMachine: 1 },
      ];
      expect(calculateEstimatedBuildable(items, 5)).toBe(-3);
    });

    it('should handle null or undefined stock values gracefully', () => {
      const itemsWithNull = [
        // @ts-ignore
        { currentStock: null, qtyPerMachine: 2 }, // null coerces to 0 -> floor(0/2) = 0
        { currentStock: 10, qtyPerMachine: 1 },
      ];
      expect(calculateEstimatedBuildable(itemsWithNull, 5)).toBe(0);

      const itemsWithUndefined = [
        // @ts-ignore
        { currentStock: undefined, qtyPerMachine: 2 }, // undefined/2 is NaN
        { currentStock: 10, qtyPerMachine: 1 },
      ];
      // NaN compares false to everything, so let's verify behaviour of Math.floor(undefined / 2) which is NaN.
      // JS behavior: NaN < Infinity is false, NaN < minBuildable is false. So it won't overwrite minBuildable if minBuildable is initialized to Infinity.
      // But if it is the first or only item, it would remain Infinity. Let's see what the function returns:
      expect(calculateEstimatedBuildable(itemsWithUndefined, 5)).toBe(10); // because undefined component is ignored due to buildable (NaN) not being less than minBuildable (Infinity or 10)
    });
  });
});
