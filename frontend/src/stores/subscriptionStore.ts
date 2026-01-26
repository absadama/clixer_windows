/**
 * Subscription Store
 * Zustand store for report subscriptions management
 */

import { create } from 'zustand';

// ============================================
// TYPES
// ============================================

export interface Recipient {
  id: string;
  name: string;
  email: string;
}

export interface SubscriptionLog {
  action: string;
  status: string;
  created_at: string;
  error_message?: string;
  execution_time_ms?: number;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  design_id: string | null;
  design_name?: string;
  design_type: 'cockpit' | 'analysis';
  recipient_user_ids: string[];
  recipients?: Recipient[];
  recipient_emails: string[];
  schedule_cron: string;
  schedule_timezone: string;
  schedule_description: string | null;
  is_active: boolean;
  last_sent_at: string | null;
  last_error: string | null;
  send_count: number;
  error_count: number;
  total_sent?: number;
  recent_logs?: SubscriptionLog[];
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSettings {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password?: string; // Only for updates, never returned
  from_email: string;
  from_name: string;
  is_configured: boolean;
  last_test_at?: string;
  last_test_result?: string;
}

export interface Design {
  id: string;
  name: string;
  type: 'cockpit' | 'analysis';
  description?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ============================================
// STATE INTERFACE
// ============================================

interface SubscriptionState {
  // Data
  subscriptions: Subscription[];
  selectedSubscription: Subscription | null;
  emailSettings: EmailSettings | null;
  designs: Design[];
  users: User[];

  // UI State
  loading: boolean;
  saving: boolean;
  testing: boolean;
  error: string | null;

  // Modal State
  showSubscriptionModal: boolean;
  showEmailSettingsModal: boolean;
  editingSubscription: Subscription | null;
}

interface SubscriptionActions {
  // Data setters
  setSubscriptions: (subscriptions: Subscription[] | ((prev: Subscription[]) => Subscription[])) => void;
  setSelectedSubscription: (subscription: Subscription | null) => void;
  setEmailSettings: (settings: EmailSettings | null) => void;
  setDesigns: (designs: Design[]) => void;
  setUsers: (users: User[]) => void;

  // UI setters
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setTesting: (testing: boolean) => void;
  setError: (error: string | null) => void;

  // Modal setters
  setShowSubscriptionModal: (show: boolean) => void;
  setShowEmailSettingsModal: (show: boolean) => void;
  setEditingSubscription: (subscription: Subscription | null) => void;

  // Actions
  openCreateModal: () => void;
  openEditModal: (subscription: Subscription) => void;
  closeSubscriptionModal: () => void;
  openEmailSettingsModal: () => void;
  closeEmailSettingsModal: () => void;

  // Update helpers
  updateSubscriptionInList: (updated: Subscription) => void;
  removeSubscriptionFromList: (id: string) => void;

  // Reset
  reset: () => void;
}

// ============================================
// INITIAL STATE
// ============================================

const initialState: SubscriptionState = {
  subscriptions: [],
  selectedSubscription: null,
  emailSettings: null,
  designs: [],
  users: [],

  loading: false,
  saving: false,
  testing: false,
  error: null,

  showSubscriptionModal: false,
  showEmailSettingsModal: false,
  editingSubscription: null
};

// ============================================
// STORE
// ============================================

export const useSubscriptionStore = create<SubscriptionState & SubscriptionActions>((set) => ({
  ...initialState,

  // Data setters with functional update support
  setSubscriptions: (subscriptionsOrUpdater) => set((state) => ({
    subscriptions: typeof subscriptionsOrUpdater === 'function'
      ? subscriptionsOrUpdater(state.subscriptions)
      : subscriptionsOrUpdater
  })),

  setSelectedSubscription: (subscription) => set({ selectedSubscription: subscription }),
  setEmailSettings: (settings) => set({ emailSettings: settings }),
  setDesigns: (designs) => set({ designs }),
  setUsers: (users) => set({ users }),

  // UI setters
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setTesting: (testing) => set({ testing }),
  setError: (error) => set({ error }),

  // Modal setters
  setShowSubscriptionModal: (show) => set({ showSubscriptionModal: show }),
  setShowEmailSettingsModal: (show) => set({ showEmailSettingsModal: show }),
  setEditingSubscription: (subscription) => set({ editingSubscription: subscription }),

  // Actions
  openCreateModal: () => set({
    showSubscriptionModal: true,
    editingSubscription: null
  }),

  openEditModal: (subscription) => set({
    showSubscriptionModal: true,
    editingSubscription: subscription
  }),

  closeSubscriptionModal: () => set({
    showSubscriptionModal: false,
    editingSubscription: null
  }),

  openEmailSettingsModal: () => set({ showEmailSettingsModal: true }),
  closeEmailSettingsModal: () => set({ showEmailSettingsModal: false }),

  // Update helpers
  updateSubscriptionInList: (updated) => set((state) => ({
    subscriptions: state.subscriptions.map(sub =>
      sub.id === updated.id ? { ...sub, ...updated } : sub
    )
  })),

  removeSubscriptionFromList: (id) => set((state) => ({
    subscriptions: state.subscriptions.filter(sub => sub.id !== id)
  })),

  // Reset
  reset: () => set(initialState)
}));
