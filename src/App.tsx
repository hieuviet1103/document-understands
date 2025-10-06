import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="documents" element={<div className="p-6"><h1 className="text-2xl font-bold">Documents Page - Coming Soon</h1></div>} />
        <Route path="templates" element={<div className="p-6"><h1 className="text-2xl font-bold">Templates Page - Coming Soon</h1></div>} />
        <Route path="processing" element={<div className="p-6"><h1 className="text-2xl font-bold">Processing Page - Coming Soon</h1></div>} />
        <Route path="api-keys" element={<div className="p-6"><h1 className="text-2xl font-bold">API Keys Page - Coming Soon</h1></div>} />
        <Route path="webhooks" element={<div className="p-6"><h1 className="text-2xl font-bold">Webhooks Page - Coming Soon</h1></div>} />
        <Route path="settings" element={<div className="p-6"><h1 className="text-2xl font-bold">Settings Page - Coming Soon</h1></div>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
