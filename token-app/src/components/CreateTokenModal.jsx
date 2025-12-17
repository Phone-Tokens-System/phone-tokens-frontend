import { useMemo, useState } from "react";
import "./ConfirmModal.css"; 

const TTL_OPTIONS = [
  { label: "1 день", value: "1d", seconds: 86400 },
  { label: "7 дней", value: "7d", seconds: 7 * 86400 },
  { label: "30 дней", value: "30d", seconds: 30 * 86400 },
  { label: "90 дней", value: "90d", seconds: 90 * 86400 },
  { label: "Бессрочно", value: "forever", seconds: null }, 
];

export default function CreateTokenModal({ onClose, onSubmit, loading }) {
  const [name, setName] = useState("");
  const [ttl, setTtl] = useState("30d");
  const [permSms, setPermSms] = useState(true);
  const [permCalls, setPermCalls] = useState(false);
  const [serviceId, setServiceId] = useState(""); 

  const ttlSeconds = useMemo(() => {
    return TTL_OPTIONS.find((o) => o.value === ttl)?.seconds ?? null;
  }, [ttl]);

  function handleSubmit(e) {
    e.preventDefault();

    const permissions = [];
    if (permSms) permissions.push("sms");
    if (permCalls) permissions.push("calls");

    const req = {
      name: name.trim(),
      permissions,
      // ttl_seconds отправляем только если не "бессрочно"
      ...(ttlSeconds != null ? { ttl_seconds: ttlSeconds } : {}),
      // swagger createTokenRequest НЕ содержит service_id/agent_id,
      // поэтому serviceId пока просто в UI (для девелопмента).
      // serviceId,
    };

    onSubmit?.(req, serviceId.trim() || null);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Создать токен</h3>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label><strong>Название токена</strong></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: marketing-sms"
              style={{ width: "100%", marginTop: 6 }}
              required
            />
          </div>

          <div>
            <label><strong>Время жизни</strong></label>
            <select
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              style={{ width: "100%", marginTop: 6 }}
            >
              {TTL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label><strong>Разрешения (scopes)</strong></label>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={permSms}
                  onChange={(e) => setPermSms(e.target.checked)}
                />
                SMS
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={permCalls}
                  onChange={(e) => setPermCalls(e.target.checked)}
                />
                Calls
              </label>
            </div>
          </div>

          <div>
            <label><strong>Привязанный сервис (dev)</strong></label>
            <input
              type="text"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="ID сервиса/агента (для разработки)"
              style={{ width: "100%", marginTop: 6 }}
            />
          </div>

          <div className="modal-buttons">
            <button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Создание..." : "Создать"}
            </button>
            <button type="button" onClick={onClose} disabled={loading}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
