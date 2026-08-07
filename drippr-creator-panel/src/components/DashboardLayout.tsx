import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  CreditCard,
  Wallet,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  ShieldAlert,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/verification", label: "Verification", icon: ShieldCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, isAdmin } = useAuth();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Brand */}
      <div className="flex flex-shrink-0 items-center gap-2 px-6 py-5">
        <span className="text-xl font-bold tracking-tight text-white">
          Drippr
        </span>
        <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
          creator
        </span>
      </div>

      <div className="h-px flex-shrink-0 bg-white/10" />

      {/* Nav — this is the only scrollable region */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="my-3 h-px bg-white/10" />
            <NavLink
              to="/admin"
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg bg-red-500/15 px-3 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25 hover:text-red-200"
            >
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              Admin Panel
            </NavLink>
          </>
        )}
      </nav>

      {/* Affiliate code footer */}
      {profile?.affiliateCode ? (
        <div className="flex-shrink-0 border-t border-white/10 px-4 py-4">
          <div className="text-xs text-white/40">Affiliate Code</div>
          <div className="mt-1 font-mono text-sm font-semibold text-white">
            {profile.affiliateCode}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardLayout() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const initials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || "?";

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 flex-shrink-0 overflow-hidden bg-zinc-900 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-3 z-40"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-64 overflow-hidden border-0 bg-zinc-900 p-0"
        >
          <SidebarContent onNavigate={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 flex-shrink-0 items-center justify-end border-b bg-white px-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-100">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-zinc-900 text-xs text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[200px] truncate font-medium md:inline">
                  {profile?.fullName || user?.email}
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {isAdmin && (
                <>
                  <DropdownMenuItem
                    onClick={() => navigate("/admin")}
                    className="font-medium text-red-600 focus:text-red-600"
                  >
                    <ShieldAlert className="mr-2 h-4 w-4" /> Admin Panel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Scrollable content — the ONLY other scroll region */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
