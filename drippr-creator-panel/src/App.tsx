import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthProvider from "@/providers/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import AdminGuard from "@/components/AdminGuard";
import DashboardLayout from "@/components/DashboardLayout";
import AdminLayout from "@/components/AdminLayout";
import { Toaster } from "@/components/ui/toaster";

// Auth pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";

// Creator pages
import Dashboard from "@/pages/Dashboard";
import Verification from "@/pages/Verification";
import Analytics from "@/pages/Analytics";
import Payments from "@/pages/Payments";
import Wallet from "@/pages/Wallet";
import Settings from "@/pages/Settings";

// Admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import VerifyCreators from "@/pages/admin/VerifyCreators";
import ReviewQueue from "@/pages/admin/ReviewQueue";
import CreatorList from "@/pages/admin/CreatorList";
import CreatorDetail from "@/pages/admin/CreatorDetail";
import AdminSupport from "@/pages/admin/AdminSupport";
import AdminSettings from "@/pages/admin/AdminSettings";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* ── Creator panel ── */}
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

          {/* ── Admin panel ── */}
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="verify" element={<VerifyCreators />} />
            <Route path="review" element={<ReviewQueue />} />
            <Route path="creators" element={<CreatorList />} />
            <Route path="creator/:uid" element={<CreatorDetail />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* ── Fallbacks ── */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
