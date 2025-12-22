import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronDown, Check, Plus, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/hooks/useCompany";

export function CompanySwitcher() {
  const navigate = useNavigate();
  const { currentCompany, currentRole, companies, loading, switchCompany } = useCompany();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        </div>
        <div className="flex-1">
          <div className="h-4 w-24 bg-sidebar-foreground/10 rounded animate-pulse" />
          <div className="h-3 w-16 bg-sidebar-foreground/10 rounded mt-1 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <button
        onClick={() => navigate("/onboarding")}
        className="w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Plus className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-sidebar-foreground">Create Company</p>
          <p className="text-xs text-sidebar-foreground/60">Set up your workspace</p>
        </div>
      </button>
    );
  }

  const handleSwitch = (companyId: string, niche: string) => {
    switchCompany(companyId);
    setOpen(false);
    navigate(`/app/${niche}/dashboard`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {currentCompany.name}
            </p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {currentRole}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-sidebar-foreground/60 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch Company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((membership) => (
          <DropdownMenuItem
            key={membership.company_id}
            onClick={() => handleSwitch(membership.company_id, membership.company.niche)}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{membership.company.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {membership.role} • {membership.company.niche}
              </p>
            </div>
            {membership.company_id === currentCompany.id && (
              <Check className="w-4 h-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            navigate("/onboarding");
          }}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Plus className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-sm">Create new company</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
