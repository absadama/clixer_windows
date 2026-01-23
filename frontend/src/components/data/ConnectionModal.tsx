/**
 * Connection Modal Component
 * Modal for creating and editing database/API connections
 */

import { useState, useEffect } from 'react'
import { 
  Database, 
  Globe, 
  FileSpreadsheet,
  RefreshCw,
  X,
  CheckCircle,
  AlertCircle,
  Zap,
  Save,
  Server
} from 'lucide-react'
import clsx from 'clsx'
import { useDataApi } from '../../hooks/useDataApi'

// ============================================
// TYPES
// ============================================

export interface Connection {
  id: string
  name: string
  description?: string
  type: 'postgresql' | 'mssql' | 'mysql' | 'api' | 'excel'
  host: string
  port: number
  database_name: string
  username?: string
  status: 'pending' | 'active' | 'error'
  status_message?: string
  last_tested_at?: string
  created_at: string
  api_auth_config?: {
    auth_type: 'none' | 'api_key' | 'bearer' | 'basic'
    api_key?: string
    bearer_token?: string
    basic_username?: string
    basic_password?: string
  }
}

interface ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingConnection?: Connection | null
  theme: any
  isDark: boolean
}

type ConnectionCategory = 'database' | 'api' | 'excel'
type DbType = 'postgresql' | 'mssql' | 'mysql'
type ApiAuthType = 'none' | 'api_key' | 'bearer' | 'basic'

// ============================================
// COMPONENT
// ============================================

