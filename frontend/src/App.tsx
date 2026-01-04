import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DesignerPage from './pages/DesignerPage'
import DataPage from './pages/DataPage'
import MetricsPage from './pages/MetricsPage'
import SettingsPage from './pages/SettingsPage'
import FinancePage from './pages/FinancePage'
import OperationsPage from './pages/OperationsPage'
import AnalysisPage from './pages/AnalysisPage'
import StoresPage from './pages/StoresPage'
import AdminPage from './pages/AdminPage'
import ProfilePage from './pages/ProfilePage'
import DataGridDemoPage from './pages/DataGridDemoPage'
import api from './services/api'

function App() {
  const { isAuthenticated, hasHydrated, logout, accessToken } = useAuthStore()

  // Sayfa açıldığında token geçerliliğini kontrol et
  useEffect(() => {
    if (hasHydrated && isAuthenticated && accessToken) {
      // Token'ı test et - settings endpoint'i ile
      api.get('/core/settings')
        .catch((err) => {
          if (err.response?.status === 401) {
            logout()
          }
        })
    }
  }, [hasHydrated, isAuthenticated, accessToken, logout])

  // Zustand store henüz localStorage'dan yüklenmediyse bekle
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg text-slate-600 dark:text-slate-400">Yükleniyor...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/designer" element={<DesignerPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/datagrid-demo" element={<DataGridDemoPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
