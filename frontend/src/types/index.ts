// Clixer Types - Dinamo Know-How ile zenginleştirilmiş

// ==================== KULLANICI & YETKİ ====================
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGEMENT = 'MANAGEMENT',
  STORE_OWNER = 'STORE_OWNER',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenant_id?: string;
  allowedModules?: string[];
  allowedDesignIds?: string[];
  assignedStoreIds?: string[];
  createdAt: string;
  updatedAt: string;
}

// ==================== MAĞAZA ====================
export enum StoreBrand {
  TOST_DURO = 'TOST_DURO',
  DORELLO = 'DORELLO',
  TAZE_KAPI = 'TAZE_KAPI',
  OTHER = 'OTHER'
}

export enum StoreType {
  STREET = 'STREET',
  AVM = 'AVM',
  PLAZA = 'PLAZA'
}

export interface Store {
  id: string;
  name: string;
  brand: StoreBrand;
  type: StoreType;
  city: string;
  district: string;
  address?: string;
  lat?: number;
  lng?: number;
  isActive: boolean;
  openingDate?: string;
  tenant_id: string;
}

// ==================== VERİ KAYNAĞI ====================
export type DataSourceType = 'DATABASE' | 'API' | 'EXCEL' | 'CSV';

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  apiUrl?: string;
  tenant_id: string;
  isActive: boolean;
  lastSync?: string;
}

export interface Dataset {
  id: string;
  name: string;
  connectionId: string;
  sourceTable: string;
  syncStrategy: 'timestamp' | 'id' | 'date_partition' | 'full_refresh';
  syncSchedule: string;
  referenceColumn?: string;
  rowLimit: number;
  lastSync?: string;
  tenant_id: string;
}

// ==================== LDAP/SSO ====================
export interface LDAPConfig {
  enabled: boolean;
  serverUrl: string;
  baseDN: string;
  bindDN: string;
  bindPassword?: string;
  userSearchFilter: string;
  groupSearchFilter: string;
  defaultRole: UserRole;
}

// ==================== VİZUALİZASYON ====================
export type VisualizationType = 
  | 'card'           // Büyük KPI kartı
  | 'mini_card'      // Küçük KPI kartı
  | 'chart'          // Grafik (line, bar, area, pie)
  | 'grid'           // Tablo/Grid
  | 'gauge'          // Gösterge (gauge/dial)
  | 'sparkline'      // Mini çizgi grafik
  | 'progress_ring'  // Dairesel ilerleme
  | 'comparison'     // Karşılaştırma kartı
  | 'bullet'         // Bullet chart
  | 'heatmap'        // Isı haritası
  | 'treemap'        // Treemap
  | 'waterfall'      // Şelale grafik
  | 'stat_card'      // İstatistik kartı
  | 'kpi_scorecard'  // KPI Scorecard
  | 'pulse_widget'   // Canlı pulse widget
  | 'gamification_widget' // Oyunlaştırma widget
  | 'product_flow_widget'; // Ürün akış widget

export type ChartStyle = 'line' | 'bar' | 'area' | 'pie' | 'donut' | 'radar' | 'scatter';
export type ChartOrientation = 'horizontal' | 'vertical';

// ==================== METRİK FORMATLAMA ====================
export type FormatCondition = 'gt' | 'lt' | 'eq' | 'between';
export type FormatStyle = 'text-green' | 'text-red' | 'text-orange' | 'bg-green' | 'bg-red' | 'icon-up-green' | 'icon-down-red';

export interface FormattingRule {
  condition: FormatCondition;
  value: number;
  value2?: number;
  style: FormatStyle;
}

export interface GridColumn {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'currency' | 'percent' | 'number' | 'date';
  sortable?: boolean;
  formattingRule?: FormattingRule;
}

// ==================== KARŞILAŞTIRMA & HEDEF ====================
export interface ComparisonConfig {
  type: 'previous_period' | 'same_period_last_year' | 'target' | 'custom';
  label: string;
  customMetricId?: string;
}

export interface TargetConfig {
  value: number;
  label: string;
  showOnChart: boolean;
}

