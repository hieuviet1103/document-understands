import React, { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Play,
  Key,
  Webhook,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
} from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: t('nav.dashboard'), to: '/', icon: LayoutDashboard },
    { name: t('nav.documents'), to: '/documents', icon: FileText },
    { name: t('nav.templates'), to: '/templates', icon: Layers },
    { name: t('nav.processing'), to: '/processing', icon: Play },
    { name: t('nav.apiKeys'), to: '/api-keys', icon: Key },
    { name: t('nav.webhooks'), to: '/webhooks', icon: Webhook },
    { name: t('nav.settings'), to: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'vi' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 p-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-900">Document AI</h1>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-200 space-y-2">
            <button
              onClick={toggleLanguage}
              className="w-full flex items-center space-x-3 px-4 py-3 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Globe className="w-5 h-5" />
              <span className="font-medium">{i18n.language === 'en' ? 'Tiếng Việt' : 'English'}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t('auth.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="lg:ml-64 pt-16 lg:pt-0">
        <Outlet />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};
