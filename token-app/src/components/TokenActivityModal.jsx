import "./ConfirmModal.css";
import { activityLogs } from "../mocks/activityLogs";

export default function TokenActivityModal({ token, onClose }) {
  if (!token) return null;

  const logs = activityLogs[token.id] || [];

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Активность токена</h2>
        <p><strong>{token.name}</strong></p>

        {logs.length === 0 ? (
          <p>Активность отсутствует</p>
        ) : (
          <table className="activity-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Сервис</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.date}</td>
                  <td>{log.type}</td>
                  <td>{log.service}</td>
                  <td>
                    <span
                      className={
                        log.status === "success"
                          ? "active"
                          : "expired"
                      }
                    >
                      {log.status === "success"
                        ? "Успешно"
                        : "Ошибка"}
                    </span>
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
