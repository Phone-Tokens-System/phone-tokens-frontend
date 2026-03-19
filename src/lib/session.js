import { computed, reactive } from 'vue';

const TOKEN_KEY = 'pt_frontend_token';
const AGENT_ID_KEY = 'pt_frontend_agent_id';

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

function decodeJwtClaims(token) {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = decodeBase64Url(parts[1]);
    const claims = JSON.parse(payload);
    return {
      userId: typeof claims.sub === 'string' ? claims.sub : '',
      phone: typeof claims.phone === 'string' ? claims.phone : '',
      role: typeof claims.role === 'string' ? claims.role : '',
      exp: typeof claims.exp === 'number' ? claims.exp : 0,
    };
  } catch (error) {
    return null;
  }
}

export const sessionState = reactive({
  token: localStorage.getItem(TOKEN_KEY) || '',
  agentId: localStorage.getItem(AGENT_ID_KEY) || '',
  claims: null,
});

sessionState.claims = decodeJwtClaims(sessionState.token);

export const isAuthenticated = computed(() => Boolean(sessionState.token));
export const isAgent = computed(() => sessionState.claims?.role === 'agent');

export function setToken(token) {
  sessionState.token = token;
  sessionState.claims = decodeJwtClaims(token);

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearSession() {
  sessionState.token = '';
  sessionState.claims = null;
  sessionState.agentId = '';

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AGENT_ID_KEY);
}

export function setAgentId(agentId) {
  sessionState.agentId = agentId.trim();
  if (sessionState.agentId) {
    localStorage.setItem(AGENT_ID_KEY, sessionState.agentId);
  } else {
    localStorage.removeItem(AGENT_ID_KEY);
  }
}
