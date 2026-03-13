export function calculateTotals(items: number[]) {
  var sum = 0;
  var count = items.length;
  var average = 0;

  for (var i = 0; i < count; i++) {
    var item = items[i];
    sum += item;
  }

  if (count > 0) {
    var average = sum / count;
  }

  var result = {
    sum: sum,
    count: count,
    average: average,
  };

  return result;
}
