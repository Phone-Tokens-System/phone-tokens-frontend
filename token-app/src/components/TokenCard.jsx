export default function TokenCard({ token, onDelete, onDetails, onActivity }) {
    const perms =
      Array.isArray(token?.permissions) && token.permissions.length
        ? token.permissions.join(", ")
        : "—";
  
    const boundService =
      Array.isArray(token?.services) && token.services.length
        ? token.services.join(", ")
        : token?.agent_id
        ? token.agent_id
        : "—";
  
    return (
      <div className="token-card">
        <div className="token-row">
          <strong>{token?.name || "Без названия"}</strong>
          <span>{token?.status || "—"}</span>
        </div>
  
        <div className="token-meta">
          <div>Permissions: {perms}</div>
          <div>Service: {boundService}</div>
          <div>Expires: {token?.expires_at || "—"}</div>
        </div>
  
        <div className="buttons">
          <button onClick={onDetails}>Подробнее</button>
          <button onClick={onActivity}>History</button>

          <button className="danger" onClick={() => onDelete?.(token.id)}>
            Удалить
          </button>
        </div>
      </div>
    );
  }
  