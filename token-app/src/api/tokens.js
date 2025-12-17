const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem("token") || "";
}

function authHeaders() {
  const token = getToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function safeJson(res, fallback) {
  const text = await res.text().catch(() => "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}



export async function getMyTokens() {
  const token = getToken();
  const userId = getUserIdFromToken(token);

  const res = await fetch(`${API_URL}/api/v1/users/${userId}/tokens`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось получить токены");
  }

  return safeJson(res, []); // <- чтобы не было JSON.parse ошибки
}

export async function createToken(request) {
  const cleaned = Object.fromEntries(
    Object.entries(request || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

  const res = await fetch(`${API_URL}/api/v1/tokens`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(cleaned),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось создать токен");
  }

  return safeJson(res, null);
}


export async function deleteToken(tokenId) {
  const res = await fetch(`${API_URL}/api/v1/tokens/${tokenId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось удалить токен");
  }
}
function getUserIdFromToken(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload?.sub || "";
    } catch {
      return "";
    }
  }
  
  
  
  export async function bindAgentToToken(agentId, tokenName) {
    const a = (agentId || "").trim();
    const n = (tokenName || "").trim();
  
    if (!a) throw new Error("agent_id пустой");
    if (!n) throw new Error("token_name пустой");
  
    const res = await fetch(`${API_URL}/api/v1/tokens/bing-agent`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ agent_id: a, token_name: n }),
    });
  
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Не удалось привязать сервис");
    }
    return safeJson(res, null);
  }
  
  
  
  export async function updateTokenTTL(tokenId, ttlSeconds) {
    const res = await fetch(`${API_URL}/api/v1/tokens/${tokenId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ ttl_seconds: ttlSeconds }),
    });
  
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Не удалось обновить TTL");
    }
  
    return safeJson(res, null);
  }
  
  function readTokensCache() {
    try {
      const raw = localStorage.getItem("tokens_cache");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  
  function writeTokensCache(tokens) {
    localStorage.setItem("tokens_cache", JSON.stringify(tokens || []));
  }
  
  function upsertTokenInCache(updated) {
    const list = readTokensCache();
    const idx = list.findIndex((t) => t.id === updated.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...updated };
    else list.unshift(updated);
    writeTokensCache(list);
    return list;
  }
  export async function updateTokenPermissionsMock(tokenId, permissions) {
    const list = readTokensCache();
    const token = list.find((t) => t.id === tokenId);
  
    if (!token) throw new Error("Токен не найден в локальном кэше");
  
    const updated = {
      ...token,
      permissions: Array.isArray(permissions) ? permissions : [],
    };
  
    upsertTokenInCache(updated);
    return updated;
  }
  
  
  export async function unbindAgentMock(tokenId) {
    const list = readTokensCache();
    const token = list.find((t) => t.id === tokenId);
  
    if (!token) throw new Error("Токен не найден в локальном кэше");
  
    const updated = {
      ...token,
      agent_id: "", // или null — как тебе удобнее. Я делаю "" чтобы не ломать типы
    };
  
    upsertTokenInCache(updated);
    return updated;
  }
  