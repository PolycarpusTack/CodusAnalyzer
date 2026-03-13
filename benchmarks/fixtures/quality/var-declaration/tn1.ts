export function calculateTotals(items: number[]) {
  let sum = 0;
  const count = items.length;

  for (let i = 0; i < count; i++) {
    const item = items[i];
    sum += item;
  }

  const average = count > 0 ? sum / count : 0;

  const result = {
    sum,
    count,
    average,
  };

  return result;
}
