export function maskSensitiveValue(value, options = {}) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '-';
  }

  const visibleStart = Number.isFinite(options.visibleStart) ? options.visibleStart : 8;
  const visibleEnd = Number.isFinite(options.visibleEnd) ? options.visibleEnd : 6;
  const compact = normalized.replace(/\s+/g, '');

  if (compact.length <= visibleStart + visibleEnd + 3) {
    return compact;
  }

  return `${compact.slice(0, visibleStart)}...${compact.slice(-visibleEnd)}`;
}

export async function copySensitiveValue(value) {
  const text = String(value || '');
  if (!text) {
    return false;
  }

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}
