const API_URL = import.meta.env.VITE_API_URL;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// GET /api/v1/sms/users/{token}
export async function getSmsByToken(userToken) {
  const t = String(userToken || "").trim();
  if (!t) throw new Error("Токен пустой");

  const res = await fetch(`${API_URL}/api/v1/sms/users/${encodeURIComponent(t)}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось получить SMS по токену");
  }

  // сервер должен вернуть JSON массив
  const text = await res.text().catch(() => "");
  if (!text) return [];
  return JSON.parse(text);
}
