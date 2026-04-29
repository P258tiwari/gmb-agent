import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddClient from './pages/AddClient';
import PendingApprovals from './pages/PendingApprovals';
import ClientDetail from './pages/ClientDetail';
import ClientContent from './pages/ClientContent';
import ClientReviews from './pages/ClientReviews';
import ClientCitations from './pages/ClientCitations';
import ClientKeywords from './pages/ClientKeywords';
import ClientReports from './pages/ClientReports';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/pending" element={<ProtectedRoute><PendingApprovals /></ProtectedRoute>} />
            <Route path="/clients/new" element={<ProtectedRoute><AddClient /></ProtectedRoute>} />
            <Route path="/clients/add" element={<ProtectedRoute><AddClient /></ProtectedRoute>} />
            <Route path="/clients/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            <Route path="/clients/:clientId/content" element={<ProtectedRoute><ClientContent /></ProtectedRoute>} />
            <Route path="/clients/:clientId/reviews" element={<ProtectedRoute><ClientReviews /></ProtectedRoute>} />
            <Route path="/clients/:clientId/citations" element={<ProtectedRoute><ClientCitations /></ProtectedRoute>} />
            <Route path="/clients/:clientId/keywords" element={<ProtectedRoute><ClientKeywords /></ProtectedRoute>} />
            <Route path="/clients/:clientId/reports" element={<ProtectedRoute><ClientReports /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
