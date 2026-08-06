import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Users, LogOut, Menu, LayoutDashboard } from "lucide-react";

const NAV = [
  { to: "/admin", label: "All Creators", icon: Users, end: true },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="text-xl font-bold tracking-tight text-white">
          Drippr
        </span>
        <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
          admin
        </span>
      </div>

      <Separator className="bg-white/10" />

      <nav className="flex-1 space-y-1 px-3 py-4">
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
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="hidden w-64 flex-shrink-0 bg-zinc-900 lg:block">
        <SidebarContent />
      </aside>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="fixed left-4 top-4 z-40">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-zinc-900 p-0">
          <SidebarContent onNavigate={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">Admin Panel</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
