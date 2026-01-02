import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FileText, Loader2 } from "lucide-react";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfThumbnailProps {
  url: string;
  onClick?: () => void;
  size?: number;
}

export function PdfThumbnail({ url, onClick, size = 32 }: PdfThumbnailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoadSuccess = () => {
    setLoading(false);
    setError(false);
  };

  const handleLoadError = () => {
    setLoading(false);
    setError(true);
  };

  if (error) {
    return (
      <button
        onClick={onClick}
        className="flex items-center justify-center rounded border bg-red-50 dark:bg-red-950/30 hover:opacity-75 transition-opacity"
        style={{ width: size, height: size }}
        title="PDF Preview"
      >
        <FileText className="w-4 h-4 text-red-600" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="relative rounded border overflow-hidden hover:opacity-75 transition-opacity bg-muted"
      style={{ width: size, height: size }}
      title="View PDF"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <Document
        file={url}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
        loading={null}
      >
        <Page
          pageNumber={1}
          width={size}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </button>
  );
}
