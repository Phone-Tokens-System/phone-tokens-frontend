import { useEffect, useMemo, useState } from "react";
import "./ConfirmModal.css";
import { getSmsByToken } from "../api/sms";

function toDateString(ts) {
  if (!ts) return "—";
  const n = Number(ts);
  if (!Number.isFinite(n)) return "—";

  // если секунды — переводим в мс
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function TokenActivityModal({ token, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const userToken = token?.token; // важно: именно строка токена для /sms/users/{token}

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setErr("");
        const data = await getSmsByToken(userToken);
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Ошибка при загрузке history");
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (userToken) load();
    else {
      setLoading(false);
      setErr("У токена нет поля token (строки) — нечего запрашивать");
      setItems([]);
    }

    return () => {
      alive = false;
    };
  }, [userToken]);

  const title = useMemo(() => token?.name || "History", [token]);

  if (!token) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>History SMS</h2>
        <p><strong>{title}</strong></p>

        {loading && <p>Загрузка...</p>}
        {!loading && err && <p style={{ color: "red" }}>{err}</p>}

        {!loading && !err && items.length === 0 && (
          <p>SMS для этого токена нет</p>
        )}

        {!loading && !err && items.length > 0 && (
          <table className="activity-table">
            <thead>
              <tr>
                <th>Service ID</th>
                <th>Service name</th>
                <th>Отправитель</th>
                <th>Дата отправки</th>
                <th>Текст</th>
              </tr>
            </thead>
            <tbody>
              {items.map((sms) => (
                <tr key={sms.id || `${sms.service_id}-${sms.date_sent}-${sms.text}`}>
                  <td>{sms.service_id || "—"}</td>
                  <td>{sms.service_name || "—"}</td>
                  <td>{sms.from || "—"}</td>
                  <td>{toDateString(sms.date_sent)}</td>
                  <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>
                    {sms.text || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="modal-buttons">
          <button onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
