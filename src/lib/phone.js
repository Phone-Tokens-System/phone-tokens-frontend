export function normalizeRuPhone(input) {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `7${digits}`;
  }

  return '';
}

export function isValidRuPhone(input) {
  return Boolean(normalizeRuPhone(input));
}
