export function calculateRiskLevel(
  shortage: number,
  leadTime: number | null | undefined,
  shippingDate?: string,
  deadline?: string
): 'Low' | 'Medium' | 'High' {
  if (shortage > 0) {
    if (leadTime === null || leadTime === undefined || isNaN(leadTime)) {
      return 'High';
    }
    let pastDeadline = false;
    if (shippingDate && deadline) {
      const ship = new Date(shippingDate);
      const dead = new Date(deadline);
      if (ship > dead) {
        pastDeadline = true;
      }
    }
    return (leadTime > 15 || pastDeadline) ? 'High' : 'Medium';
  }
  return 'Low';
}

