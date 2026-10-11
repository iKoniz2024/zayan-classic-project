export function convertToBDT(amount) {
  const numericAmount = Number(amount ?? 0);
  return Number.isFinite(numericAmount) ? numericAmount : 0;
}

export function formatBDT(amount) {
  const numericAmount = convertToBDT(amount);
  const hasDecimals = !Number.isInteger(numericAmount);
  return `৳${numericAmount.toLocaleString("en-BD", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
