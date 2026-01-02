/**
 * Get the file type badge info from a file path
 */
export const getFileTypeBadge = (filePath: string | null): { label: string; color: string } | null => {
  if (!filePath) return null;
  
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'pdf':
      return { label: 'PDF', color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800' };
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'heic':
      return { label: 'Image', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800' };
    case 'doc':
    case 'docx':
      return { label: 'Word', color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800' };
    case 'xls':
    case 'xlsx':
      return { label: 'Excel', color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800' };
    case 'ppt':
    case 'pptx':
      return { label: 'PowerPoint', color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800' };
    case 'zip':
    case 'rar':
    case '7z':
      return { label: 'Archive', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800' };
    default:
      return { label: 'File', color: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' };
  }
};
