import { Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from '@/contexts/SessionContext';
import { RootLayout } from '@/layout/RootLayout';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { AdminPage } from '@/pages/AdminPage';
import { CallsPage } from '@/pages/CallsPage';
import { ClientPage } from '@/pages/ClientPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { LoginPage } from '@/pages/LoginPage';

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients/:id" element={<ClientPage />} />
          <Route path="/clients/:id/calls" element={<CallsPage />} />
          <Route path="/clients/:id/documents" element={<DocumentsPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </SessionProvider>
  );
}
