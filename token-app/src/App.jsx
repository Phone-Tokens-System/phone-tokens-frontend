import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./components/AuthPage";
import MyTokensPage from "./pages/MyTokensPage";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Страница логина / регистрации */}
        <Route path="/auth" element={<Auth />} />

        {/* Защищённая страница */}
        <Route
          path="/tokens"
          element={
            <PrivateRoute>
              <MyTokensPage />
            </PrivateRoute>
          }
        />

        {/* Редирект по умолчанию */}
        <Route
          path="*"
          element={
            localStorage.getItem("token") ? (
              <Navigate to="/tokens" replace />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
