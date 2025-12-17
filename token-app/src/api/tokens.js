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
  const res = await fetch(`${API_URL}/api/v1/tokens`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось создать токен");
  }

  // 201 может вернуть JSON, но на всякий случай безопасно
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
  
  
  
  // ✅ Привязка агента к токену по имени токена
  export async function bindAgentToToken(agentId, tokenName) {
    const token = getToken();
    const userId = getUserIdFromToken(token);
  
    if (!token) throw new Error("Нет токена. Войдите заново.");
    if (!userId) throw new Error("Не удалось определить userId из JWT.");
    if (!agentId) throw new Error("agentId пустой");
    if (!tokenName) throw new Error("tokenName пустой");
  
    const body = {
      agent_id: agentId,
      token_name: tokenName,
    };
  
    // по описанию: POST /tokens/bind-agent и user_id в (path)
    // значит обычно это: /api/v1/tokens/bind-agent/{user_id}
    const res = await fetch(`${API_URL}/api/v1/tokens/bind-agent/${userId}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Не удалось привязать сервис к токену");
    }
  
    return safeJson(res, null);
  }
  