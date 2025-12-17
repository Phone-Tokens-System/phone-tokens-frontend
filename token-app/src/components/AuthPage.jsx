import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AuthPage.css";

const API_URL = import.meta.env.VITE_API_URL;

function formatPhoneRU(value) {
    const digits = String(value || "").replace(/\D/g, "");
    let d = digits;

    if (d.startsWith("7")) d = d.slice(1);
    d = d.slice(0, 10);

    const a = d.slice(0, 3);
    const b = d.slice(3, 6);
    const c = d.slice(6, 8);
    const e = d.slice(8, 10);

    if (!digits) return ""; // если ничего нет — пусто

    let out = "+7"; // только если есть цифры
    if (a) out += ` (${a}`;
    if (a.length === 3) out += ")";
    if (b) out += ` ${b}`;
    if (c) out += `-${c}`;
    if (e) out += `-${e}`;

    return out;
}


function phoneToApi(masked) {
  const digits = String(masked || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return last10.length === 10 ? `7${last10}` : "";
}

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const apiPhone = phoneToApi(phone);
    if (!apiPhone) {
      setLoading(false);
      setError("Введите номер полностью");
      return;
    }

    const payload = isRegister
      ? { phone: apiPhone, password, role: "user", email: null, service_name: null }
      : { phone: apiPhone, password };

    try {
      const res = await fetch(`${API_URL}/api/v1/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => "");
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        const msg = data?.message || (typeof data === "object" ? Object.values(data)[0] : "") || "Ошибка";
        throw new Error(msg);
      }

      if (!isRegister) {
        if (data?.token) localStorage.setItem("token", data.token);
        navigate("/tokens");
      } else {
        setIsRegister(false);
        setPassword("");
      }
    } catch (err) {
      setError(err?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container auth-like-tokens">
      <h1>{isRegister ? "Регистрация" : "Вход"}</h1>

      <div className="token-card auth-card">
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="skew-field">
            <div className="skew-bg" />
            <input
              className="skew-input"
              type="text"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => setPhone(formatPhoneRU(e.target.value))}
              maxLength={18}
              required
            />
          </div>

          <div className="skew-field">
            <div className="skew-bg" />
            <input
              className="skew-input"
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <div className="buttons">
            <button type="submit" disabled={loading}>
              {loading ? "Загрузка..." : isRegister ? "Создать аккаунт" : "Войти"}
            </button>

            <button
              type="button"
              className="danger"
              onClick={() => {
                setError("");
                setIsRegister((v) => !v);
              }}
              disabled={loading}
            >
              {isRegister ? "Перейти ко входу" : "Регистрация"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