export function ConnectionModal({ isOpen, onClose, onSuccess, editingConnection, theme, isDark }: ConnectionModalProps) {
  const { apiCall } = useDataApi()
  
  // Ana kategori: database, api, excel
  const [category, setCategory] = useState<ConnectionCategory>('database')
  
  // Database ayarları
  const [dbType, setDbType] = useState<DbType>('postgresql')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('5432')
  const [database, setDatabase] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  
  // API ayarları
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiAuthType, setApiAuthType] = useState<ApiAuthType>('none')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key')
  const [bearerToken, setBearerToken] = useState('')
  const [basicUsername, setBasicUsername] = useState('')
  const [basicPassword, setBasicPassword] = useState('')
  
  // Excel/CSV ayarları
  const [fileType, setFileType] = useState<'xlsx' | 'csv'>('xlsx')
  const [filePath, setFilePath] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  
  // Ortak alanlar
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Düzenleme modunda form alanlarını doldur
  useEffect(() => {
    if (editingConnection) {
      setName(editingConnection.name || '')
      setDescription(editingConnection.description || '')
      
      if (editingConnection.type === 'api') {
        setCategory('api')
        setApiBaseUrl(editingConnection.host || '')
        const authConfig = (editingConnection.api_auth_config || {}) as any
        if (authConfig.type) {
          setApiAuthType(authConfig.type as ApiAuthType)
          if (authConfig.type === 'api_key') {
            setApiKey(authConfig.api_key || '')
            setApiKeyHeader(authConfig.header_name || 'X-API-Key')
          } else if (authConfig.type === 'bearer') {
            setBearerToken(authConfig.token || '')
          } else if (authConfig.type === 'basic') {
            setBasicUsername(authConfig.username || '')
            setBasicPassword(authConfig.password || '')
          }
        }
      } else if (editingConnection.type === 'excel') {
        setCategory('excel')
        setFilePath(editingConnection.host || '')
      } else {
        setCategory('database')
        setDbType((editingConnection.type as DbType) || 'postgresql')
        setHost(editingConnection.host || '')
        setPort(String(editingConnection.port || 5432))
        setDatabase(editingConnection.database_name || '')
        setUsername(editingConnection.username || '')
      }
    }
  }, [editingConnection])

  // DB type değişince port güncelle
  useEffect(() => {
    if (!editingConnection) {
      if (dbType === 'postgresql') setPort('5432')
      else if (dbType === 'mssql') setPort('1433')
      else if (dbType === 'mysql') setPort('3306')
    }
  }, [dbType, editingConnection])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setError(null)

    try {
      let testPayload: any = { category }
      
      if (category === 'database') {
        testPayload = {
          ...testPayload,
          type: dbType,
          host,
          port: parseInt(port),
          databaseName: database,
          username,
          password,
        }
      } else if (category === 'api') {
        testPayload = {
          ...testPayload,
          type: 'api',
          apiBaseUrl,
          apiAuthType,
          apiAuthConfig: apiAuthType === 'api_key' 
            ? { apiKey, headerName: apiKeyHeader }
            : apiAuthType === 'bearer'
            ? { token: bearerToken }
            : apiAuthType === 'basic'
            ? { username: basicUsername, password: basicPassword }
            : undefined
        }
      } else if (category === 'excel') {
        testPayload = {
          ...testPayload,
          type: 'excel',
          filePath,
          fileType,
          sheetName,
          hasHeader
        }
      }
      
      const result = await apiCall('/data/connections/test', {
        method: 'POST',
        body: JSON.stringify(testPayload),
        showErrorToast: false
      })
      
      if (result.success) {
        setTestResult({ success: true, message: result.data?.message || 'Bağlantı başarılı!' })
      } else {
        setTestResult({ success: false, message: result.message || 'Bağlantı başarısız' })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!name) {
      setError('Bağlantı adı gerekli')
      return
    }
    
    if (category === 'database' && (!host || !database || !username)) {
      setError('Host, veritabanı adı ve kullanıcı adı gerekli')
      return
    }
    
    if (category === 'api' && !apiBaseUrl) {
      setError('API Base URL gerekli')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let savePayload: any = { name, description, category }
      
      if (category === 'database') {
        savePayload = {
          ...savePayload,
          type: dbType,
          host,
          port: parseInt(port),
          databaseName: database,
          username,
          password,
        }
      } else if (category === 'api') {
        savePayload = {
          ...savePayload,
          type: 'api',
          apiBaseUrl,
          apiAuthType,
          apiAuthConfig: apiAuthType === 'api_key' 
            ? { apiKey, headerName: apiKeyHeader }
            : apiAuthType === 'bearer'
            ? { token: bearerToken }
            : apiAuthType === 'basic'
            ? { username: basicUsername, password: basicPassword }
            : undefined
        }
      } else if (category === 'excel') {
        savePayload = {
          ...savePayload,
          type: 'excel',
          filePath,
          fileType,
          sheetName,
          hasHeader
        }
      }
      
      // Düzenleme modunda PUT, yeni bağlantıda POST
      const result = editingConnection 
        ? await apiCall(`/data/connections/${editingConnection.id}`, {
            method: 'PUT',
            body: JSON.stringify(savePayload),
            showSuccessToast: true,
            successMessage: 'Bağlantı güncellendi'
          })
        : await apiCall('/data/connections', {
            method: 'POST',
            body: JSON.stringify(savePayload),
            showSuccessToast: true,
            successMessage: 'Bağlantı oluşturuldu'
          })
      
      if (result.success) {
        onSuccess()
      } else {
        setError(result.message || 'Kayıt başarısız')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const dbSources = [
    { type: 'postgresql' as DbType, icon: Database, label: 'PostgreSQL', color: 'text-blue-500', desc: 'Open source RDBMS' },
    { type: 'mssql' as DbType, icon: Server, label: 'SQL Server', color: 'text-red-500', desc: 'Microsoft SQL / Azure' },
    { type: 'mysql' as DbType, icon: Database, label: 'MySQL', color: 'text-orange-500', desc: 'MySQL / MariaDB' },
  ]

  const isFormValid = category === 'database' 
    ? (host && database && username)
    : category === 'api' 
    ? apiBaseUrl 
    : filePath

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={clsx(
        'w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden',
        theme.cardBg
      )}>
        {/* Header */}
        <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <h2 className={clsx('text-xl font-bold', theme.cardTitle)}>
            {editingConnection ? 'Bağlantıyı Düzenle' : 'Yeni Bağlantı'}
          </h2>
          <button onClick={onClose} className={clsx('p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700', theme.contentText)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Category Selection */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Bağlantı Tipi</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: 'database' as ConnectionCategory, icon: Database, label: 'Veritabanı', desc: 'PostgreSQL, SQL Server, MySQL' },
                { type: 'api' as ConnectionCategory, icon: Globe, label: 'REST API', desc: 'HTTP/HTTPS endpoints' },
                { type: 'excel' as ConnectionCategory, icon: FileSpreadsheet, label: 'Excel/CSV', desc: 'Dosya veya URL' },
              ].map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => setCategory(type)}
                  className={clsx(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    category === type
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                  )}
                >
                  <Icon className={clsx('h-6 w-6 mb-2', category === type ? 'text-indigo-500' : 'text-slate-400')} />
                  <div className={clsx('font-semibold text-sm', theme.contentText)}>{label}</div>
                  <div className="text-xs text-slate-500 mt-1">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Name */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Bağlantı Adı *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Production DB"
              className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
            />
          </div>

          {/* Database Fields */}
          {category === 'database' && (
            <>
              <div className={clsx('border-t pt-4', isDark ? 'border-slate-700' : 'border-slate-200')}>
                <h4 className={clsx('text-sm font-bold flex items-center gap-2 mb-4', theme.contentText)}>
                  <Database className="h-4 w-4 text-indigo-500" /> Veritabanı Seçimi
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {dbSources.map(({ type, icon: Icon, label, color, desc }) => (
                    <button
                      key={type}
                      onClick={() => setDbType(type)}
                      className={clsx(
                        'p-3 rounded-lg border-2 text-left transition-all',
                        dbType === type
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                      )}
                    >
                      <Icon className={clsx('h-5 w-5 mb-1', color)} />
                      <div className={clsx('font-medium text-sm', theme.contentText)}>{label}</div>
                      <div className="text-xs text-slate-500">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Host *</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost veya IP"
                    className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Port</label>
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>
              </div>

              <div>
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Veritabanı Adı *</label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="my_database"
                  className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Kullanıcı Adı *</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="postgres"
                    className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Şifre</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>
              </div>
            </>
          )}

          {/* API Fields */}
          {category === 'api' && (
            <div className={clsx('border-t pt-4', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <h4 className={clsx('text-sm font-bold flex items-center gap-2 mb-4', theme.contentText)}>
                <Globe className="h-4 w-4 text-emerald-500" /> API Ayarları
              </h4>
              
              <div className="mb-4">
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Base URL *</label>
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                />
              </div>

              <div className="mb-4">
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Kimlik Doğrulama</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { type: 'none' as ApiAuthType, label: 'Yok' },
                    { type: 'api_key' as ApiAuthType, label: 'API Key' },
                    { type: 'bearer' as ApiAuthType, label: 'Bearer Token' },
                    { type: 'basic' as ApiAuthType, label: 'Basic Auth' },
                  ].map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => setApiAuthType(type)}
                      className={clsx(
                        'p-2 rounded-lg border-2 text-xs font-medium transition-all',
                        apiAuthType === type
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                          : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {apiAuthType === 'api_key' && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk_live_..."
                      className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Header Adı</label>
                    <input
                      type="text"
                      value={apiKeyHeader}
                      onChange={(e) => setApiKeyHeader(e.target.value)}
                      placeholder="X-API-Key"
                      className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                </div>
              )}

              {apiAuthType === 'bearer' && (
                <div className="mb-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Bearer Token</label>
                  <input
                    type="password"
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                    className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>
              )}

              {apiAuthType === 'basic' && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Kullanıcı Adı</label>
                    <input
                      type="text"
                      value={basicUsername}
                      onChange={(e) => setBasicUsername(e.target.value)}
                      className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Şifre</label>
                    <input
                      type="password"
                      value={basicPassword}
                      onChange={(e) => setBasicPassword(e.target.value)}
                      className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Excel Fields */}
          {category === 'excel' && (
            <div className={clsx('border-t pt-4', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <h4 className={clsx('text-sm font-bold flex items-center gap-2 mb-4', theme.contentText)}>
                <FileSpreadsheet className="h-4 w-4 text-green-500" /> Excel / CSV Ayarları
              </h4>
              
              <div className="mb-4">
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Dosya Tipi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFileType('xlsx')}
                    className={clsx(
                      'p-2 rounded-lg border-2 text-sm font-medium transition-all',
                      fileType === 'xlsx'
                        ? 'border-green-500 bg-green-500/10 text-green-600'
                        : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                    )}
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => setFileType('csv')}
                    className={clsx(
                      'p-2 rounded-lg border-2 text-sm font-medium transition-all',
                      fileType === 'csv'
                        ? 'border-green-500 bg-green-500/10 text-green-600'
                        : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                    )}
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Dosya Yolu veya URL</label>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="/data/sales.xlsx veya https://..."
                  className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                />
              </div>

              {fileType === 'xlsx' && (
                <div className="mb-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sayfa Adı (Opsiyonel)</label>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="Sheet1 (boş bırakılırsa ilk sayfa)"
                    className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>
              )}

              <label className={clsx(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer',
                isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
              )}>
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                  className="w-5 h-5 text-green-600 rounded"
                />
                <span className={clsx('font-medium text-sm', theme.contentText)}>İlk satır başlık satırı</span>
              </label>
            </div>
          )}

          {/* Description */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsiyonel açıklama..."
              rows={2}
              className={clsx('w-full px-3 py-2 rounded-lg border resize-none', theme.inputBg, theme.inputText, theme.inputBorder)}
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={clsx(
              'p-3 rounded-lg flex items-center gap-2',
              testResult.success 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                : 'bg-red-500/10 border border-red-500/20 text-red-500'
            )}>
              {testResult.success ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={clsx('px-6 py-4 border-t flex items-center justify-between', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <button
            onClick={handleTest}
            disabled={testing || !isFormValid}
            className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
              (testing || !isFormValid) ? 'opacity-50 cursor-not-allowed' : '',
              theme.buttonSecondary
            )}
          >
            {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Bağlantıyı Test Et
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={clsx('px-4 py-2 rounded-lg', theme.buttonSecondary)}
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name || !isFormValid}
              className={clsx(
                'px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 flex items-center gap-2',
                (saving || !name || !isFormValid) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingConnection ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionModal
