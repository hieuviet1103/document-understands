import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsApi } from '../services/api';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  X,
  Eye,
} from 'lucide-react';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv'))
    return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  if (fileType.includes('image')) return <FileImage className="w-5 h-5 text-blue-500" />;
  if (fileType.includes('word') || fileType.includes('document'))
    return <FileText className="w-5 h-5 text-blue-700" />;
  return <File className="w-5 h-5 text-slate-400" />;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    uploaded: { color: 'bg-slate-100 text-slate-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Uploaded' },
    processing: { color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" />, label: 'Processing' },
    completed: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
    failed: { color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
  };
  const c = config[status] || config.uploaded;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
};

export const DocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', session?.access_token],
    queryFn: () => documentsApi.list(100, 0),
    enabled: !!session?.access_token,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      await refetch();
      setUploadSuccess(true);
      setUploadError(null);
      setTimeout(() => setUploadSuccess(false), 3000);
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.detail || t('errors.generic'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setDeleteId(null);
    },
  });

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => uploadMutation.mutate(file));
  }, [uploadMutation]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const rawList = data?.data ?? (Array.isArray(data) ? data : []);
  const documents = Array.isArray(rawList) ? rawList : [];
  const filtered = documents.filter((d: any) =>
    d.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('documents.title')}</h1>
          <p className="text-slate-500 mt-1">{documents.length} {t('documents.title').toLowerCase()}</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Upload className="w-4 h-4" />
          {t('documents.uploadDocument')}
        </button>
      </div>

      {uploadSuccess && (
        <div className="mb-4 flex flex-wrap items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{t('documents.uploadSuccess')}</span>
          <Link to="/processing" className="underline font-medium shrink-0">
            {t('documents.goToProcessing')}
          </Link>
        </div>
      )}
      {uploadError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
        <p className="text-slate-600 font-medium">{t('documents.dragDropText')}</p>
        <p className="text-slate-400 text-sm mt-1">PDF, Word, Excel, PowerPoint, Images</p>
        {uploadMutation.isPending && (
          <p className="text-blue-500 text-sm mt-2 animate-pulse">{t('common.loading')}</p>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Documents table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('documents.noDocuments')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('documents.filename')}</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('documents.fileSize')}</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('documents.status')}</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('documents.uploadDate')}</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('documents.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {getFileIcon(doc.file_type ?? doc.mime_type ?? '')}
                      <span className="text-sm font-medium text-slate-900 truncate max-w-xs">{doc.filename}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{formatBytes(doc.file_size ?? 0)}</td>
                  <td className="px-6 py-4"><StatusBadge status={doc.status} /></td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewDocumentId(doc.id)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('documents.preview') || 'Preview'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(doc.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {previewDocumentId && (
        <DocumentPreviewModal
          documentId={previewDocumentId}
          onClose={() => setPreviewDocumentId(null)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t('common.confirm')}</h3>
            </div>
            <p className="text-slate-600 mb-6">{t('documents.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
