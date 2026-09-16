// formatters.js — currency, date formatters
export function formatCurrency(amount) {
  return (Number(amount) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// yyyy-mm-dd — what <input type="date"> needs
export function formatDateInput(date) {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 10);
}
