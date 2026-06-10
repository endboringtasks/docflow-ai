import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, AlertTriangle } from "lucide-react";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export function DeleteAccountCard() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all data you own
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="font-medium">Delete my account</p>
              <p className="text-sm text-muted-foreground">
                This will permanently remove your profile and login. This action cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setDialogOpen(true)}
              className="shrink-0"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete My Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
