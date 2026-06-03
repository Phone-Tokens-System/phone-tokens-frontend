export const AGENT_CERTIFICATES_KEY = 'pt_frontend_agent_certificates';

function normalizeCertificateItem(item) {
  const certificate = String(item?.certificate || '').trim();
  if (!certificate) {
    return null;
  }

  const id = String(item?.id || '').trim() || `cert-${Date.now()}`;
  const label = String(item?.label || '').trim() || id;

  return {
    id,
    label,
    certificate,
    agentId: String(item?.agentId || '').trim(),
    createdAt: String(item?.createdAt || '').trim() || new Date().toISOString(),
  };
}

export function readAgentCertificates(agentId = '') {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(AGENT_CERTIFICATES_KEY) || '[]');
    const normalizedAgentId = String(agentId || '').trim();
    return Array.isArray(parsed)
      ? parsed
        .map(normalizeCertificateItem)
        .filter(Boolean)
        .filter((item) => !normalizedAgentId || !item.agentId || item.agentId === normalizedAgentId)
      : [];
  } catch {
    return [];
  }
}

export function saveAgentCertificate(item) {
  if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
    return [];
  }

  const normalized = normalizeCertificateItem(item);
  if (!normalized) {
    return readAgentCertificates();
  }

  const existing = readAgentCertificates();
  const next = [
    normalized,
    ...existing.filter((stored) => stored.id !== normalized.id && stored.certificate !== normalized.certificate),
  ].slice(0, 20);

  localStorage.setItem(AGENT_CERTIFICATES_KEY, JSON.stringify(next));
  return next;
}

export function extractSignedCertificate(payload) {
  if (typeof payload === 'string') {
    return {
      certificate: payload,
      csrId: '',
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      certificate: '',
      csrId: '',
    };
  }

  return {
    certificate: String(payload.certificate || payload.Certificate || '').trim(),
    csrId: String(payload.csr_id ?? payload.csrId ?? payload.CsrId ?? '').trim(),
  };
}

export function saveSignedAgentCertificate(payload, agentId = '') {
  const signed = extractSignedCertificate(payload);
  if (!signed.certificate) {
    return null;
  }

  const item = {
    id: signed.csrId ? `csr-${signed.csrId}` : `cert-${Date.now()}`,
    label: signed.csrId ? `CSR #${signed.csrId}` : 'Подписанный сертификат',
    certificate: signed.certificate,
    agentId,
    createdAt: new Date().toISOString(),
  };

  saveAgentCertificate(item);
  return item;
}
