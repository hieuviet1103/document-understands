import axios from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const documentsApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/v1/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (limit = 50, offset = 0) =>
    apiClient.get(`/api/v1/documents?limit=${limit}&offset=${offset}`),
  get: (id: string) => apiClient.get(`/api/v1/documents/${id}`),
  getPreviewUrl: (id: string) =>
    apiClient.get<{ url: string; filename: string; mime_type: string }>(`/api/v1/documents/${id}/preview-url`),
  delete: (id: string) => apiClient.delete(`/api/v1/documents/${id}`),
};

export const templatesApi = {
  create: (data: any) => apiClient.post('/api/v1/templates', data),
  list: (limit = 50, offset = 0) =>
    apiClient.get(`/api/v1/templates?limit=${limit}&offset=${offset}`),
  get: (id: string) => apiClient.get(`/api/v1/templates/${id}`),
  update: (id: string, data: any) =>
    apiClient.put(`/api/v1/templates/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/templates/${id}`),
};

export const jobsApi = {
  create: (data: any) => apiClient.post('/api/v1/jobs', data),
  list: (status?: string, limit = 50, offset = 0) => {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (status) params.append('status', status);
    return apiClient.get(`/api/v1/jobs?${params.toString()}`);
  },
  get: (id: string) => apiClient.get(`/api/v1/jobs/${id}`),
  getResult: (id: string) => apiClient.get(`/api/v1/jobs/${id}/result`),
  cancel: (id: string) => apiClient.post(`/api/v1/jobs/${id}/cancel`),
  retry: (id: string) => apiClient.post(`/api/v1/jobs/${id}/retry`),
};

export const apiKeysApi = {
  generate: (data: any) => apiClient.post('/api/v1/keys', data),
  list: () => apiClient.get('/api/v1/keys'),
  delete: (id: string) => apiClient.delete(`/api/v1/keys/${id}`),
};

export const webhooksApi = {
  create: (data: any) => apiClient.post('/api/v1/webhooks', data),
  list: () => apiClient.get('/api/v1/webhooks'),
  get: (id: string) => apiClient.get(`/api/v1/webhooks/${id}`),
  update: (id: string, data: any) =>
    apiClient.put(`/api/v1/webhooks/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/webhooks/${id}`),
  getDeliveries: (id: string, limit = 50, offset = 0) =>
    apiClient.get(`/api/v1/webhooks/${id}/deliveries?limit=${limit}&offset=${offset}`),
};

export default apiClient;
