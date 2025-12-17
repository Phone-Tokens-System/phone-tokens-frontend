import { useMemo, useState } from "react";
import "./ConfirmModal.css";
import { updateTokenPermissionsMock, unbindAgentMock } from "../api/tokens";


const TTL_OPTIONS = [
  { label: "1 день", seconds: 86400 },
  { label: "7 дней", seconds: 7 * 86400 },
  { label: "30 дней", seconds: 30 * 86400 },
  { label: "90 дней", seconds: 90 * 86400 },
];

export default function TokenManageModal({
  token,
  onClose,
  onDelete,
  onUpdateTTL,
  onUpdatePermissions,
  onUnbindService,
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [ttlSeconds, setTtlSeconds] = useState(TTL_OPTIONS[2].seconds); // по умолчанию 30д
  const [permSms, setPermSms] = useState(token?.permissions?.includes("sms") ?? false);
  const [permCalls, setPermCalls] = useState(token?.permissions?.includes("calls") ?? false);

  const boundService = token?.agent_id || "—";
  const permsText = useMemo(() => {
    const p = Array.isArray(token?.permissions) ? token.permissions : [];
    return p.length ? p.join(", ") : "—";
  }, [token]);

  async function saveTTL() {
    try {
      setSaving(true);
      setErr("");
      await onUpdateTTL?.(token.id, ttlSeconds);
    } catch (e) {
      setErr(e?.message || "Ошибка при обновлении TTL");
    } finally {
      setSaving(false);
    }
  }

  async function savePerms() {
    try {
      setSaving(true);
      setErr("");
      const permissions = [];
      if (permSms) permissions.push("sms");
      if (permCalls) permissions.push("calls");
      await onUpdatePermissions?.(token.id, permissions);
    } catch (e) {
      setErr(e?.message || "Ошибка при обновлении permissions");
    } finally {
      setSaving(false);
    }
  }

  async function removeService() {
    try {
      setSaving(true);
      setErr("");
      await onUnbindService?.(token);
    } catch (e) {
      setErr(e?.message || "Ошибка при удалении сервиса");
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Токен: {token.name || "—"}</h3>

        <div style={{ display: "grid", gap: 8 }}>
          <div><strong>ID:</strong> {token.id || "—"}</div>
          <div><strong>Статус:</strong> {token.status || "—"}</div>
          <div><strong>Истекает:</strong> {token.expires_at || "Бессрочно / неизвестно"}</div>
          <div><strong>Permissions:</strong> {permsText}</div>
          <div><strong>Привязанный сервис (agent_id):</strong> {boundService}</div>

          <div>
            <strong>Token:</strong>
            <pre style={{
              marginTop: 6, padding: 8, borderRadius: 6,
              background: "rgba(0,0,0,0.08)",
              maxHeight: 120, overflow: "auto", wordBreak: "break-all"
            }}>
              {token.token || "—"}
            </pre>
          </div>
        </div>

        <hr style={{ margin: "14px 0" }} />

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <strong>Изменить время жизни</strong>
            <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
              <select
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(Number(e.target.value))}
                disabled={saving}
              >
                {TTL_OPTIONS.map((o) => (
                  <option key={o.seconds} value={o.seconds}>{o.label}</option>
                ))}
              </select>
              <button onClick={saveTTL} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить TTL"}
              </button>
            </div>
          </div>

          <div>
            <strong>Изменить разрешения</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={permSms}
                  onChange={(e) => setPermSms(e.target.checked)}
                  disabled={saving}
                />
                SMS
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={permCalls}
                  onChange={(e) => setPermCalls(e.target.checked)}
                  disabled={saving}
                />
                Calls
              </label>

              <button onClick={savePerms} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить permissions"}
              </button>
            </div>
          </div>

          <div>
            <strong>Сервис</strong>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={removeService} disabled={saving || !token.agent_id}>
                Удалить сервис
              </button>
            </div>
          </div>

          {err && <div style={{ color: "red" }}>{err}</div>}
        </div>

        <div className="modal-buttons" style={{ marginTop: 14 }}>
          <button className="danger" onClick={() => onDelete?.(token.id)} disabled={saving}>
            Удалить токен
          </button>
          <button onClick={onClose} disabled={saving}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
