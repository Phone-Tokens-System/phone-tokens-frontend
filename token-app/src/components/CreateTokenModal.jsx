import { useMemo, useState } from "react";
import "./ConfirmModal.css";

const TTL_OPTIONS = [
  { label: "1 день", value: "1d", seconds: 86400 },
  { label: "7 дней", value: "7d", seconds: 7 * 86400 },
  { label: "30 дней", value: "30d", seconds: 30 * 86400 },
  { label: "90 дней", value: "90d", seconds: 90 * 86400 },
];

const isUUID = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export default function CreateTokenModal({ onClose, onSubmit, loading }) {
  const [name, setName] = useState("");
  const [ttl, setTtl] = useState("30d");
  const [permSms, setPermSms] = useState(true);
  const [permCalls, setPermCalls] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [err, setErr] = useState("");

  const ttlSeconds = useMemo(() => {
    return TTL_OPTIONS.find((o) => o.value === ttl)?.seconds ?? 30 * 86400;
  }, [ttl]);

  function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    const agentId = serviceId.trim();
    if (!agentId) {
      setErr("Укажи ID сервиса (agent_id). Сейчас на бэке он обязателен.");
      return;
    }
    if (!isUUID(agentId)) {
      setErr("agent_id должен быть UUID (например: e18f2584-3b88-4bac-b881-81463756d5a7)");
      return;
    }

    const permissions = [];
    if (permSms) permissions.push("sms");
    if (permCalls) permissions.push("calls");

    const req = {
      name: name.trim(),
      permissions,
      ttl_seconds: ttlSeconds,
      agent_id: agentId,
    };

    onSubmit?.(req);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Создать токен</h3>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label><strong>Название токена</strong></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
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
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label><strong>Разрешения</strong></label>
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
            <label><strong>ID сервиса (agent_id, UUID)</strong></label>
            <input
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="e18f2584-3b88-4bac-b881-81463756d5a7"
              style={{ width: "100%", marginTop: 6 }}
              required
            />
          </div>

          {err && <p style={{ color: "red", margin: 0 }}>{err}</p>}

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
