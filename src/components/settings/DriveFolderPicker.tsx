import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, ChevronRight, Loader2, Home, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DriveFolder {
  id: string;
  name: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface DriveFolderPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  currentFolderId: string | null;
  currentFolderName: string | null;
  onSelect: (folderId: string | null, folderName: string | null) => void;
}

export function DriveFolderPicker({
  open,
  onOpenChange,
  companyId,
  currentFolderId,
  currentFolderName,
  onSelect,
}: DriveFolderPickerProps) {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string | null; name: string | null }>({
    id: currentFolderId,
    name: currentFolderName,
  });
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "My Drive" },
  ]);

  const currentParentId = breadcrumbs[breadcrumbs.length - 1].id;

  const fetchFolders = async (parentId: string | null) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-list-folders", {
        body: { companyId, parentId },
      });

      if (error) throw error;
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Error fetching folders:", error);
      toast.error("Failed to load folders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedFolder({ id: currentFolderId, name: currentFolderName });
      setBreadcrumbs([{ id: null, name: "My Drive" }]);
      fetchFolders(null);
    }
  }, [open, companyId]);

  const handleFolderClick = (folder: DriveFolder) => {
    setSelectedFolder({ id: folder.id, name: folder.name });
  };

  const handleFolderOpen = (folder: DriveFolder) => {
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
    setSelectedFolder({ id: folder.id, name: folder.name });
    fetchFolders(folder.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    const parentId = newBreadcrumbs[newBreadcrumbs.length - 1].id;
    fetchFolders(parentId);
  };

  const handleBack = () => {
    if (breadcrumbs.length > 1) {
      handleBreadcrumbClick(breadcrumbs.length - 2);
    }
  };

  const handleSelectCurrentFolder = () => {
    const current = breadcrumbs[breadcrumbs.length - 1];
    setSelectedFolder({ id: current.id, name: current.id ? current.name : null });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke("google-drive-set-root", {
        body: {
          companyId,
          folderId: selectedFolder.id,
          folderName: selectedFolder.name,
        },
      });

      if (error) throw error;

      toast.success("Root folder updated");
      onSelect(selectedFolder.id, selectedFolder.name);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving folder:", error);
      toast.error("Failed to save folder selection");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Root Folder</DialogTitle>
          <DialogDescription>
            Choose where client folders will be created in your Google Drive
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
            {breadcrumbs.length > 1 && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center shrink-0">
                {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className="hover:underline text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {index === 0 && <Home className="h-3 w-3" />}
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Use current folder button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectCurrentFolder}
            className="w-full justify-start"
          >
            <Folder className="h-4 w-4 mr-2 text-primary" />
            Use "{breadcrumbs[breadcrumbs.length - 1].name}" as root
          </Button>

          {/* Folder list */}
          <ScrollArea className="h-[280px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                <Folder className="h-8 w-8 mb-2 opacity-50" />
                No subfolders here
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                      selectedFolder.id === folder.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => handleFolderClick(folder)}
                    onDoubleClick={() => handleFolderOpen(folder)}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-primary" />
                      <span className="text-sm">{folder.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFolderOpen(folder);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected folder display */}
          {selectedFolder.id && (
            <div className="text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{selectedFolder.name}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Select Folder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
