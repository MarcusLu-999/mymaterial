/**
 * Calculates the required quantity for a component.
 * Required Qty = Target Build Qty * Qty per Machine
 */
export function calculateRequiredQty(targetBuildQty: number, qtyPerMachine: number): number {
  return targetBuildQty * qtyPerMachine;
}

/**
 * Calculates the shortage for a component.
 * Shortage = Max(0, Required Qty - Current Stock)
 */
export function calculateShortage(requiredQty: number, currentStock: number): number {
  return Math.max(0, requiredQty - currentStock);
}

interface CalcBuildableItem {
  currentStock: number;
  qtyPerMachine: number;
}

/**
 * Calculates the estimated buildable machines across all components.
 * Estimated Buildable Machines = Min(Floor(Current Stock / Qty per Machine)) across all components.
 * If Qty per Machine is 0, do not divide by 0 (ignore this item).
 * If no items or all have 0 qty, return targetBuildQty.
 */
export function calculateEstimatedBuildable(
  items: CalcBuildableItem[],
  targetBuildQty: number
): number {
  let minBuildable = Infinity;
  let hasValidItem = false;

  for (const item of items) {
    if (item.qtyPerMachine > 0) {
      const buildable = Math.floor(item.currentStock / item.qtyPerMachine);
      if (buildable < minBuildable) {
        minBuildable = buildable;
      }
      hasValidItem = true;
    }
  }

  if (!hasValidItem) {
    return targetBuildQty;
  }

  return minBuildable;
}
