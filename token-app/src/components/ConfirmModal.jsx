import "./ConfirmModal.css";

export default function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{title}</h3>
        <p>{message}</p>

        <div className="modal-buttons">
          <button className="danger" onClick={onConfirm}>
            Удалить
          </button>
          <button onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
