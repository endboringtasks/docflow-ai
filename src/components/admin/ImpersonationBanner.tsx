import { useImpersonation } from "@/hooks/useImpersonation";
import { Button } from "@/components/ui/button";
import { UserX, Loader2 } from "lucide-react";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, endImpersonation, isLoading } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserX className="w-4 h-4" />
          <span className="text-sm font-medium">
            Impersonating: {impersonatedUser.display_name || impersonatedUser.email}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={endImpersonation}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          End Impersonation
        </Button>
      </div>
    </div>
  );
}