// ==================== METRİK TANIMLARI ====================
export type AggregationType = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'DISTINCT_COUNT';
export type MetricValueType = 'currency' | 'percent' | 'number' | 'text' | 'date';

export interface MetricDefinition {
  id: string;
  label: string;
  type: MetricValueType;
  visualizationType: VisualizationType;
  chartStyle?: ChartStyle;
  chartOrientation?: ChartOrientation;
  
  // Veri kaynağı
  datasetId?: string;
  sqlQuery?: string;
  aggregation?: AggregationType;
  
  // Grid için kolonlar
  columns?: GridColumn[];
  rowsPerPage?: number;
  
  // Formatlama
  formattingRules?: FormattingRule[];
  
  // Karşılaştırma
  comparisonConfig?: ComparisonConfig;
  
  // Hedef
  targetConfig?: TargetConfig;
  targetValue?: number;
  
  // Görünüm
  color?: string;
  icon?: string;
  description?: string;
  
  // Grid Layout
  gridX?: number;
  gridY?: number;
  gridW?: number;
  gridH?: number;
  
  tenant_id: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== KPI VERİ ====================
export interface KPIDataPoint {
  [key: string]: string | number | boolean | any[];
}

// ==================== DASHBOARD TASARIMI ====================
export type DashboardType = 'cockpit' | 'analysis' | 'report';
export type TimeResolution = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface MetricLayoutConfig {
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
}

export interface DashboardDesign {
  id: string;
  title: string;
  description?: string;
  type: DashboardType;
  
  // Metrikler
  metrics: string[]; // Metric ID listesi
  layoutConfig: { [metricId: string]: MetricLayoutConfig };
  
  // Erişim
  targetRoles: UserRole[];
  
  // Görünüm
  theme?: 'light' | 'dark' | 'auto';
  refreshInterval?: number; // saniye
  
  tenant_id: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== KULLANICI TERCİHLERİ ====================
export interface UserPreferences {
  theme: 'cinnamon' | 'poster' | 'light' | 'dark';
  language: 'tr' | 'en';
  timezone: string;
  dashboardId?: string;
  sidebarCollapsed: boolean;
}

// ==================== SİSTEM AYARLARI ====================
export interface SystemSetting {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'url' | 'select';
  category: 'general' | 'theme' | 'locale' | 'security' | 'notifications' | 'dashboard' | 'finance';
  label: string;
  description?: string;
  options?: string[]; // select tipi için seçenekler
}

// ==================== DENETİM KAYDI ====================
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ==================== BİLDİRİM ====================
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// ==================== FİNANSAL AYARLAR ====================
export interface FinancialSettings {
  rent_amount: number;
  turnover_rent_share_percent: number;
  common_area_expenses: number;
  other_expenses: number;
  royalty_percent: number;
  marketing_percent: number;
  target_cogs_percent: number;
  other_percent_1: number;
  other_percent_2: number;
  electricity_budget: number;
  water_budget: number;
  
  // Personel
  staff_manager_count: number;
  staff_manager_salary: number;
  staff_kitchen_count: number;
  staff_kitchen_salary: number;
  staff_service_count: number;
  staff_service_salary: number;
  staff_courier_count: number;
  staff_courier_salary: number;
  
  // Yatırım & ROI
  investment_amount: number;
  investment_date: string | null;
}

// ==================== ANOMALİ ====================
export interface Anomaly {
  id: number;
  store_id: string;
  type: 'CANCELLATION' | 'WASTE' | 'DISCOUNT' | 'SERVICE_TIME' | 'INVENTORY';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  value: number;
  detected_at: string;
  is_resolved: boolean;
}

// ==================== GÜNLÜK OPERASYON ====================
export interface DailyOperation {
  store_id: string;
  date: string;
  waste_amount: number;
  cancellation_amount: number;
  avg_service_time: number;
  kitchen_incident_count: number;
  audit_score: number;
  hygiene_score: number;
}

// ==================== ROZET (GAMİFİCATİON) ====================
export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: 'gold' | 'purple' | 'green' | 'red' | 'blue' | 'silver';
  criteria?: string;
}
