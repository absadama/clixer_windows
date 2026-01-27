/**
 * Analytics Service Types
 */

import { Request } from 'express';

// ============================================
// AUTHENTICATED REQUEST
// ============================================

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId: string;
    role: string;
    email: string;
    filterLevel?: string;
    filterValue?: string;
    canSeeAllCategories?: boolean;
    categoryIds?: string[];
  };
}

// ============================================
// METRIC TYPES
// ============================================

export interface Metric {
  id: string;
  tenantId: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  datasetId: string;
  datasetName?: string;
  clickhouseTable?: string;
  dbColumn: string;
  aggregationType: string;
  filterSql?: string;
  groupByColumn?: string;
  orderByColumn?: string;
  orderDirection?: 'ASC' | 'DESC';
  visualizationType: string;
  chartConfig?: Record<string, any>;
  formatConfig?: FormatConfig;
  comparisonEnabled?: boolean;
  comparisonType?: string;
  comparisonConfig?: Record<string, any>;
  targetValue?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  isActive: boolean;
  cacheTtl?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormatConfig {
  type?: 'number' | 'currency' | 'percentage' | 'compact';
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export interface MetricExecuteResult {
  value: number | string | any[];
  formattedValue: string;
  comparison?: {
    previousValue: number;
    trend: number;
    label: string;
  };
  chartData?: any[];
  metadata?: Record<string, any>;
}

// ============================================
// DESIGN / DASHBOARD TYPES
// ============================================

export interface Design {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: 'dashboard' | 'report';
  categoryId?: string;
  categoryName?: string;
  layout: WidgetLayout[];
  settings?: DesignSettings;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetLayout {
  i: string;  // Widget ID
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface Widget {
  id: string;
  designId: string;
  type: string;
  title?: string;
  metricId?: string;
  datasetId?: string;
  config: WidgetConfig;
  position: WidgetLayout;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetConfig {
  chartType?: string;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  dateColumn?: string;
  valueColumn?: string;
  groupByColumn?: string;
  aggregation?: string;
  filters?: Record<string, any>;
  limit?: number;
  sql?: string;
  [key: string]: any;
}

export interface DesignSettings {
  refreshInterval?: number;
  theme?: string;
  filters?: Record<string, any>;
  dateRange?: {
    start: string;
    end: string;
  };
}

// ============================================
// COMPARISON TYPES
// ============================================

export type ComparisonType = 'yoy' | 'mom' | 'wow' | 'ytd' | 'lfl';

export interface ComparisonResult {
  currentValue: number;
  previousValue: number;
  trend: number;
  label: string;
}

export interface LFLCalendarConfig {
  datasetId: string;
  thisYearColumn: string;
  lastYearColumn: string;
  clickhouseTable: string;
}

export interface LFLResult {
  currentValue: number;
  previousValue: number;
  trend: number;
  commonDays: number;
  uniqueStores?: number;
  isStoreBased: boolean;
}

// ============================================
// AGGREGATION & VISUALIZATION CONSTANTS
// ============================================

export const AGGREGATION_TYPES = [
  { value: 'sum', label: 'Toplam (SUM)' },
  { value: 'count', label: 'Sayı (COUNT)' },
  { value: 'avg', label: 'Ortalama (AVG)' },
  { value: 'min', label: 'Minimum (MIN)' },
  { value: 'max', label: 'Maksimum (MAX)' },
  { value: 'uniq', label: 'Benzersiz (UNIQ)' },
  { value: 'uniqExact', label: 'Benzersiz Kesin (UNIQEXACT)' },
  { value: 'parameter', label: 'Parametre (PARAMETER)' }
];

export const VISUALIZATION_TYPES = [
  { value: 'kpi', label: 'KPI Kartı', icon: 'trending-up' },
  { value: 'bar', label: 'Bar Chart', icon: 'bar-chart-2' },
  { value: 'line', label: 'Line Chart', icon: 'activity' },
  { value: 'pie', label: 'Pie Chart', icon: 'pie-chart' },
  { value: 'area', label: 'Area Chart', icon: 'layers' },
  { value: 'table', label: 'Tablo', icon: 'table' },
  { value: 'gauge', label: 'Gauge', icon: 'target' },
  { value: 'heatmap', label: 'Heatmap', icon: 'grid' }
];

// ============================================
// QUERY TYPES
// ============================================

export interface QueryParams {
  startDate?: string;
  endDate?: string;
  storeIds?: string[];
  regionIds?: string[];
  ownershipGroupIds?: string[];
  comparison?: ComparisonType;
  groupBy?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface AggregateParams {
  columns: string[];
  groupBy?: string[];
  filters?: Record<string, any>;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
}
