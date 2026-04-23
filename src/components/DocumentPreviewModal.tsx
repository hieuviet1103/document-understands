import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentsApi } from '../services/api';
import { X, ExternalLink, FileText, AlertCircle } from 'lucide-react';

const isPdf = (mime: string) => (mime || '').toLowerCase() === 'application/pdf';
const isImage = (mime: string) => (mime || '').toLowerCase().startsWith('image/');

export const DocumentPreviewModal: React.FC<{
  documentId: string | null;
  onClose: () => void;
}> = ({ documentId, onClose }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['document-preview-url', documentId],
    queryFn: () => documentsApi.getPreviewUrl(documentId!),
    enabled: !!documentId,
  });

  const payload = data?.data ?? data;
  const url = payload?.url;
  const filename = payload?.filename ?? '';
  const mimeType = (payload?.mime_type ?? '').toLowerCase();

  if (!documentId) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <span className="text-sm font-medium text-slate-700 truncate max-w-md" title={filename}>
            {filename || 'Preview'}
          </span>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden bg-slate-100 rounded-b-xl flex items-center justify-center p-4">
          {isLoading && (
            <div className="text-slate-500 flex items-center gap-2">
              <FileText className="w-6 h-6 animate-pulse" />
              Loading preview...
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-2 text-red-600">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm">{(error as any)?.response?.data?.detail || 'Failed to load preview'}</p>
            </div>
          )}
          {url && !error && (
            <>
              {isPdf(mimeType) && (
                <iframe
                  src={url}
                  title={filename}
                  className="w-full h-full min-h-[70vh] rounded-lg bg-white"
                />
              )}
              {isImage(mimeType) && (
                <img
                  src={url}
                  alt={filename}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              )}
              {!isPdf(mimeType) && !isImage(mimeType) && (
                <div className="text-center">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 mb-4">Preview not available for this file type.</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in new tab
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
