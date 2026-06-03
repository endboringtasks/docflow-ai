import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowLeft, LogOut } from "lucide-react";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: ReactNode;
  title?: string;
  backTo?: string;
}

const ReverseEngineerLayout = ({ children, title, backTo }: Props) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/app/reverse-engineer" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 gradient-bg rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <p className="font-bold leading-tight">Docflow AI</p>
              <p className="text-xs text-muted-foreground">Reverse Engineer</p>
            </div>
          </Link>
          {backTo && (
            <Link
              to={backTo}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground ml-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          )}
          {title && <span className="text-sm font-medium truncate ml-2 hidden md:inline">{title}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block w-48">
            <CompanySwitcher />
          </div>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export default ReverseEngineerLayout;
