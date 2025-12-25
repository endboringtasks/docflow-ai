import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Zap, 
  LayoutDashboard, 
  Users, 
  FileText, 
  FileCheck,
  CreditCard, 
  Settings, 
  LogOut, 
  Menu,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppLayoutProps {
  children: ReactNode;
  niche: "migration" | "audit" | "hr";
}

const nicheConfig = {
  migration: {
    name: "Migration",
    subtitle: "Docflow AI – Migration",
    navItems: [
      { label: "Dashboard", href: "/app/migration/dashboard", icon: LayoutDashboard },
      { label: "Clients", href: "/app/migration/clients", icon: Users },
      { label: "Visa Applications", href: "/app/migration/matters", icon: FileText },
      { label: "Document Templates", href: "/app/migration/document-templates", icon: FileCheck },
    ],
  },
  audit: {
    name: "Audit",
    subtitle: "Docflow AI – Audit",
    navItems: [
      { label: "Dashboard", href: "/app/audit/dashboard", icon: LayoutDashboard },
      { label: "Clients", href: "/app/audit/clients", icon: Users },
      { label: "Engagements", href: "/app/audit/engagements", icon: FileText },
    ],
  },
  hr: {
    name: "HR",
    subtitle: "Docflow AI – HR",
    navItems: [
      { label: "Dashboard", href: "/app/hr/dashboard", icon: LayoutDashboard },
      { label: "Employees", href: "/app/hr/employees", icon: Users },
      { label: "Cases", href: "/app/hr/cases", icon: FileText },
    ],
  },
};

const AppLayout = ({ children, niche }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { currentCompany, currentRole } = useCompany();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const config = nicheConfig[niche];

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // Show billing only to owners
  const showBilling = currentRole === "owner";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transform transition-transform duration-200 lg:transform-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sidebar-foreground">Docflow AI</p>
              <p className="text-xs text-sidebar-foreground/60">{config.subtitle}</p>
            </div>
          </Link>
        </div>

        {/* Company Switcher */}
        <div className="p-4 border-b border-sidebar-border">
          <CompanySwitcher />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {config.navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
          {showBilling && (
            <Link
              to="/app/billing"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <CreditCard className="w-5 h-5" />
              Billing
              <Badge variant="secondary" className="ml-auto text-xs capitalize">
                {currentCompany?.subscription_plan || "free"}
              </Badge>
            </Link>
          )}
          <Link
            to="/app/settings"
            onClick={() => setIsSidebarOpen(false)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/app/settings"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between px-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Docflow AI</span>
          </div>
          <ThemeToggle />
        </header>

        {/* Desktop Header with Theme Toggle */}
        <header className="hidden lg:flex sticky top-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur-sm items-center justify-end px-6">
          <ThemeToggle />
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
