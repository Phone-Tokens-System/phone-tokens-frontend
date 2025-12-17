import { useEffect, useState } from "react";
import { getMyTokens, deleteToken, createToken, bindAgentToToken } from "../api/tokens";

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

  async function fetchTokens() {
    try {
      setLoading(true);
      setError("");
      const data = await getMyTokens();
      setTokens(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Ошибка при загрузке токенов");
      setTokens([]);
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
  
      // 1) создаём токен
      const created = await createToken(req);
  
      // 2) если ввели serviceId/agentId — привязываем по имени токена
      // (требование: bind по token_name и agent_id)
      if (serviceId) {
        const bound = await bindAgentToToken(serviceId, req.name);
  
        // если bind вернул tokenResponse — обновим список этим объектом
        if (bound && typeof bound === "object") {
          setTokens((prev) => {
            // заменим по name/id если совпало, иначе добавим
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
        <TokenDetailsModal token={selectedToken} onClose={() => setSelectedToken(null)} />
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
