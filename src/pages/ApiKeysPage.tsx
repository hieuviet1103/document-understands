import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysApi } from '../services/api';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';

const GenerateKeyModal: React.FC<{
  onClose: () => void;
  onGenerated: (key: string) => void;
}> = ({ onClose, onGenerated }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [rateLimit, setRateLimit] = useState(60);
  const [expiresAt, setExpiresAt] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read', 'write']);

  const availableScopes = ['read', 'write', 'admin'];

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const mutation = useMutation({
    mutationFn: (data: any) => apiKeysApi.generate(data),
    onSuccess: (res) => {
      onGenerated(res.data.api_key);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name,
      rate_limit: rateLimit,
      scopes,
      expires_at: expiresAt || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">{t('apiKeys.generateKey')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('apiKeys.keyName')}</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Production API Key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('apiKeys.scopes')}</label>
            <div className="flex gap-2">
              {availableScopes.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                    scopes.includes(scope)
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('apiKeys.rateLimit')}</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('apiKeys.expiresAt')} (optional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(mutation.error as any)?.response?.data?.detail || t('errors.generic')}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? t('common.loading') : t('apiKeys.generateKey')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const NewKeyModal: React.FC<{ apiKey: string; onClose: () => void }> = ({ apiKey, onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 text-center mb-2">{t('apiKeys.generateSuccess')}</h2>
          <p className="text-sm text-red-600 text-center mb-4">{t('apiKeys.copyKeyWarning')}</p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <code className={`flex-1 text-sm font-mono break-all ${visible ? 'text-slate-800' : 'text-slate-300'}`}>
                {visible ? apiKey : '•'.repeat(Math.min(apiKey.length, 40))}
              </code>
              <button onClick={() => setVisible(!visible)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={copy}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors mb-3"
          >
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t('results.copied') : t('apiKeys.copyKey')}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ApiKeysPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setRevokeId(null);
    },
  });

  const keys = data?.data || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('apiKeys.title')}</h1>
          <p className="text-slate-500 mt-1">{keys.length} keys</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('apiKeys.generateKey')}
        </button>
      </div>

      {/* Usage note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">Authentication</p>
          <p>Include your API key in requests: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">X-API-Key: your_key</code></p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : keys.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Key className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('apiKeys.noKeys')}</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="mt-4 text-amber-600 hover:text-amber-700 font-medium"
          >
            {t('apiKeys.generateKey')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('apiKeys.keyName')}</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Prefix</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('apiKeys.scopes')}</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">{t('apiKeys.rateLimit')}</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">{t('apiKeys.lastUsed')}</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{t('documents.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((key: any) => (
                <tr key={key.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-500" />
                      <span className="font-medium text-slate-900">{key.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600">
                      {key.key_prefix}...
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {(key.scopes || []).map((scope: string) => (
                        <span key={scope} className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded font-medium">
                          {scope}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 hidden md:table-cell">{key.rate_limit}/min</td>
                  <td className="px-6 py-4 text-sm text-slate-500 hidden lg:table-cell">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      key.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${key.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {key.is_active ? t('apiKeys.active') : t('apiKeys.inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setRevokeId(key.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Revoke"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showGenerateModal && (
        <GenerateKeyModal
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(key) => {
            setShowGenerateModal(false);
            setNewApiKey(key);
            queryClient.invalidateQueries({ queryKey: ['api-keys'] });
          }}
        />
      )}

      {newApiKey && (
        <NewKeyModal
          apiKey={newApiKey}
          onClose={() => setNewApiKey(null)}
        />
      )}

      {revokeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t('common.confirm')}</h3>
            </div>
            <p className="text-slate-600 mb-6">{t('apiKeys.revokeConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRevokeId(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => revokeMutation.mutate(revokeId)}
                disabled={revokeMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
