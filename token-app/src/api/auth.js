const API_BASE = "/api/v1";

export async function registerUser(phone, password) {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      password,
      role: "user"
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Ошибка регистрации");
  }

  return res.json();
}

export async function loginUser(phone, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Ошибка логина");
  }

  const data = await res.json();
  localStorage.setItem("jwt", data.token); // сохраняем токен
  return data;
}
