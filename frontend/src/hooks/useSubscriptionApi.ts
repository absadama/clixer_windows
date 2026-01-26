/**
 * Subscription API Hook
 * API calls for report subscriptions and email settings
 */

import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore, Subscription, EmailSettings } from '../stores/subscriptionStore';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ============================================
// HOOK
// ============================================

export function useSubscriptionApi() {
  const { accessToken, logout } = useAuthStore();
  const {
    setSubscriptions,
    setEmailSettings,
    setDesigns,
    setUsers,
    setLoading,
    setSaving,
    setTesting,
    setError,
    updateSubscriptionInList,
    removeSubscriptionFromList
  } = useSubscriptionStore();

  // ============================================
  // API CALL HELPER
  // ============================================

  const apiCall = useCallback(async <T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    if (!accessToken) {
      throw new Error('Oturum gerekli');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    });

    // Handle 401
    if (response.status === 401) {
      logout();
      window.location.href = '/login';
      throw new Error('Oturum süresi doldu');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'API hatası');
    }

    return data;
  }, [accessToken, logout]);

  // ============================================
  // SUBSCRIPTIONS API
  // ============================================

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall<{ success: boolean; data: Subscription[] }>(
        '/notification/subscriptions'
      );
      setSubscriptions(result.data || []);
    } catch (error: any) {
      setError(error.message);
      toast.error('Abonelikler yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [apiCall, setSubscriptions, setLoading, setError]);

  const getSubscription = useCallback(async (id: string): Promise<Subscription | null> => {
    try {
      const result = await apiCall<{ success: boolean; data: Subscription }>(
        `/notification/subscriptions/${id}`
      );
      return result.data;
    } catch (error: any) {
      toast.error('Abonelik detayları alınamadı: ' + error.message);
      return null;
    }
  }, [apiCall]);

  const createSubscription = useCallback(async (data: Partial<Subscription>): Promise<Subscription | null> => {
    setSaving(true);

    try {
      const result = await apiCall<{ success: boolean; data: Subscription }>(
        '/notification/subscriptions',
        {
          method: 'POST',
          body: JSON.stringify(data)
        }
      );

      setSubscriptions(prev => [result.data, ...prev]);
      toast.success('Abonelik oluşturuldu');
      return result.data;
    } catch (error: any) {
      toast.error('Abonelik oluşturulamadı: ' + error.message);
      return null;
    } finally {
      setSaving(false);
    }
  }, [apiCall, setSubscriptions, setSaving]);

  const updateSubscription = useCallback(async (
    id: string,
    data: Partial<Subscription>
  ): Promise<Subscription | null> => {
    setSaving(true);

    try {
      const result = await apiCall<{ success: boolean; data: Subscription }>(
        `/notification/subscriptions/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(data)
        }
      );

      updateSubscriptionInList(result.data);
      toast.success('Abonelik güncellendi');
      return result.data;
    } catch (error: any) {
      toast.error('Abonelik güncellenemedi: ' + error.message);
      return null;
    } finally {
      setSaving(false);
    }
  }, [apiCall, updateSubscriptionInList, setSaving]);

  const deleteSubscription = useCallback(async (id: string): Promise<boolean> => {
    setSaving(true);

    try {
      await apiCall(`/notification/subscriptions/${id}`, { method: 'DELETE' });
      removeSubscriptionFromList(id);
      toast.success('Abonelik silindi');
      return true;
    } catch (error: any) {
      toast.error('Abonelik silinemedi: ' + error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [apiCall, removeSubscriptionFromList, setSaving]);

  const toggleSubscription = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await apiCall<{ success: boolean; data: { id: string; is_active: boolean } }>(
        `/notification/subscriptions/${id}/toggle`,
        { method: 'POST' }
      );

      setSubscriptions(prev => prev.map(sub =>
        sub.id === id ? { ...sub, is_active: result.data.is_active } : sub
      ));

      toast.success(result.data.is_active ? 'Abonelik aktifleştirildi' : 'Abonelik durduruldu');
      return true;
    } catch (error: any) {
      toast.error('İşlem başarısız: ' + error.message);
      return false;
    }
  }, [apiCall, setSubscriptions]);

  const sendNow = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiCall(`/notification/subscriptions/${id}/send-now`, { method: 'POST' });
      toast.success('Gönderim tetiklendi');
      return true;
    } catch (error: any) {
      toast.error('Gönderim tetiklenemedi: ' + error.message);
      return false;
    }
  }, [apiCall]);

  // ============================================
  // EMAIL SETTINGS API
  // ============================================

  const loadEmailSettings = useCallback(async () => {
    try {
      const result = await apiCall<{ success: boolean; data: EmailSettings }>(
        '/notification/email-settings'
      );
      setEmailSettings(result.data);
    } catch (error: any) {
      // Don't show error if not configured yet
      setEmailSettings({
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: '',
        from_email: '',
        from_name: 'Clixer Analytics',
        is_configured: false
      });
    }
  }, [apiCall, setEmailSettings]);

  const saveEmailSettings = useCallback(async (data: Partial<EmailSettings>): Promise<boolean> => {
    setSaving(true);

    try {
      const result = await apiCall<{ success: boolean; data: EmailSettings }>(
        '/notification/email-settings',
        {
          method: 'PUT',
          body: JSON.stringify(data)
        }
      );

      setEmailSettings(result.data);
      toast.success('Email ayarları kaydedildi');
      return true;
    } catch (error: any) {
      toast.error('Email ayarları kaydedilemedi: ' + error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [apiCall, setEmailSettings, setSaving]);

  const testEmailSettings = useCallback(async (): Promise<{ success: boolean; duration_ms?: number }> => {
    setTesting(true);

    try {
      const result = await apiCall<{ success: boolean; message: string; duration_ms?: number }>(
        '/notification/email-settings/test',
        { method: 'POST' }
      );

      toast.success(result.message || 'SMTP bağlantısı başarılı');
      return { success: true, duration_ms: result.duration_ms };
    } catch (error: any) {
      toast.error(error.message || 'SMTP bağlantısı başarısız');
      return { success: false };
    } finally {
      setTesting(false);
    }
  }, [apiCall, setTesting]);

  const deleteEmailSettings = useCallback(async (): Promise<boolean> => {
    setSaving(true);

    try {
      await apiCall('/notification/email-settings', { method: 'DELETE' });
      setEmailSettings({
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: '',
        from_email: '',
        from_name: 'Clixer Analytics',
        is_configured: false
      });
      toast.success('Email ayarları silindi');
      return true;
    } catch (error: any) {
      toast.error('Email ayarları silinemedi: ' + error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [apiCall, setEmailSettings, setSaving]);

  // ============================================
  // REFERENCE DATA API
  // ============================================

  const loadDesigns = useCallback(async () => {
    try {
      const result = await apiCall<{ success: boolean; data: any[] }>(
        '/analytics/designs'
      );
      setDesigns(result.data || []);
    } catch (error: any) {
      console.error('Failed to load designs:', error);
    }
  }, [apiCall, setDesigns]);

  const loadUsers = useCallback(async () => {
    try {
      const result = await apiCall<{ success: boolean; data: any[] }>(
        '/core/users'
      );
      setUsers(result.data || []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
    }
  }, [apiCall, setUsers]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSubscriptions(),
        loadEmailSettings(),
        loadDesigns(),
        loadUsers()
      ]);
    } finally {
      setLoading(false);
    }
  }, [loadSubscriptions, loadEmailSettings, loadDesigns, loadUsers, setLoading]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Subscriptions
    loadSubscriptions,
    getSubscription,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    toggleSubscription,
    sendNow,

    // Email Settings
    loadEmailSettings,
    saveEmailSettings,
    testEmailSettings,
    deleteEmailSettings,

    // Reference Data
    loadDesigns,
    loadUsers,
    loadAllData
  };
}
