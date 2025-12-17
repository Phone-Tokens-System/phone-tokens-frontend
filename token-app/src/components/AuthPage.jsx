import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AuthPage.css";

const API_URL = import.meta.env.VITE_API_URL;

function normalizeDigits(input) {
  let d = String(input || "").replace(/\D/g, "");

  // если пользователь начал с 8 -> делаем 7
  if (d.startsWith("8")) d = "7" + d.slice(1);

  // если пользователь начал без 7, добавим 7
  if (d && !d.startsWith("7")) d = "7" + d;

  // максимум 11 цифр: 7 + 10
  return d.slice(0, 11);
}

function formatPhoneRUFromDigits(digits11) {
  const d = normalizeDigits(digits11);
  const ten = d.startsWith("7") ? d.slice(1) : d; // последние 10

  const a = ten.slice(0, 3);
  const b = ten.slice(3, 6);
  const c = ten.slice(6, 8);
  const e = ten.slice(8, 10);

  let out = "+7";
  if (a) out += ` (${a}`;
  if (a.length === 3) out += ")";
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (e) out += `-${e}`;
  return out;
}

function phoneToApiFromDigits(digits11) {
  const d = normalizeDigits(digits11);
  return d.length === 11 ? `+${d}` : "";
}


export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState(""); // храним только цифры

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const apiPhone = phoneToApiFromDigits(phoneDigits);
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
              value={formatPhoneRUFromDigits(phoneDigits)}
              onChange={(e) => setPhoneDigits(normalizeDigits(e.target.value))}
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
