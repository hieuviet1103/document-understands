import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { documentsApi, jobsApi, templatesApi } from '../services/api';
import { FileText, Clock, CheckCircle, Layers, Upload, FileSearch } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useAuth();

  const { data: documents } = useQuery({
    queryKey: ['documents', session?.access_token],
    queryFn: () => documentsApi.list(10, 0),
    enabled: !!session?.access_token,
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs', session?.access_token],
    queryFn: () => jobsApi.list(undefined, 10, 0),
    enabled: !!session?.access_token,
  });

  const { data: templates } = useQuery({
    queryKey: ['templates', session?.access_token],
    queryFn: () => templatesApi.list(10, 0),
    enabled: !!session?.access_token,
  });

  const stats = [
    {
      label: t('dashboard.totalDocuments'),
      value: documents?.data?.length || 0,
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      label: t('dashboard.processingJobs'),
      value: jobs?.data?.filter((j: any) => j.status === 'processing').length || 0,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      label: t('dashboard.completedJobs'),
      value: jobs?.data?.filter((j: any) => j.status === 'completed').length || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      label: t('dashboard.activeTemplates'),
      value: templates?.data?.length || 0,
      icon: Layers,
      color: 'bg-purple-500',
    },
  ];

  const quickActions = [
    {
      label: t('documents.uploadDocument'),
      icon: Upload,
      to: '/documents',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      label: t('processing.createJob'),
      icon: FileSearch,
      to: '/processing',
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      label: t('templates.createTemplate'),
      icon: Layers,
      to: '/templates',
      color: 'bg-purple-600 hover:bg-purple-700',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {t('dashboard.title')}
        </h1>
        <p className="text-slate-600">{t('dashboard.welcome')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-bold text-slate-900">{stat.value}</span>
            </div>
            <p className="text-sm text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            {t('dashboard.quickActions')}
          </h2>
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.to}
                className={`${action.color} text-white p-4 rounded-lg flex items-center space-x-3 transition-colors`}
              >
                <action.icon className="w-5 h-5" />
                <span className="font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            {t('dashboard.recentActivity')}
          </h2>
          <div className="space-y-3">
            {jobs?.data?.slice(0, 5).map((job: any) => (
              <div key={job.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    Job {job.id.substring(0, 8)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(job.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  job.status === 'completed' ? 'bg-green-100 text-green-700' :
                  job.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                  job.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {t(`processing.status.${job.status}`)}
                </span>
              </div>
            ))}
            {(!jobs?.data || jobs.data.length === 0) && (
              <p className="text-slate-500 text-center py-8">{t('processing.noJobs')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
