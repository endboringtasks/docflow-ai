import { useState } from "react";
import { File, Image as ImageIcon } from "lucide-react";
import { PdfThumbnail } from "./PdfThumbnail";

interface DocumentThumbnailProps {
  filePath: string | null;
  fileUrl: string | null;
  onPreview?: () => void;
  size?: number;
}

const isImageFile = (filePath: string | null): boolean => {
  if (!filePath) return false;
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
};

const isPdfFile = (filePath: string | null): boolean => {
  if (!filePath) return false;
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext === 'pdf';
};

export function DocumentThumbnail({ filePath, fileUrl, onPreview, size = 32 }: DocumentThumbnailProps) {
  const [imageError, setImageError] = useState(false);

  if (!filePath || !fileUrl) {
    return <File className="w-4 h-4 text-muted-foreground" />;
  }

  // Image files
  if (isImageFile(filePath) && !imageError) {
    return (
      <button 
        onClick={onPreview}
        className="hover:opacity-75 transition-opacity"
      >
        <img 
          src={fileUrl} 
          alt="Preview" 
          className="object-cover rounded border"
          style={{ width: size, height: size }}
          onError={() => setImageError(true)}
        />
      </button>
    );
  }

  // PDF files
  if (isPdfFile(filePath)) {
    return (
      <PdfThumbnail 
        url={fileUrl} 
        onClick={onPreview} 
        size={size} 
      />
    );
  }

  // Other file types - show icon
  return <File className="w-4 h-4 text-muted-foreground" />;
}
