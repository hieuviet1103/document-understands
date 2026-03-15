import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, documentsApi, templatesApi } from '../services/api';
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Eye,
  StopCircle,
  Copy,
  Download,
  FileText,
  FileSpreadsheet,
  Braces,
  Table,
  RefreshCw,
  RotateCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'bg-slate-100 text-slate-700', icon: <Clock className="w-3 h-3" /> },
    processing: { color: 'bg-yellow-100 text-yellow-700', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    completed: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
    failed: { color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
    cancelled: { color: 'bg-slate-100 text-slate-500', icon: <StopCircle className="w-3 h-3" /> },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.color}`}>
      {c.icon}
      {t(`processing.status.${status}`)}
    </span>
  );
};

const ResultModal: React.FC<{ jobId: string; onClose: () => void }> = ({ jobId, onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['job-result', jobId],
    queryFn: () => jobsApi.getResult(jobId),
  });

  // Axios puts response body in response.data; support both raw body and wrapped
  const result = data?.data ?? data;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const renderOutput = () => {
    if (!result) return null;

    if (result.output_format === 'text' && result.output_text) {
      return (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileText className="w-4 h-4" />{t('results.textOutput')}
            </span>
            <button
              onClick={() => copyToClipboard(result.output_text)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied ? t('results.copied') : t('results.copyToClipboard')}
            </button>
          </div>
          <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm whitespace-pre-wrap overflow-auto max-h-80">
            {result.output_text}
          </pre>
        </div>
      );
    }

    if (result.output_format === 'excel' && result.output_file_url) {
      const excelUrl = result.output_file_url;
      const fileName = `export-${jobId.slice(0, 8)}.xlsx`;
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Table className="w-5 h-5 text-green-600" />
            {t('results.excelOutput')}
          </div>
          <p className="text-slate-600 text-sm">{t('results.excelReady')}</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={excelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
              title={t('results.previewExcel')}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('results.openInNewTab')}
            </a>
            <a
              href={excelUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
              title={t('results.downloadFile')}
            >
              <Download className="w-4 h-4" />
              {t('results.downloadFile')}
            </a>
          </div>
        </div>
      );
    }

    // output_data may be object (incl. nested array/object) or JSON string; fallback to output_text
    let jsonData: unknown = result.output_data;
    if (jsonData == null && result.output_format === 'json' && result.output_text) {
      try {
        jsonData = JSON.parse(result.output_text);
      } catch {
        jsonData = null;
      }
    }
    if (typeof jsonData === 'string') {
      try {
        jsonData = JSON.parse(jsonData);
      } catch {
        jsonData = null;
      }
    }
    if (jsonData != null && typeof jsonData === 'object') {
      const jsonStr = JSON.stringify(jsonData, null, 2);
      return (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Braces className="w-4 h-4" />{t('results.jsonOutput')}
            </span>
            <button
              onClick={() => copyToClipboard(jsonStr)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied ? t('results.copied') : t('results.copyToClipboard')}
            </button>
          </div>
          <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm overflow-auto max-h-80 font-mono">
            {jsonStr}
          </pre>
        </div>
      );
    }

    return <p className="text-slate-500 text-center py-8">No output available</p>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">{t('results.title')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
          ) : result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">{t('results.outputFormat')}</p>
                  <p className="font-medium text-slate-900 uppercase">{result.output_format}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">{t('results.tokensUsed')}</p>
                  <p className="font-medium text-slate-900">{result.tokens_used?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">{t('results.processingTime')}</p>
                  <p className="font-medium text-slate-900">{result.processing_time}s</p>
                </div>
              </div>
              {renderOutput()}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">No result found</p>
          )}
        </div>
      </div>
    </div>
  );
};

const CreateJobModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const { t } = useTranslation();
  const [documentId, setDocumentId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [priority, setPriority] = useState(0);

  const { data: docsData } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list(100, 0),
  });
  const { data: tplData } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list(100, 0),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => jobsApi.create(data),
    onSuccess: () => {
      onCreated();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      document_id: documentId,
      template_id: templateId || undefined,
      custom_instructions: customInstructions,
      priority,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">{t('processing.createJob')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('processing.selectDocument')}</label>
            <select
              required
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- Select --</option>
              {(docsData?.data || []).map((doc: any) => (
                <option key={doc.id} value={doc.id}>{doc.filename}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('processing.selectTemplate')}</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- No template (auto detect) --</option>
              {(tplData?.data || []).map((tpl: any) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.output_format})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('processing.customInstructions')}</label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Optional additional instructions for AI..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('processing.priority')}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value={0}>Normal</option>
              <option value={5}>High</option>
              <option value={10}>Urgent</option>
            </select>
          </div>

          {createMutation.isError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(createMutation.error as any)?.response?.data?.detail || t('errors.generic')}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {t('processing.createJob')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ProcessingPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewResultJobId, setViewResultJobId] = useState<string | null>(null);
  const [cancelJobId, setCancelJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () => jobsApi.list(statusFilter || undefined, 100, 0),
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => jobsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setCancelJobId(null);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => jobsApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const jobs = data?.data || [];
  const statuses = ['', 'pending', 'processing', 'completed', 'failed', 'cancelled'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('processing.title')}</h1>
          <p className="text-slate-500 mt-1">{jobs.length} jobs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            {t('processing.createJob')}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-green-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-green-300'
            }`}
          >
            {s ? t(`processing.status.${s}`) : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Play className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('processing.noJobs')}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-green-600 hover:text-green-700 font-medium"
          >
            {t('processing.createJob')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Job ID</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('processing.status.pending').replace('Pending','Status')}</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Created</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Completed</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('documents.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job: any) => (
                <React.Fragment key={job.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {expandedId === job.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <span className="font-mono text-sm text-slate-600">{job.id.substring(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={job.status} /></td>
                    <td className="px-6 py-4 text-sm text-slate-500 hidden md:table-cell">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 hidden lg:table-cell">
                      {job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        {job.status === 'completed' && (
                          <button
                            onClick={() => setViewResultJobId(job.id)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t('processing.viewResult')}
                          </button>
                        )}
                        {(job.status === 'pending' || job.status === 'processing') && (
                          <button
                            onClick={() => setCancelJobId(job.id)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                            {t('processing.cancelJob')}
                          </button>
                        )}
                        {(job.status === 'failed' || job.status === 'cancelled') && (
                          <button
                            onClick={() => retryMutation.mutate(job.id)}
                            disabled={retryMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            {t('processing.retry')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === job.id && (
                    <tr>
                      <td colSpan={5} className="px-6 pb-4 bg-slate-50">
                        <div className="text-xs text-slate-600 space-y-1">
                          <p><span className="font-medium">Full ID:</span> {job.id}</p>
                          {job.custom_instructions && (
                            <p><span className="font-medium">Instructions:</span> {job.custom_instructions}</p>
                          )}
                          {job.error_message && (
                            <p className="text-red-600"><span className="font-medium">Error:</span> {job.error_message}</p>
                          )}
                          <p><span className="font-medium">Priority:</span> {job.priority}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateJobModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}
        />
      )}

      {viewResultJobId && (
        <ResultModal jobId={viewResultJobId} onClose={() => setViewResultJobId(null)} />
      )}

      {cancelJobId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t('common.confirm')}</h3>
            </div>
            <p className="text-slate-600 mb-6">{t('processing.cancelConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelJobId(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancelJobId)}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t('processing.cancelJob')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
