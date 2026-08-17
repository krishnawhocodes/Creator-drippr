import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
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
  ClipboardList,
  Users,
  LifeBuoy,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  ArrowLeftRight,
} from "lucide-react";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/verify", label: "Verify Creators", icon: ShieldCheck },
  { to: "/admin/review", label: "Review Queue", icon: ClipboardList },
  { to: "/admin/creators", label: "Creators", icon: Users },
  { to: "/admin/support", label: "Support", icon: LifeBuoy },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center gap-2 px-6 py-5">
        <span className="text-xl font-bold tracking-tight text-white">
          Drippr
        </span>
        <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
          admin
        </span>
      </div>

      <div className="h-px flex-shrink-0 bg-white/10" />

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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

        <div className="my-3 h-px bg-white/10" />

        <NavLink
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeftRight className="h-4 w-4 flex-shrink-0" />
          Creator View
        </NavLink>
      </nav>
    </div>
  );
}

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  useBodyScrollLock();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      <aside className="hidden h-[100dvh] w-64 flex-shrink-0 overflow-hidden bg-zinc-900 lg:block">
        <SidebarContent />
      </aside>

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

      <div className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center justify-end border-b bg-white px-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-100">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-red-600 text-xs text-white">
                    {user?.email?.charAt(0).toUpperCase() || "A"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[220px] truncate font-medium md:inline">
                  {user?.email}
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                <ArrowLeftRight className="mr-2 h-4 w-4" /> Creator View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
