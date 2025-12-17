import "./ConfirmModal.css";

export default function TokenDetailsModal({ token, onClose }) {
  if (!token) return null;

  const permissions =
    Array.isArray(token.permissions) && token.permissions.length > 0
      ? token.permissions
      : [];

  const boundService = token.agent_id || null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Детали токена</h3>

        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <strong>Название:</strong> {token.name || "—"}
          </div>

          <div>
            <strong>ID:</strong> {token.id || "—"}
          </div>

          <div>
            <strong>Статус:</strong> {token.status || "—"}
          </div>

          <div>
            <strong>Истекает:</strong> {token.expires_at || "Бессрочно"}
          </div>

          <div>
            <strong>Разрешения:</strong>{" "}
            {permissions.length > 0 ? permissions.join(", ") : "—"}
          </div>

          <div>
            <strong>Привязанный сервис:</strong>{" "}
            {boundService ? boundService : "—"}
          </div>

          <div>
            <strong>Токен:</strong>
            <pre
              style={{
                marginTop: 6,
                padding: 8,
                background: "rgba(0,0,0,0.1)",
                borderRadius: 6,
                maxHeight: 120,
                overflow: "auto",
                wordBreak: "break-all",
              }}
            >
              {token.token || "—"}
            </pre>
          </div>
        </div>

        <div className="modal-buttons">
          <button onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
