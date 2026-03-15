import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import {
  User,
  Globe,
  Building2,
  CheckCircle,
  AlertCircle,
  Save,
  Key,
  Shield,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [language, setLanguage] = useState(i18n.language);
  const [profile, setProfile] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('*, organizations(*)')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setDisplayName(data.display_name || '');
          setLanguage(data.language || 'en');
          setOrg(data.organizations);
        }
      });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: displayName, language })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      setErrorMsg(t('errors.generic'));
    } else {
      i18n.changeLanguage(language);
      localStorage.setItem('language', language);
      setSuccessMsg(t('settings.updateSuccess'));
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const infoRows = [
    { label: 'Email', value: user?.email },
    { label: 'User ID', value: user?.id?.substring(0, 16) + '...' },
    { label: t('settings.organization'), value: org?.name || '—' },
    { label: 'Role', value: profile?.role || '—' },
    { label: 'Member since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—' },
  ];

  const apiDocs = [
    { label: 'Base URL', value: API_BASE_URL },
    { label: 'Swagger UI', value: `${API_BASE_URL}/docs`, link: true },
    { label: 'ReDoc', value: `${API_BASE_URL}/redoc`, link: true },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">{t('settings.title')}</h1>
      </div>

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <User className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">{t('settings.profile')}</h2>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.displayName')}</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('settings.language')}</label>
            <div className="flex gap-3">
              {[
                { code: 'en', label: 'English', flag: '🇺🇸' },
                { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-medium text-sm transition-colors ${
                    language === lang.code
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span>{lang.flag}</span>
                  {lang.label}
                  {language === lang.code && <CheckCircle className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <Building2 className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">{t('settings.organization')}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-6 py-3">
              <span className="text-sm text-slate-500">{row.label}</span>
              <span className="text-sm font-medium text-slate-900 font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role badge */}
      {profile?.role && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <Shield className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Access Control</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                profile.role === 'admin'
                  ? 'bg-red-100 text-red-700'
                  : profile.role === 'user'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
              </span>
              <p className="text-sm text-slate-500">
                {profile.role === 'admin'
                  ? 'Full access to all features including API key management'
                  : profile.role === 'user'
                  ? 'Can upload, process documents and create templates'
                  : 'Read-only access to documents and results'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* API docs links */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <Key className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">{t('settings.apiConfiguration')}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {apiDocs.map((doc) => (
            <div key={doc.label} className="flex items-center justify-between px-6 py-3">
              <span className="text-sm text-slate-500">{doc.label}</span>
              {doc.link ? (
                <a
                  href={doc.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-blue-600 hover:underline"
                >
                  {doc.value}
                </a>
              ) : (
                <span className="text-sm font-medium text-slate-900 font-mono">{doc.value}</span>
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-50 rounded-b-xl">
          <p className="text-xs text-slate-500">
            <Globe className="w-3 h-3 inline mr-1" />
            Authenticate external requests with <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">X-API-Key: your_key</code>
          </p>
        </div>
      </div>
    </div>
  );
};
