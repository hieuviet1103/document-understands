import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksApi } from '../services/api';
import {
  Webhook,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  ToggleLeft,
  ToggleRight,
  Copy,
  ChevronRight,
  Activity,
  Clock,
} from 'lucide-react';

const CreateWebhookModal: React.FC<{
  webhook?: any;
  onClose: () => void;
  onSave: (data: any) => void;
  loading: boolean;
}> = ({ webhook, onClose, onSave, loading }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState(webhook?.url || '');
  const [events, setEvents] = useState<string[]>(webhook?.events || ['job.completed']);

  const availableEvents = ['job.completed', 'job.failed'];

  const toggleEvent = (event: string) =>
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ url, events });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {webhook ? t('common.edit') : t('webhooks.createWebhook')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('webhooks.webhookUrl')}</label>
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://your-server.com/webhook"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('webhooks.events')}</label>
            <div className="space-y-2">
              {availableEvents.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(event)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                    events.includes(event)
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    events.includes(event) ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                  }`}>
                    {events.includes(event) && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{event}</p>
                    <p className="text-xs opacity-70">
                      {event === 'job.completed' ? t('webhooks.event.jobCompleted') : t('webhooks.event.jobFailed')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || events.length === 0}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeliveriesModal: React.FC<{ webhookId: string; onClose: () => void }> = ({ webhookId, onClose }) => {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => webhooksApi.getDeliveries(webhookId, 50, 0),
  });

  const deliveries = data?.data || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">{t('webhooks.deliveries')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              No deliveries yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {deliveries.map((delivery: any) => (
                <div key={delivery.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        delivery.delivered_at ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {delivery.delivered_at ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {delivery.delivered_at ? 'Delivered' : 'Failed'}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {delivery.event_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(delivery.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>HTTP {delivery.response_status || '—'}</span>
                    <span>•</span>
                    <span>Attempt {delivery.attempt_count}</span>
                    {delivery.response_body && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-xs">{delivery.response_body.substring(0, 60)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const WebhooksPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editWebhook, setEditWebhook] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deliveriesWebhookId, setDeliveriesWebhookId] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => webhooksApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => webhooksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowCreateModal(false);
      showSuccess(t('webhooks.createSuccess'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => webhooksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setEditWebhook(null);
      showSuccess(t('webhooks.updateSuccess'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setDeleteId(null);
      showSuccess(t('webhooks.deleteSuccess'));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      webhooksApi.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const copySecret = (secret: string, id: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(id);
    setTimeout(() => setCopiedSecret(null), 2000);
  };

  const webhooks = data?.data || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('webhooks.title')}</h1>
          <p className="text-slate-500 mt-1">{webhooks.length} webhooks</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('webhooks.createWebhook')}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : webhooks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Webhook className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('webhooks.noWebhooks')}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {t('webhooks.createWebhook')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((wh: any) => (
            <div key={wh.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Webhook className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="font-medium text-slate-900 font-mono text-sm truncate">{wh.url}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(wh.events || []).map((event: string) => (
                        <span key={event} className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded font-mono">
                          {event}
                        </span>
                      ))}
                      <span className="text-xs text-slate-400">
                        Created {new Date(wh.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: wh.id, is_active: !wh.is_active })}
                      className={`p-2 rounded-lg transition-colors ${
                        wh.is_active
                          ? 'text-indigo-600 hover:bg-indigo-50'
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                      title={wh.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {wh.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => setDeliveriesWebhookId(wh.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title={t('webhooks.deliveries')}
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditWebhook(wh)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(wh.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Secret */}
                <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-500 font-medium">Secret:</span>
                  <code className="text-xs font-mono text-slate-600 flex-1 truncate">
                    {wh.secret.substring(0, 20)}...
                  </code>
                  <button
                    onClick={() => copySecret(wh.secret, wh.id)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {copiedSecret === wh.id ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className={`ml-auto flex items-center gap-1 text-xs font-medium ${wh.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${wh.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                    {wh.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 py-2">
                <button
                  onClick={() => setDeliveriesWebhookId(wh.id)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                  {t('webhooks.deliveries')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreateModal || editWebhook) && (
        <CreateWebhookModal
          webhook={editWebhook}
          onClose={() => { setShowCreateModal(false); setEditWebhook(null); }}
          onSave={(data) => {
            if (editWebhook) {
              updateMutation.mutate({ id: editWebhook.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {deliveriesWebhookId && (
        <DeliveriesModal webhookId={deliveriesWebhookId} onClose={() => setDeliveriesWebhookId(null)} />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t('common.confirm')}</h3>
            </div>
            <p className="text-slate-600 mb-6">{t('webhooks.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
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
