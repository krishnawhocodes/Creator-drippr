import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthProvider from "@/providers/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import AdminGuard from "@/components/AdminGuard";
import DashboardLayout from "@/components/DashboardLayout";
import AdminLayout from "@/components/AdminLayout";
import { Toaster } from "@/components/ui/toaster";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Dashboard from "@/pages/Dashboard";
import Verification from "@/pages/Verification";
import Analytics from "@/pages/Analytics";
import Payments from "@/pages/Payments";
import Wallet from "@/pages/Wallet";
import Settings from "@/pages/Settings";
import CreatorList from "@/pages/admin/CreatorList";
import CreatorDetail from "@/pages/admin/CreatorDetail";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Creator dashboard */}
          <Route
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            }
          >
            <Route index element={<CreatorList />} />
            <Route path="creator/:uid" element={<CreatorDetail />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
