import { useNavigate } from "react-router-dom";

function LogoutButton() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userId"); // если сохраняешь
    navigate("/auth", { replace: true });
  }

  return (
    <button className="danger" onClick={logout}>
      Выйти
    </button>
  );
}

export default LogoutButton;
