import { useEffect, useState } from "react";
import { getMyTokens, deleteToken, createToken, bindAgentToToken } from "../api/tokens";
import TokenManageModal from "../components/TokenManageModal";
import { updateTokenTTL } from "../api/tokens";
import { updateTokenPermissionsMock, unbindAgentMock } from "../api/tokens";

import TokenCard from "../components/TokenCard";
import TokenDetailsModal from "../components/TokenDetailsModal";
import TokenActivityModal from "../components/TokenActivityModal";
import ConfirmModal from "../components/ConfirmModal";
import CreateTokenModal from "../components/CreateTokenModal";

export default function MyTokensPage() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedToken, setSelectedToken] = useState(null);
  const [activityToken, setActivityToken] = useState(null);
  const [deleteTokenId, setDeleteTokenId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    localStorage.setItem("tokens_cache", JSON.stringify(tokens));
  }, [tokens]);

  async function fetchTokens() {
    try {
      setLoading(true);
      setError("");
  
      const data = await getMyTokens();
  
      // если бек реально вернул массив токенов
      if (Array.isArray(data) && data.length > 0) {
        setTokens(data);
        localStorage.setItem("tokens_cache", JSON.stringify(data));
        return;
      }
  
      // ⚠️ бек вернул пусто (200 + Content-Length: 0)
      const cached = JSON.parse(localStorage.getItem("tokens_cache") || "[]");
      setTokens(cached);
    } catch (err) {
      // если запрос упал — тоже пробуем кэш
      const cached = JSON.parse(localStorage.getItem("tokens_cache") || "[]");
      setTokens(cached);
      setError(err?.message || "Ошибка при загрузке токенов");
    } finally {
      setLoading(false);
    }
  }
  

  useEffect(() => {
    fetchTokens();
  }, []);

  function requestDelete(id) {
    setDeleteTokenId(id);
  }

  async function confirmDelete() {
    const id = deleteTokenId;
    if (!id) return;

    try {
      await deleteToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert(e?.message || "Ошибка при удалении токена");
    } finally {
      setDeleteTokenId(null);
    }
  }

  async function handleCreateToken(req, serviceId) {
    try {
      setCreating(true);
      const created = await createToken(req);
  
      
      if (serviceId) {
        const bound = await bindAgentToToken(serviceId, req.name);
  
        if (bound && typeof bound === "object") {
          setTokens((prev) => {
            const idx = prev.findIndex((t) => t.id === bound.id || t.name === bound.name);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = bound;
              return copy;
            }
            return [bound, ...prev];
          });
        } else {
          await fetchTokens();
        }
      } else {
        // без привязки — просто обновим UI
        if (created && typeof created === "object") {
          setTokens((prev) => [created, ...prev]);
        } else {
          await fetchTokens();
        }
      }
  
      setCreateOpen(false);
    } catch (e) {
      alert(e?.message || "Ошибка при создании/привязке токена");
    } finally {
      setCreating(false);
    }
  }
  

  if (loading) return <p>Загрузка токенов...</p>;

  if (error) {
    return (
      <div className="container">
        <h1>Мои токены</h1>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={fetchTokens}>Повторить</button>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Мои токены</h1>
        <button onClick={() => setCreateOpen(true)}>Создать токен</button>
        <button
  type="button"
  onClick={() => window.open("http://localhost:5173/sms-demo.html", "_blank")}
>
  SMS Demo
</button>

      </div>

      <div style={{ marginTop: 16 }}>
        {tokens.length === 0 ? (
          <p>Токенов пока нет.</p>
        ) : (
          tokens.map((token) => (
            <TokenCard
              key={token.id}
              token={token}
              onDelete={requestDelete}
              onDetails={() => setSelectedToken(token)}
              onActivity={() => setActivityToken(token)}
            />
          ))
        )}
      </div>

      {createOpen && (
        <CreateTokenModal
          loading={creating}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateToken}
        />
      )}

      {selectedToken && (
        <TokenManageModal
        token={selectedToken}
        onClose={() => setSelectedToken(null)}
        onDelete={(id) => {
          setSelectedToken(null);   // 👈 закрываем окно редактирования
          requestDelete(id);        // 👈 открываем ConfirmModal
        }}
      
        onUpdateTTL={async (id, ttlSeconds) => {
          await updateTokenTTL(id, ttlSeconds);
          await fetchTokens();
        }}
      
        onUpdatePermissions={async (id, permissions) => {
          const updated = await updateTokenPermissionsMock(id, permissions);
          // обновим state сразу, чтобы UI не дёргался
          setTokens((prev) => prev.map((t) => (t.id === id ? updated : t)));
          setSelectedToken(updated);
        }}
      
        onUnbindService={async (tok) => {
          const updated = await unbindAgentMock(tok.id);
          setTokens((prev) => prev.map((t) => (t.id === tok.id ? updated : t)));
          setSelectedToken(updated);
        }}
      />
      
      )}


      {activityToken && (
        <TokenActivityModal token={activityToken} onClose={() => setActivityToken(null)} />
      )}

      {deleteTokenId && (
        <ConfirmModal
          title="Удалить токен?"
          message="Это действие нельзя отменить"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTokenId(null)}
        />
      )}
    </div>
  );
}
