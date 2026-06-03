const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();

  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  const looksLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));

  if (!looksLikeJson) {
    return text;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

export async function request(path, options = {}) {
  const {
    method = 'GET',
    token,
    body,
    headers = {},
  } = options;

  const requestHeaders = new Headers(headers);
  let payload = body;

  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    requestHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const responseData = await parseResponseBody(response);

  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`;
    const message =
      typeof responseData === 'string'
        ? responseData
        : responseData?.message || responseData?.error || fallbackMessage;

    throw new ApiError(message, response.status, responseData);
  }

  return responseData;
}

async function requestWithFallback(paths, options) {
  let lastError;

  for (const path of paths) {
    try {
      return await request(path, options);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('No API endpoint responded');
}

export async function login(payload) {
  return request('/api/v1/login', {
    method: 'POST',
    body: payload,
  });
}

export async function register(payload) {
  return request('/api/v1/register', {
    method: 'POST',
    body: payload,
  });
}

export async function getCurrentUser(token) {
  return request('/api/v1/me', { token });
}

export async function createCsrRequest(token, payload) {
  try {
    return await request('/api/v1/csr', {
      method: 'POST',
      token,
      body: payload,
    });
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }

    const formData = new FormData();
    formData.append('email', payload.email);
    formData.append('csr', new Blob([payload.csr], { type: 'text/plain' }), 'request.csr');

    return request('/api/v1/csr/upload', {
      method: 'POST',
      token,
      body: formData,
    });
  }
}

export async function getSignedCertificate(token, csrId) {
  return requestWithFallback(
    [`/api/v1/csr/${csrId}`, `/api/v1/csr/signed?id=${encodeURIComponent(csrId)}`],
    { token },
  );
}

export async function getCurrentSignedCertificate(token) {
  return request('/api/v1/csr/signed/current', { token });
}

export async function getAdminPing(token) {
  return request('/api/v1/admin/ping', { token });
}

export async function getAdminCsrRequests(token) {
  return request('/api/v1/admin/csr', { token });
}

export async function approveAdminCsrRequest(token, csrId) {
  const normalizedId = String(csrId || '').trim();
  if (!normalizedId) {
    throw new ApiError('csr_id is required', 400, null);
  }

  return requestWithFallback(
    [
      `/api/v1/admin/csr/approve/${encodeURIComponent(normalizedId)}?id=${encodeURIComponent(normalizedId)}`,
      `/api/v1/admin/csr/approve/${encodeURIComponent(normalizedId)}`,
    ],
    {
      method: 'POST',
      token,
    },
  );
}

export async function getAdminSmsLogs(token) {
  return request('/api/v1/sms/logs', { token });
}

export async function refreshAdminSmsFromProvider(token) {
  return request('/api/v1/sms/all', { token });
}

export async function getSmsLogsByAgent(token, agentId) {
  return request(`/api/v1/sms/agents/${encodeURIComponent(agentId)}`, { token });
}

export async function getSmsLogsByToken(token, clientToken) {
  return request(`/api/v1/sms/users/${encodeURIComponent(clientToken)}`, { token });
}

export async function getUserProfileFilters(token) {
  return requestWithFallback(
    ['/api/v1/user-profile/filters', '/api/v1/userprofile/filters'],
    { token },
  );
}

export async function getMyUserProfile(token) {
  return request('/api/v1/user-profile/me', { token });
}

export async function createMyUserProfile(token, payload) {
  return request('/api/v1/user-profile', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateMyUserProfile(token, payload) {
  return request('/api/v1/user-profile', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function getAgentUserProfilesFiltered(token, payload) {
  return request('/api/v1/agents/tokens/user-profile/filtered', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function sendSms(token, payload) {
  return request('/api/v1/sms/send', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function sendSmsFiltered(token, payload) {
  return request('/api/v1/sms/send_filtered', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function getBalance(token, agentId) {
  const normalizedAgentId = String(agentId || '').trim();
  if (!normalizedAgentId) {
    throw new ApiError('agent_id is required', 400, null);
  }

  return request(`/api/v1/billing/${encodeURIComponent(normalizedAgentId)}/balance`, { token });
}

export async function createBalanceTopUp(token, payload) {
  return request('/api/v1/billing/balance', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function completeSso(token, payload) {
  return request('/api/v1/sso/complete', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function getTokensByUser(token, userId) {
  return request(`/api/v1/users/${encodeURIComponent(userId)}/tokens`, { token });
}

export async function getTokensByAgent(token, agentId) {
  return request(`/api/v1/agents/${encodeURIComponent(agentId)}/tokens`, { token });
}

export async function createUserToken(token, payload) {
  return request('/api/v1/tokens', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateUserTokenTTL(token, tokenId, ttlSeconds) {
  return request(`/api/v1/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'PATCH',
    token,
    body: { ttl_seconds: ttlSeconds },
  });
}

export async function freezeUserToken(token, tokenId) {
  return request(`/api/v1/tokens/${encodeURIComponent(tokenId)}/freeze`, {
    method: 'PATCH',
    token,
  });
}

export async function unfreezeUserToken(token, tokenId) {
  return request(`/api/v1/tokens/${encodeURIComponent(tokenId)}/unfreeze`, {
    method: 'PATCH',
    token,
  });
}

export async function deleteUserToken(token, tokenId) {
  return request(`/api/v1/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
    token,
  });
}

export async function getDictionaryCountries() {
  return request('/api/v1/dictionary/countries');
}

export async function getDictionaryRegions(countryId) {
  return request(`/api/v1/dictionary/regions?country=${encodeURIComponent(countryId)}`);
}

export async function getDictionaryCities(countryId, regionId) {
  return request(
    `/api/v1/dictionary/cities?country=${encodeURIComponent(countryId)}&region=${encodeURIComponent(regionId)}`,
  );
}
