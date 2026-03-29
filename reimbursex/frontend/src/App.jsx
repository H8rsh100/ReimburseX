import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import ExpenseForm from "./pages/ExpenseForm";
import AdminExpenseReview from "./pages/AdminExpenseReview";
import Approvals from "./pages/Approvals";
import Users from "./pages/Users";
import Rules from "./pages/Rules";

function PrivateRoute({ children, roles }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { token } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/signup" element={!token ? <Signup /> : <Navigate to="/dashboard" />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="expenses" element={<PrivateRoute roles={["employee","admin"]}><Expenses /></PrivateRoute>} />
          <Route path="expenses/new" element={<PrivateRoute roles={["employee","admin"]}><ExpenseForm /></PrivateRoute>} />
          <Route path="approvals" element={<PrivateRoute roles={["manager","admin"]}><Approvals /></PrivateRoute>} />
          <Route path="admin/expenses" element={<PrivateRoute roles={["admin"]}><AdminExpenseReview /></PrivateRoute>} />
          <Route path="users" element={<PrivateRoute roles={["admin"]}><Users /></PrivateRoute>} />
          <Route path="rules" element={<PrivateRoute roles={["admin"]}><Rules /></PrivateRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
