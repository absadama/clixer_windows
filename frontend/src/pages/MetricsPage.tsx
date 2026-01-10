/**
 * Clixer - Metrics Management Page
 * Metrik oluşturma, düzenleme ve yönetim
 */

import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Eye, Search, Filter, ChevronRight,
  BarChart3, LineChart, PieChart, TrendingUp, Hash, Gauge,
  Target, Table2, Trophy, Activity, GitCompare, Loader,
  Database, Zap, RefreshCw, X, Check, Copy, Play,
  ArrowUp, ArrowDown, Minus, Settings
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../components/Layout';
import clsx from 'clsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Types
interface Metric {
  id: string;
  name: string;
  label: string;
  description: string | null;
  icon: string;
  color: string;
  datasetId: string | null;
  datasetName: string | null;
  clickhouseTable: string | null;
  dbColumn: string | null;
  aggregationType: string;
  filterSql: string | null;
  groupByColumn: string | null;
  orderByColumn: string | null;
  orderDirection: string;
  visualizationType: string;
  chartConfig: any;
  formatConfig: any;
  comparisonEnabled: boolean;
  comparisonType: string | null;
  targetValue: number | null;
  defaultWidth: number;
  defaultHeight: number;
  isActive: boolean;
  cacheTtl: number;
  createdAt: string;
  // SQL Modu
  useSqlMode?: boolean;
  use_sql_mode?: boolean;
  customSql?: string;
  custom_sql?: string;
}

interface Dataset {
  id: string;
  name: string;
  clickhouse_table: string;
  partition_column?: string;
  reference_column?: string;
}

// Tarih tipi kolon tespiti için yardımcı fonksiyon
const isDateColumn = (columnName: string): boolean => {
  const datePatterns = ['date', 'tarih', 'time', 'day', 'month', 'year', 'created', 'updated', 'modified', 'report'];
  return datePatterns.some(pattern => columnName.toLowerCase().includes(pattern));
};

interface AggregationType {
  value: string;
  label: string;
  description: string;
  icon: string;
}

interface VisualizationType {
  value: string;
  label: string;
  category: string;
  icon: string;
}

// Icon mapper
const iconMap: Record<string, React.ComponentType<any>> = {
  BarChart3, LineChart, PieChart, TrendingUp, Hash, Gauge,
  Target, Table2, Trophy, Activity, GitCompare, Loader,
  Database, Zap, ArrowUp, ArrowDown, Minus
};

// Props for embedded use
interface MetricsPageProps {
  embedded?: boolean;
}

const MetricsPage: React.FC<MetricsPageProps> = ({ embedded = false }) => {
  const { accessToken } = useAuthStore();
  const { theme, isDark } = useTheme();
  
  // State
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [aggregationTypes, setAggregationTypes] = useState<AggregationType[]>([]);
  const [visualizationTypes, setVisualizationTypes] = useState<VisualizationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDataset, setFilterDataset] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: '',
    icon: 'BarChart3',
    color: '#3B82F6',
    colorMode: 'none' as 'none' | 'accent' | 'full', // Renk modu: none (sade), accent (üst bar), full (tam arka plan)
    borderStyle: 'rounded' as 'rounded' | 'sharp' | 'pill', // Köşe stili
    showPeriodLabel: true, // Tarih etiketi göster/gizle
    datasetId: '',
    dbColumn: '',
    aggregationType: 'SUM',
    filterSql: '',
    groupByColumn: '',
    orderByColumn: '',
    orderDirection: 'DESC',
    visualizationType: 'kpi_card',
    formatType: 'number',
    formatPrefix: '',
    formatSuffix: '',
    comparisonEnabled: false,
    comparisonType: 'yoy', // Varsayılan: Geçen Yıl Aynı Gün
    // LFL Takvim Ayarları
    lflCalendarDatasetId: '',
    lflThisYearColumn: 'this_year',
    lflLastYearColumn: 'last_year',
    comparisonColumn: '', // Karşılaştırma için tarih kolonu
    comparisonLabel: '', // Karşılaştırma etiketi (opsiyonel)
    targetValue: '',
    targetColumn: '', // Hedef için kolon (dinamik hedef)
    defaultWidth: 3,
    defaultHeight: 2,
    cacheTtl: 300,
    // Grid/Ranking için çoklu kolon
    selectedColumns: [] as { column: string; label: string; visible: boolean }[],
    // SQL Modu - Serbest SQL sorgusu ile metrik
    useSqlMode: false,
    customSql: '',
    // Limit (Top N)
    limit: 0, // 0 = limitsiz
    // Sıralama Listesi - Trend Hesaplama
    autoCalculateTrend: false, // Backend otomatik trend hesaplasın mı?
    trendComparisonType: 'mom' as 'mom' | 'yoy' | 'wow', // Trend karşılaştırma tipi
  });
  
  // API helper
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_BASE}/analytics${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API hatası');
    }
    
    return response.json();
  };
  
  // Load data - accessToken hazır olduğunda
  useEffect(() => {
    if (accessToken) {
      loadData();
    }
  }, [accessToken]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Paralel API çağrıları
      const [metricsRes, typesRes] = await Promise.all([
        apiCall('/metrics'),
        apiCall('/metric-types')
      ]);
      
      // Dataset'leri ayrı çek (data-service)
      let datasetsData: Dataset[] = [];
      try {
        const dsRes = await fetch(`${API_BASE}/data/datasets`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (dsRes.ok) {
          const dsJson = await dsRes.json();
          datasetsData = dsJson.data || [];
        } else {
          console.warn('Dataset API error:', dsRes.status, dsRes.statusText);
        }
      } catch (dsErr) {
        console.warn('Dataset yükleme hatası:', dsErr);
      }
      
      setMetrics(metricsRes.data || []);
      setDatasets(datasetsData);
      setAggregationTypes(typesRes.data?.aggregationTypes || []);
      setVisualizationTypes(typesRes.data?.visualizationTypes || []);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Dataset değişince kolonları yükle
  const loadColumns = async (datasetId: string) => {
    if (!datasetId) {
      setColumns([]);
      return;
    }
    
    try {
      // Önce datasets'ten bul
      let tableName = '';
      const dataset = datasets.find(d => d.id === datasetId);
      if (dataset?.clickhouse_table) {
        tableName = dataset.clickhouse_table;
      } else {
        // Dataset detayını API'den çek
        const dsRes = await fetch(`${API_BASE}/data/datasets/${datasetId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (dsRes.ok) {
          const dsJson = await dsRes.json();
          tableName = dsJson.data?.clickhouse_table || '';
        }
      }
      
      if (tableName) {
        const res = await apiCall(`/clickhouse/tables/${tableName}/columns`);
        const colNames = (res.data || []).map((c: any) => c.name);
        setColumns(colNames);
      }
    } catch (error) {
      console.error('Load columns error:', error);
    }
  };
  
  // Modal aç
  const openModal = (metric?: Metric) => {
    if (metric) {
      setEditingMetric(metric);
      setFormData({
        name: metric.name,
        label: metric.label,
        description: metric.description || '',
        icon: metric.icon,
        color: metric.color,
        colorMode: (metric.chartConfig?.colorMode || 'none') as 'none' | 'accent' | 'full',
        borderStyle: (metric.chartConfig?.borderStyle || 'rounded') as 'rounded' | 'sharp' | 'pill',
        showPeriodLabel: metric.chartConfig?.showPeriodLabel !== false, // Varsayılan true
        datasetId: metric.datasetId || '',
        dbColumn: metric.dbColumn || '',
        aggregationType: metric.aggregationType,
        filterSql: metric.filterSql || '',
        groupByColumn: metric.groupByColumn || '',
        orderByColumn: metric.orderByColumn || '',
        orderDirection: metric.orderDirection,
        visualizationType: metric.visualizationType,
        formatType: metric.formatConfig?.type || 'number',
        formatPrefix: metric.formatConfig?.prefix || '',
        formatSuffix: metric.formatConfig?.suffix || '',
        comparisonEnabled: metric.comparisonEnabled,
        comparisonType: metric.comparisonType || 'yoy',
        comparisonColumn: metric.chartConfig?.comparisonColumn || '',
        comparisonLabel: metric.chartConfig?.comparisonLabel || '',
        targetValue: metric.targetValue?.toString() || '',
        targetColumn: metric.chartConfig?.targetColumn || '',
        defaultWidth: metric.defaultWidth,
        defaultHeight: metric.defaultHeight,
        cacheTtl: metric.cacheTtl,
        selectedColumns: metric.chartConfig?.gridColumns || [],
        // SQL Modu - önce doğrudan alandan, yoksa chartConfig'den oku
        useSqlMode: metric.useSqlMode || metric.use_sql_mode || metric.chartConfig?.useSqlMode || false,
        customSql: metric.customSql || metric.custom_sql || metric.chartConfig?.customSql || '',
        // Limit (Top N)
        limit: metric.chartConfig?.limit || 0,
        // Sıralama Listesi - Trend Hesaplama
        autoCalculateTrend: metric.chartConfig?.autoCalculateTrend || false,
        trendComparisonType: (metric.chartConfig?.trendComparisonType || 'mom') as 'mom' | 'yoy' | 'wow',
        // LFL Takvim Ayarları
        lflCalendarDatasetId: metric.chartConfig?.lflCalendarDatasetId || '',
        lflThisYearColumn: metric.chartConfig?.lflThisYearColumn || 'this_year',
        lflLastYearColumn: metric.chartConfig?.lflLastYearColumn || 'last_year',
      });
      if (metric.datasetId) {
        loadColumns(metric.datasetId);
      }
    } else {
      setEditingMetric(null);
      setFormData({
        name: '',
        label: '',
        description: '',
        icon: 'BarChart3',
        color: '#3B82F6',
        colorMode: 'none' as 'none' | 'accent' | 'full',
        borderStyle: 'rounded' as 'rounded' | 'sharp' | 'pill',
        showPeriodLabel: true,
        datasetId: '',
        dbColumn: '',
        aggregationType: 'SUM',
        filterSql: '',
        groupByColumn: '',
        orderByColumn: '',
        orderDirection: 'DESC',
        visualizationType: 'kpi_card',
        formatType: 'number',
        formatPrefix: '',
        formatSuffix: '',
        comparisonEnabled: false,
        comparisonType: 'previous_period',
        // LFL Takvim Ayarları
        lflCalendarDatasetId: '',
        lflThisYearColumn: 'this_year',
        lflLastYearColumn: 'last_year',
        comparisonColumn: '',
        targetValue: '',
        targetColumn: '',
        defaultWidth: 3,
        defaultHeight: 2,
        cacheTtl: 300,
        selectedColumns: [],
        useSqlMode: false,
        customSql: '',
        limit: 0,
        // Sıralama Listesi - Trend Hesaplama
        comparisonLabel: '',
        autoCalculateTrend: false,
        trendComparisonType: 'mom' as 'mom' | 'yoy' | 'wow',
      });
      setColumns([]);
    }
    setPreviewData(null);
    setShowModal(true);
  };
  
  // Grid/List için kolon ekle/çıkar
  const toggleColumn = (column: string) => {
    const exists = formData.selectedColumns.find(c => c.column === column);
    if (exists) {
      setFormData({
        ...formData,
        selectedColumns: formData.selectedColumns.filter(c => c.column !== column)
      });
    } else {
      setFormData({
        ...formData,
        selectedColumns: [...formData.selectedColumns, { column, label: column, visible: true }]
      });
    }
  };
  
  // Kolon başlığını güncelle
  const updateColumnLabel = (column: string, label: string) => {
    setFormData({
      ...formData,
      selectedColumns: formData.selectedColumns.map(c => 
        c.column === column ? { ...c, label } : c
      )
    });
  };
  
  // Görselleştirme tipi grid veya list mi?
  const isGridOrList = ['data_grid', 'ranking_list', 'LIST'].includes(formData.visualizationType) || 
                       formData.aggregationType === 'LIST';
  
  // Kaydet
  const handleSave = async () => {
    try {
      const payload = {
        name: formData.name,
        label: formData.label,
        description: formData.description || null,
        icon: formData.icon,
        color: formData.color,
        datasetId: formData.datasetId || null,
        // ranking_list için dbColumn GEREKLİ (sum(dbColumn) yapılıyor)
        // data_grid ve LIST için null olabilir
        dbColumn: (formData.visualizationType === 'ranking_list' || !isGridOrList) 
          ? (formData.dbColumn || null) 
          : null,
        aggregationType: formData.aggregationType,
        filterSql: formData.filterSql || null,
        groupByColumn: formData.groupByColumn || null,
        orderByColumn: formData.orderByColumn || null,
        orderDirection: formData.orderDirection,
        visualizationType: formData.visualizationType,
        formatConfig: {
          type: formData.formatType,
          prefix: formData.formatPrefix || undefined,
          suffix: formData.formatSuffix || undefined
        },
        chartConfig: {
          // Grid/List için çoklu kolon
          gridColumns: isGridOrList ? formData.selectedColumns : undefined,
          // Karşılaştırma için tarih kolonu ve etiket
          comparisonColumn: formData.comparisonEnabled ? formData.comparisonColumn : undefined,
          comparisonLabel: formData.comparisonEnabled ? formData.comparisonLabel : undefined,
          // Hedef için kolon
          targetColumn: formData.targetColumn || undefined,
          // Köşe stili
          borderStyle: formData.borderStyle || 'rounded',
          // Renk modu (accent: üst bar, full: tam arka plan)
          colorMode: formData.colorMode || 'accent',
          // Tarih etiketi göster/gizle
          showPeriodLabel: formData.showPeriodLabel,
          // SQL Modu
          useSqlMode: formData.useSqlMode || false,
          customSql: formData.useSqlMode ? formData.customSql : undefined,
          // Limit (Top N)
          limit: formData.limit || 0,
          // Sıralama Listesi - Trend Otomatik Hesaplama
          autoCalculateTrend: formData.visualizationType === 'ranking_list' ? formData.autoCalculateTrend : undefined,
          trendComparisonType: formData.visualizationType === 'ranking_list' && formData.autoCalculateTrend ? formData.trendComparisonType : undefined,
          // LFL Takvim Ayarları
          lflCalendarDatasetId: formData.comparisonType === 'lfl' ? formData.lflCalendarDatasetId : undefined,
          lflThisYearColumn: formData.comparisonType === 'lfl' ? formData.lflThisYearColumn : undefined,
          lflLastYearColumn: formData.comparisonType === 'lfl' ? formData.lflLastYearColumn : undefined,
        },
        comparisonEnabled: formData.comparisonEnabled,
        comparisonType: formData.comparisonEnabled ? formData.comparisonType : null,
        comparisonConfig: formData.comparisonEnabled ? {
          column: formData.comparisonColumn,
          type: formData.comparisonType,
          label: formData.comparisonLabel || null
        } : {},
        targetValue: formData.targetValue ? parseFloat(formData.targetValue) : null,
        defaultWidth: formData.defaultWidth,
        defaultHeight: formData.defaultHeight,
        cacheTtl: formData.cacheTtl,
        // SQL Modu için ayrı alanlar (backend kolonları)
        useSqlMode: formData.useSqlMode || false,
        customSql: formData.useSqlMode ? formData.customSql : null
      };
      
      if (editingMetric) {
        await apiCall(`/metrics/${editingMetric.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiCall('/metrics', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      
      setShowModal(false);
      loadData();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };
  
  // Çoğalt (Duplicate)
  const handleDuplicate = async (id: string, currentName: string) => {
    const newName = window.prompt('Yeni metrik adını girin:', `${currentName} (Kopya)`);
    if (!newName) return;
    
    try {
      await apiCall(`/metrics/${id}/duplicate`, { 
        method: 'POST',
        body: JSON.stringify({ newName })
      });
      loadData();
    } catch (error: any) {
      alert('Çoğaltma hatası: ' + error.message);
    }
  };
  
  // Sil
  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu metriği silmek istediğinize emin misiniz?')) {
      return;
    }
    
    try {
      await apiCall(`/metrics/${id}`, { method: 'DELETE' });
      loadData();
    } catch (error: any) {
      alert('Silme hatası: ' + error.message);
    }
  };
  
  // Önizleme
  const handlePreview = async () => {
    const isGridOrList = ['LIST', 'data_grid', 'ranking_list'].includes(formData.visualizationType);
    
    // SQL Modu kontrolü
    if (formData.useSqlMode) {
      if (!formData.datasetId) {
        alert('Lütfen dataset seçin');
        return;
      }
      if (!formData.customSql || formData.customSql.trim().length === 0) {
        alert('Lütfen SQL sorgusu yazın');
        return;
      }
    } else {
      // Grid/List için selectedColumns kontrol et, diğerleri için dbColumn
      if (!formData.datasetId) {
        alert('Lütfen dataset seçin');
        return;
      }
      
      if (isGridOrList) {
        if (!formData.selectedColumns || formData.selectedColumns.length === 0) {
          alert('Lütfen en az bir kolon seçin');
          return;
        }
        // ranking_list için dbColumn da gerekli (sum için)
        if (formData.visualizationType === 'ranking_list' && !formData.dbColumn) {
          alert('Sıralama listesi için değer kolonu (Revenue vb.) seçmelisiniz');
          return;
        }
      } else if (!formData.dbColumn) {
        alert('Lütfen kolon seçin');
        return;
      }
    }
    
    setPreviewLoading(true);
    try {
      const dataset = datasets.find(d => d.id === formData.datasetId);
      if (!dataset) {
        console.error('Dataset not found:', formData.datasetId);
        return;
      }
      
      // SQL Modu: Direkt customSql kullan
      let sqlQuery: string;
      if (formData.useSqlMode && formData.customSql) {
        // Tablo adını değiştir (eğer placeholder varsa)
        // \w+ yerine [a-zA-Z_][a-zA-Z0-9_]* kullan (daha geniş)
        sqlQuery = formData.customSql
          .replace(/FROM\s+[a-zA-Z_][a-zA-Z0-9_]*/gi, `FROM clixer_analytics.${dataset.clickhouse_table}`)
          .trim();
        
        // LIMIT yoksa ekle
        if (!sqlQuery.toUpperCase().includes('LIMIT')) {
          sqlQuery += ' LIMIT 100';
        }
      } else {
        sqlQuery = buildPreviewQuery(dataset.clickhouse_table);
      }
      
      const res = await apiCall('/clickhouse/query', {
        method: 'POST',
        body: JSON.stringify({
          sql: sqlQuery,
          limit: 100
        })
      });
      
      setPreviewData(res.data);
    } catch (error: any) {
      alert('Önizleme hatası: ' + error.message);
    } finally {
      setPreviewLoading(false);
    }
  };
  
  const buildPreviewQuery = (table: string) => {
    const isGridOrList = ['LIST', 'data_grid', 'ranking_list'].includes(formData.visualizationType);
    
    // LIST/Grid tipi için - seçilen kolonları getir
    if (isGridOrList && formData.selectedColumns && formData.selectedColumns.length > 0) {
      const columns = formData.selectedColumns.map(c => c.column).join(', ');
      let sql = `SELECT ${columns} FROM clixer_analytics.${table}`;
      if (formData.filterSql) sql += ` WHERE ${formData.filterSql}`;
      if (formData.orderByColumn) sql += ` ORDER BY ${formData.orderByColumn} ${formData.orderDirection || 'DESC'}`;
      sql += ` LIMIT 20`;
      return sql;
    }
    
    const col = formData.dbColumn || '*';
    const agg = formData.aggregationType;
    
    let aggFunc = '';
    switch (agg) {
      case 'SUM': aggFunc = `sum(${col})`; break;
      case 'AVG': aggFunc = `avg(${col})`; break;
      case 'COUNT': aggFunc = 'count()'; break;
      case 'DISTINCT': aggFunc = `uniq(${col})`; break;
      case 'MIN': aggFunc = `min(${col})`; break;
      case 'MAX': aggFunc = `max(${col})`; break;
      default: aggFunc = `sum(${col})`;
    }
    
    let sql = `SELECT ${aggFunc} as value FROM clixer_analytics.${table}`;
    
    if (formData.filterSql) {
      sql += ` WHERE ${formData.filterSql}`;
    }
    
    if (formData.groupByColumn) {
      sql = `SELECT ${formData.groupByColumn}, ${aggFunc} as value FROM clixer_analytics.${table}`;
      if (formData.filterSql) sql += ` WHERE ${formData.filterSql}`;
      sql += ` GROUP BY ${formData.groupByColumn} ORDER BY value ${formData.orderDirection || 'DESC'}`;
      if (formData.limit > 0) {
        sql += ` LIMIT ${formData.limit}`;
      }
    }
    
    return sql;
  };
  
  // Filtrelenmiş metrikler
  const filteredMetrics = metrics.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       m.label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDataset = !filterDataset || m.datasetId === filterDataset;
    return matchSearch && matchDataset;
  });
  
  // Visualization kategorileri
  const vizCategories = [
    { key: 'summary', label: 'Özet', types: visualizationTypes.filter(v => v.category === 'summary') },
    { key: 'trend', label: 'Trend', types: visualizationTypes.filter(v => v.category === 'trend') },
    { key: 'compare', label: 'Karşılaştırma', types: visualizationTypes.filter(v => v.category === 'compare') },
    { key: 'chart', label: 'Grafikler', types: visualizationTypes.filter(v => v.category === 'chart') },
    { key: 'table', label: 'Tablolar', types: visualizationTypes.filter(v => v.category === 'table') }
  ];
  
  // Renk paletleri
  const colorPalette = [
    '', // Renk yok (tema rengi)
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];
  
  return (
    <div className={clsx(embedded ? '' : 'p-6', 'space-y-6')}>
      {/* Header - sadece embedded değilse göster */}
      {!embedded && (
        <div className={clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl', theme.cardBg)}>
          <div className="flex items-center gap-4">
            <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg', theme.accent)}>
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className={clsx('text-2xl font-bold', theme.contentText)}>Metrik Yönetimi</h1>
              <p className={clsx('text-sm', theme.contentTextMuted)}>KPI ve metrikleri tanımlayın, dashboard'larda kullanın</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all', theme.buttonPrimary)}
          >
            <Plus className="w-5 h-5" />
            Yeni Metrik
          </button>
        </div>
      )}
      
      {/* Inline header for embedded mode */}
      {embedded && (
        <div className="flex justify-between items-center">
          <div></div>
          <button
            onClick={() => openModal()}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all', theme.buttonPrimary)}
          >
            <Plus className="w-5 h-5" />
            Yeni Metrik
          </button>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className={clsx('absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5', theme.contentTextMuted)} />
          <input
            type="text"
            placeholder="Metrik ara..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={clsx('w-full pl-10 pr-4 py-2 rounded-xl border', theme.inputBg, theme.inputText, isDark ? 'border-slate-700' : 'border-slate-200')}
          />
        </div>
        <select
          value={filterDataset}
          onChange={e => setFilterDataset(e.target.value)}
          className={clsx('px-4 py-2 rounded-xl border', theme.inputBg, theme.inputText, isDark ? 'border-slate-700' : 'border-slate-200')}
        >
          <option value="">Tüm Dataset'ler</option>
          {datasets.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      
      {/* Metrics Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader className={clsx('w-8 h-8 animate-spin', isDark ? 'text-blue-400' : 'text-blue-600')} />
        </div>
      ) : filteredMetrics.length === 0 ? (
        <div className={clsx('text-center py-16 rounded-2xl', theme.cardBg)}>
          <BarChart3 className={clsx('w-16 h-16 mx-auto mb-4', theme.contentTextMuted)} />
          <h3 className={clsx('text-xl font-medium mb-2', theme.contentText)}>Henüz metrik yok</h3>
          <p className={clsx('mb-6', theme.contentTextMuted)}>İlk metriğinizi oluşturarak başlayın</p>
          <button
            onClick={() => openModal()}
            className={clsx('px-6 py-3 rounded-xl font-medium transition-all', theme.buttonPrimary)}
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Yeni Metrik Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMetrics.map(metric => {
            const IconComponent = iconMap[metric.icon] || BarChart3;
            
            return (
              <div
                key={metric.id}
                className={clsx('rounded-2xl p-4 transition-all group', theme.cardBg, theme.cardHover)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${metric.color}20` }}
                  >
                    <IconComponent className="w-5 h-5" style={{ color: metric.color }} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openModal(metric)}
                      className={clsx('p-1.5 rounded-lg transition-colors', theme.buttonSecondary)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(metric.id, metric.label)}
                      className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400"
                      title="Çoğalt"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(metric.id)}
                      className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Content */}
                <h3 className={clsx('font-semibold mb-1', theme.contentText)}>{metric.label}</h3>
                <p className={clsx('text-sm mb-3 line-clamp-2', theme.contentTextMuted)}>
                  {metric.description || `${metric.aggregationType} - ${metric.dbColumn || 'N/A'}`}
                </p>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  <span className={clsx('text-xs px-2 py-1 rounded', isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')}>
                    {metric.aggregationType}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-500">
                    {metric.visualizationType}
                  </span>
                  {metric.datasetName && (
                    <span className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-500">
                      {metric.datasetName}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">
                {editingMetric ? 'Metrik Düzenle' : 'Yeni Metrik Oluştur'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sol Kolon - Temel Bilgiler */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    Temel Bilgiler
                  </h3>
                  
                  {/* İsim ve Etiket */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Teknik İsim</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="total_sales"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Görünen İsim</label>
                      <input
                        type="text"
                        value={formData.label}
                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                        placeholder="Toplam Satış"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Açıklama</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Bu metriğin ne anlama geldiğini açıklayın..."
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none"
                    />
                  </div>
                  
                  {/* İkon ve Renk */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">İkon</label>
                      <select
                        value={formData.icon}
                        onChange={e => setFormData({ ...formData, icon: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      >
                        {Object.keys(iconMap).map(icon => (
                          <option key={icon} value={icon}>{icon}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Renk</label>
                      <div className="flex gap-1">
                        {colorPalette.map((color, index) => (
                          <button
                            key={color || 'none'}
                            onClick={() => setFormData({ ...formData, color })}
                            className={clsx(
                              'w-8 h-8 rounded-lg transition-transform relative overflow-hidden',
                              formData.color === color ? 'scale-110 ring-2 ring-white' : ''
                            )}
                            style={{ backgroundColor: color || '#475569' }}
                            title={color || 'Renk Yok'}
                          >
                            {/* Renk yok için çapraz çizgi */}
                            {!color && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-full h-0.5 bg-red-500 rotate-45 absolute"></div>
                                <div className="w-full h-0.5 bg-red-500 -rotate-45 absolute"></div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Renk Modu */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Kart Renk Modu</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'none', label: 'Sade', desc: 'Tema uyumlu, çizgisiz' },
                        { value: 'accent', label: 'Accent (Üst Bar)', desc: 'Renkli üst çizgi' },
                        { value: 'full', label: 'Tam Renk', desc: 'Google Analytics tarzı' },
                      ].map(mode => (
                        <button
                          key={mode.value}
                          onClick={() => setFormData({ ...formData, colorMode: mode.value as 'none' | 'accent' | 'full' })}
                          className={clsx(
                            'flex-1 py-3 px-4 text-sm font-medium transition-all border-2 rounded-lg',
                            formData.colorMode === mode.value
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                              : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                          )}
                        >
                          <div className="font-medium">{mode.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{mode.desc}</div>
                        </button>
                      ))}
                    </div>
                    {/* Renk Modu Önizleme */}
                    <div className="mt-3 flex gap-3">
                      {/* Sade */}
                      <div 
                        className={clsx(
                          'flex-1 p-3 rounded-lg transition-all',
                          formData.colorMode === 'none' ? 'ring-2 ring-blue-500' : ''
                        )}
                        style={{ backgroundColor: 'rgb(51, 65, 85)' }}
                      >
                        <div className="text-xs text-slate-400">Sade</div>
                        <div className="text-lg font-bold text-white">₺1.234</div>
                      </div>
                      {/* Accent */}
                      <div 
                        className={clsx(
                          'flex-1 p-3 rounded-lg border-2 border-transparent transition-all',
                          formData.colorMode === 'accent' ? 'ring-2 ring-blue-500' : ''
                        )}
                        style={{ 
                          borderTopColor: formData.color, 
                          borderTopWidth: '3px',
                          backgroundColor: 'rgb(51, 65, 85)' 
                        }}
                      >
                        <div className="text-xs text-slate-400">Accent</div>
                        <div className="text-lg font-bold text-white">₺1.234</div>
                      </div>
                      {/* Full */}
                      <div 
                        className={clsx(
                          'flex-1 p-3 rounded-lg transition-all',
                          formData.colorMode === 'full' ? 'ring-2 ring-blue-500' : ''
                        )}
                        style={{ backgroundColor: formData.color }}
                      >
                        <div className="text-xs text-white/80">Full</div>
                        <div className="text-lg font-bold text-white">₺1.234</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Köşe Stili */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Kart Köşe Stili</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'sharp', label: 'Keskin', preview: 'rounded-none' },
                        { value: 'rounded', label: 'Yuvarlatılmış', preview: 'rounded-lg' },
                        { value: 'pill', label: 'Tam Yuvarlak', preview: 'rounded-2xl' },
                      ].map(style => (
                        <button
                          key={style.value}
                          onClick={() => setFormData({ ...formData, borderStyle: style.value as 'rounded' | 'sharp' | 'pill' })}
                          className={clsx(
                            'flex-1 py-2 px-3 text-sm font-medium transition-all border-2',
                            style.preview,
                            formData.borderStyle === style.value
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                              : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                          )}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Tarih Etiketi Göster/Gizle */}
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div>
                      <div className="text-sm font-medium text-slate-300">Tarih Etiketi</div>
                      <div className="text-xs text-slate-500">Kart altında "Son 30 gün" gibi tarih bilgisi gösterilsin mi?</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showPeriodLabel: !formData.showPeriodLabel })}
                      className={clsx(
                        'relative w-12 h-6 rounded-full transition-colors',
                        formData.showPeriodLabel ? 'bg-blue-500' : 'bg-slate-600'
                      )}
                    >
                      <div className={clsx(
                        'absolute top-1 w-4 h-4 bg-white rounded-full transition-all',
                        formData.showPeriodLabel ? 'left-7' : 'left-1'
                      )} />
                    </button>
                  </div>
                  
                  {/* Dataset ve Kolon */}
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 pt-4">
                    <Database className="w-5 h-5 text-green-400" />
                    Veri Kaynağı
                  </h3>
                  
                  {/* SQL Modu Toggle */}
                  <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, useSqlMode: !formData.useSqlMode })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        formData.useSqlMode ? 'bg-purple-600' : 'bg-slate-600'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                        formData.useSqlMode ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                    <div>
                      <span className="text-sm font-medium text-white">SQL Modu</span>
                      <p className="text-xs text-slate-400">Serbest SQL sorgusu ile metrik oluştur</p>
                    </div>
                  </div>
                  
                  {/* SQL Modu Aktif */}
                  {formData.useSqlMode ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Dataset</label>
                        <select
                          value={formData.datasetId}
                          onChange={e => {
                            setFormData({ ...formData, datasetId: e.target.value });
                            loadColumns(e.target.value);
                          }}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                        >
                          <option value="">Seçin...</option>
                          {datasets.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        {formData.datasetId && datasets.find(d => d.id === formData.datasetId) && (
                          <p className="text-xs text-slate-500 mt-1">
                            Clixer Tablo: <code className="text-purple-400">{datasets.find(d => d.id === formData.datasetId)?.clickhouse_table}</code>
                          </p>
                        )}
                        
                        {/* SQL Modu için Tarih Kolonu Uyarısı */}
                        {formData.datasetId && !formData.comparisonColumn && (
                          (() => {
                            const selectedDataset = datasets.find(d => d.id === formData.datasetId);
                            const partitionColumn = selectedDataset?.partition_column;
                            
                            if (partitionColumn) {
                              return (
                                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/40 rounded-lg">
                                  <p className="text-xs text-amber-400 flex items-start gap-1">
                                    <span>⚠️</span>
                                    <span>
                                      Tarih filtresi için <strong>{partitionColumn}</strong> kolonu kullanılacak.
                                      Aşağıda "Tarih Kolonu" seçerek değiştirebilirsiniz.
                                    </span>
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          })()
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                          SQL Sorgusu
                          <span className="text-purple-400 ml-2">✨ Serbest SQL</span>
                        </label>
                        <textarea
                          value={formData.customSql}
                          onChange={e => setFormData({ ...formData, customSql: e.target.value })}
                          placeholder={`-- Örnek:\nSELECT \n  transaction_id,\n  product_id,\n  SUM(line_total) as toplam,\n  COUNT(*) as adet\nFROM ${datasets.find(d => d.id === formData.datasetId)?.clickhouse_table || 'tablo_adi'}\nGROUP BY transaction_id, product_id\nORDER BY toplam DESC\nLIMIT 100`}
                          rows={8}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-green-400 font-mono text-sm"
                          style={{ fontFamily: 'JetBrains Mono, Monaco, monospace' }}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Clixer SQL sorgusu yazın. Sonuç tablo olarak gösterilecek.
                        </p>
                      </div>
                      
                      {columns.length > 0 && (
                        <div className="p-3 bg-slate-900 rounded-lg">
                          <p className="text-xs text-slate-400 mb-2">📋 Mevcut Kolonlar:</p>
                          <div className="flex flex-wrap gap-1">
                            {columns.map(col => (
                              <button
                                key={col}
                                type="button"
                                onClick={() => setFormData({ 
                                  ...formData, 
                                  customSql: formData.customSql + col + ', ' 
                                })}
                                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded font-mono"
                              >
                                {col}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                  <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Dataset</label>
                    <select
                      value={formData.datasetId}
                      onChange={e => {
                        setFormData({ ...formData, datasetId: e.target.value, dbColumn: '', selectedColumns: [] });
                        loadColumns(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="">Seçin...</option>
                      {datasets.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    
                    {/* Tarih Kolonu Uyarısı - Dashboard filtresi için kritik */}
                    {formData.datasetId && !formData.comparisonEnabled && (
                      (() => {
                        const selectedDataset = datasets.find(d => d.id === formData.datasetId);
                        const hasDateColumnInChart = formData.comparisonColumn || (formData as any).dateColumn;
                        const partitionColumn = selectedDataset?.partition_column;
                        const referenceColumn = selectedDataset?.reference_column;
                        const dateColumns = columns.filter(isDateColumn);
                        
                        // Eğer chart_config'te tarih kolonu yoksa uyarı göster
                        if (!hasDateColumnInChart) {
                          return (
                            <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/40 rounded-lg">
                              <div className="flex items-start gap-2">
                                <span className="text-amber-500 text-lg">⚠️</span>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-amber-400">
                                    Tarih Kolonu Belirtilmedi
                                  </p>
                                  <p className="text-xs text-amber-300/80 mt-1">
                                    Dashboard'daki tarih filtresi bu metriği etkilemeyecek!
                                  </p>
                                  
                                  {/* Önerilen kolonlar */}
                                  {(partitionColumn || referenceColumn || dateColumns.length > 0) && (
                                    <div className="mt-2">
                                      <p className="text-xs text-slate-400 mb-1">Dataset'teki tarih kolonları:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {partitionColumn && (
                                          <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, comparisonColumn: partitionColumn })}
                                            className="px-2 py-1 bg-green-600/30 hover:bg-green-600/50 text-green-300 text-xs rounded border border-green-500/50 flex items-center gap-1"
                                          >
                                            <span>📅</span> {partitionColumn} <span className="text-green-500">(önerilen - partition)</span>
                                          </button>
                                        )}
                                        {referenceColumn && referenceColumn !== partitionColumn && (
                                          <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, comparisonColumn: referenceColumn })}
                                            className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs rounded border border-blue-500/50 flex items-center gap-1"
                                          >
                                            <span>📆</span> {referenceColumn} <span className="text-blue-400">(referans)</span>
                                          </button>
                                        )}
                                        {dateColumns.filter(c => c !== partitionColumn && c !== referenceColumn).map(col => (
                                          <button
                                            key={col}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, comparisonColumn: col })}
                                            className="px-2 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-xs rounded border border-slate-500/50"
                                          >
                                            {col}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Backend fallback bilgisi */}
                                  {(partitionColumn || referenceColumn) && (
                                    <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                                      <span>✅</span>
                                      <span>
                                        Backend otomatik olarak <code className="bg-green-500/20 px-1 rounded">{partitionColumn || referenceColumn}</code> kolonunu kullanacak.
                                        Yine de açıkça seçmeniz önerilir.
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}
                  </div>
                  
                  {/* Tek kolon seçimi (aggregation için) - Grid/List hariç, ancak ranking_list için trend hesabı için gerekli */}
                  {(!isGridOrList || formData.visualizationType === 'ranking_list') && (
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${formData.visualizationType === 'ranking_list' ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>
                        {formData.visualizationType === 'ranking_list' ? 'Ana Değer Kolonu (Sıralama ve Trend İçin)' : 'Hesaplanacak Kolon'}
                      </label>
                      <select
                        value={formData.dbColumn}
                        onChange={e => setFormData({ ...formData, dbColumn: e.target.value })}
                        className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-white transition-colors ${
                          formData.visualizationType === 'ranking_list' ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-slate-600'
                        }`}
                        disabled={!formData.datasetId}
                      >
                        <option value="">Seçin...</option>
                        {columns.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {formData.visualizationType === 'ranking_list' && (
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                          * Bu seçim, listedeki ana değeri ve büyüme oranlarını (%) belirler.
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Çoklu kolon seçimi (Grid/List için) */}
                  {isGridOrList && columns.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Görünecek Kolonlar ({formData.selectedColumns.length} seçili)
                      </label>
                      <div className="max-h-48 overflow-y-auto bg-slate-900 rounded-lg p-2 space-y-1">
                        {columns.map(col => {
                          const selected = formData.selectedColumns.find(c => c.column === col);
                          return (
                            <div key={col} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleColumn(col)}
                                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                                  selected 
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600' 
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                <Check className={`w-4 h-4 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                <span className="font-mono">{col}</span>
                              </button>
                              {selected && (
                                <input
                                  type="text"
                                  value={selected.label}
                                  onChange={e => updateColumnLabel(col, e.target.value)}
                                  placeholder="Başlık"
                                  className="w-32 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Kolonları seçin ve başlıklarını düzenleyin</p>
                    </div>
                  )}
                  
                  {/* Aggregation */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Hesaplama Tipi</label>
                    <div className="grid grid-cols-4 gap-2">
                      {aggregationTypes.map(agg => (
                        <button
                          key={agg.value}
                          onClick={() => setFormData({ ...formData, aggregationType: agg.value })}
                          className={`p-2 rounded-lg text-center transition-colors ${
                            formData.aggregationType === agg.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          <div className="text-sm font-medium">{agg.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Filtre ve Group By */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Group By</label>
                      <select
                        value={formData.groupByColumn}
                        onChange={e => setFormData({ ...formData, groupByColumn: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                        disabled={!formData.datasetId}
                      >
                        <option value="">Yok</option>
                        {columns.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Sıralama</label>
                      <select
                        value={formData.orderDirection}
                        onChange={e => setFormData({ ...formData, orderDirection: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      >
                        <option value="DESC">Büyükten Küçüğe</option>
                        <option value="ASC">Küçükten Büyüğe</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Limit (Top N)</label>
                      <select
                        value={formData.limit}
                        onChange={e => setFormData({ ...formData, limit: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      >
                        <option value={0}>Limitsiz</option>
                        <option value={5}>Top 5</option>
                        <option value={10}>Top 10</option>
                        <option value={20}>Top 20</option>
                        <option value={50}>Top 50</option>
                        <option value={100}>Top 100</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Filtre (WHERE koşulu)</label>
                    <input
                      type="text"
                      value={formData.filterSql}
                      onChange={e => setFormData({ ...formData, filterSql: e.target.value })}
                      placeholder="örn: tarih >= today() - 30"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono text-sm"
                    />
                  </div>
                  </>
                  )}
                </div>
                
                {/* Sağ Kolon - Görselleştirme */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-purple-400" />
                    Görselleştirme
                  </h3>
                  
                  {/* Visualization Types */}
                  <div className="space-y-3">
                    {vizCategories.map(cat => (
                      <div key={cat.key}>
                        <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">{cat.label}</label>
                        <div className="flex flex-wrap gap-2">
                          {cat.types.map(viz => {
                            const VizIcon = iconMap[viz.icon] || BarChart3;
                            return (
                              <button
                                key={viz.value}
                                onClick={() => setFormData({ ...formData, visualizationType: viz.value })}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                  formData.visualizationType === viz.value
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                <VizIcon className="w-4 h-4" />
                                <span className="text-sm">{viz.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Sıralama Listesi Ayarları */}
                  {formData.visualizationType === 'ranking_list' && (
                    <div className="space-y-4">
                      {/* Trend Otomatik Hesaplama Toggle */}
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-medium text-emerald-300">Trend Otomatik Hesaplansın</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, autoCalculateTrend: !formData.autoCalculateTrend })}
                            className={clsx(
                              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                              formData.autoCalculateTrend ? 'bg-emerald-500' : 'bg-slate-600'
                            )}
                          >
                            <span className={clsx(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                              formData.autoCalculateTrend ? 'translate-x-6' : 'translate-x-1'
                            )} />
                          </button>
                        </div>
                        
                        {formData.autoCalculateTrend && (
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-emerald-300/80 mb-1">Karşılaştırma Dönemi</label>
                            <select
                              value={formData.trendComparisonType}
                              onChange={e => setFormData({ ...formData, trendComparisonType: e.target.value as 'mom' | 'yoy' | 'wow' })}
                              className="w-full px-3 py-2 bg-slate-700 border border-emerald-500/30 rounded-lg text-white text-sm"
                            >
                              <option value="mom">📅 Geçen Ay (MoM)</option>
                              <option value="yoy">📆 Geçen Yıl (YoY)</option>
                              <option value="wow">🗓️ Geçen Hafta (WoW)</option>
                            </select>
                            <p className="text-xs text-emerald-300/60 mt-2">
                              Backend, seçilen döneme göre trend yüzdesini otomatik hesaplar.
                            </p>
                          </div>
                        )}
                        
                        {!formData.autoCalculateTrend && (
                          <p className="text-xs text-emerald-300/60">
                            Kapalıyken SQL sorgusunda <code className="bg-emerald-500/20 px-1 rounded">trend</code> kolonu kendiniz hesaplamalısınız.
                          </p>
                        )}
                      </div>
                      
                      {/* Format Bilgisi */}
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-blue-300 flex items-start gap-1">
                          <span>📊</span>
                          <span><strong>Format (4 Kolon):</strong></span>
                        </p>
                        <ul className="text-xs text-blue-300/80 mt-2 space-y-1 ml-5">
                          <li><strong>1. label</strong> - İsim (mağaza, ürün vb.)</li>
                          <li><strong>2. value</strong> - Ana değer (ciro, satış vb.)</li>
                          <li><strong>3. subtitle</strong> - Alt bilgi (sipariş sayısı vb.) <span className="text-blue-400/60">opsiyonel</span></li>
                          <li><strong>4. trend</strong> - Büyüme % {formData.autoCalculateTrend ? <span className="text-emerald-400">(Backend hesaplar)</span> : <span className="text-blue-400/60">opsiyonel</span>}</li>
                        </ul>
                        {!formData.autoCalculateTrend && (
                          <p className="text-xs text-blue-300/60 mt-2 ml-5">
                            Örnek: <code className="bg-blue-500/20 px-1 rounded">SELECT magaza as label, SUM(ciro) as value, COUNT(*) as subtitle, 12.5 as trend</code>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Comparison Uyarısı */}
                  {formData.visualizationType === 'comparison' && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-xs text-red-400 flex items-start gap-1">
                        <span>⚠️</span>
                        <span><strong>Format:</strong> Karşılaştırma için tarih kolonu <code className="bg-red-500/20 px-1 rounded">YYYY-MM-DD</code> formatında olmalı. "Önceki dönemle karşılaştır" seçeneğini aktif edin.</span>
                      </p>
                    </div>
                  )}
                  
                  {/* Format */}
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 pt-4">
                    <Hash className="w-5 h-5 text-yellow-400" />
                    Format
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Tip</label>
                      <select
                        value={formData.formatType}
                        onChange={e => setFormData({ ...formData, formatType: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      >
                        <option value="number">Sayı</option>
                        <option value="currency">Para Birimi</option>
                        <option value="percentage">Yüzde</option>
                        <option value="compact">Kısaltılmış (1.5M)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Ön Ek</label>
                      <input
                        type="text"
                        value={formData.formatPrefix}
                        onChange={e => setFormData({ ...formData, formatPrefix: e.target.value })}
                        placeholder="₺"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Son Ek</label>
                      <input
                        type="text"
                        value={formData.formatSuffix}
                        onChange={e => setFormData({ ...formData, formatSuffix: e.target.value })}
                        placeholder=" adet"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  
                  {/* Hedef Değer */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Hedef Değer (opsiyonel)</label>
                    {/* Format Uyarısı - İlerleme/Gösterge için */}
                    {['progress_bar', 'progress', 'gauge'].includes(formData.visualizationType) && (
                      <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-xs text-red-400 flex items-start gap-1">
                          <span>⚠️</span>
                          <span><strong>Hedef ZORUNLU:</strong> İlerleme/Gösterge için hedef değer (sabit veya kolon) belirtilmelidir. Sayısal format olmalı (Float/Int).</span>
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={formData.targetValue}
                        onChange={e => setFormData({ ...formData, targetValue: e.target.value })}
                        placeholder="Sabit değer: 1000000"
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                      <select
                        value={formData.targetColumn}
                        onChange={e => setFormData({ ...formData, targetColumn: e.target.value })}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                        disabled={!formData.datasetId}
                      >
                        <option value="">veya kolondan al...</option>
                        {columns.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-slate-500">Sabit değer veya dataset'ten dinamik hedef</p>
                  </div>
                  
                  {/* Zaman Serisi Ayarları - Sparkline/Trend için zorunlu */}
                  {['sparkline', 'trend_card', 'trend', 'mini_card'].includes(formData.visualizationType) && (
                    <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
                      <h5 className="text-sm font-medium text-purple-300 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Zaman Serisi Ayarları
                      </h5>
                      {/* Format Uyarısı */}
                      <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-xs text-red-400 flex items-start gap-1">
                          <span>⚠️</span>
                          <span><strong>Format:</strong> Tarih kolonu <code className="bg-red-500/20 px-1 rounded">YYYY-MM-DD</code> veya <code className="bg-red-500/20 px-1 rounded">DateTime</code> formatında olmalıdır.</span>
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Tarih Kolonu (Zorunlu)</label>
                        <select
                          value={formData.comparisonColumn}
                          onChange={e => setFormData({ ...formData, comparisonColumn: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                          disabled={!formData.datasetId}
                        >
                          <option value="">Tarih kolonu seçin...</option>
                          {columns.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Son 12 gün verisi için tarih kolonu gereklidir</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Karşılaştırma */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.comparisonEnabled}
                        onChange={e => setFormData({ ...formData, comparisonEnabled: e.target.checked })}
                        className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                      />
                      <span className="text-sm text-slate-300">Önceki dönemle karşılaştır</span>
                    </label>
                    {formData.comparisonEnabled && (
                      <div className="space-y-3 mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        {/* Format Uyarısı */}
                        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-xs text-red-400 flex items-start gap-1">
                            <span>⚠️</span>
                            <span><strong>Format:</strong> Tarih kolonu <code className="bg-red-500/20 px-1 rounded">YYYY-MM-DD</code> veya <code className="bg-red-500/20 px-1 rounded">YYYY-MM-DD HH:mm:ss</code> formatında olmalıdır. Aksi halde karşılaştırma çalışmaz!</span>
                          </p>
                        </div>
                        {/* Karşılaştırma Tipi */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Karşılaştırma Tipi</label>
                          <select
                            value={formData.comparisonType}
                            onChange={e => setFormData({ ...formData, comparisonType: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                          >
                            <optgroup label="Dönem Karşılaştırması">
                              <option value="yoy">📅 Geçen Yıl Aynı Gün (YoY)</option>
                              <option value="mom">📆 Geçen Ay Aynı Gün (MoM)</option>
                              <option value="wow">📊 Geçen Hafta (WoW)</option>
                              <option value="ytd">📈 Yılbaşından Bugüne (YTD)</option>
                            </optgroup>
                            <optgroup label="Gelişmiş">
                              <option value="lfl">✨ LFL - Karşılaştırılabilir Günler</option>
                            </optgroup>
                          </select>
                          {/* LFL Açıklama */}
                          {formData.comparisonType === 'lfl' && (
                            <p className="text-xs text-amber-400 mt-1.5 flex items-start gap-1">
                              <span>ℹ️</span>
                              <span>LFL: Sadece her iki dönemde de satış olan günler karşılaştırılır. Yeni açılan veya kapalı olan günler hariç tutulur.</span>
                            </p>
                          )}
                        </div>
                        
                        {/* LFL Takvim Ayarları */}
                        {formData.comparisonType === 'lfl' && (
                          <div className="p-3 bg-slate-800/50 border border-amber-500/30 rounded-lg space-y-3">
                            <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                              📅 LFL Takvim Ayarları
                            </h4>
                            
                            {/* LFL Takvim Dataset */}
                            <div>
                              <label className="block text-xs text-slate-400 mb-1.5">LFL Takvim Dataset</label>
                              <select
                                value={formData.lflCalendarDatasetId}
                                onChange={e => setFormData({ ...formData, lflCalendarDatasetId: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                              >
                                <option value="">LFL takvim dataset seçin...</option>
                                {datasets.map(ds => (
                                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                                ))}
                              </select>
                              <p className="text-xs text-slate-500 mt-1">Karşılaştırılabilir günleri içeren takvim tablosu</p>
                            </div>
                            
                            {/* Bu Yıl ve Geçen Yıl Kolonları */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-slate-400 mb-1.5">Bu Yıl Kolonu</label>
                                <input
                                  type="text"
                                  value={formData.lflThisYearColumn}
                                  onChange={e => setFormData({ ...formData, lflThisYearColumn: e.target.value })}
                                  placeholder="this_year"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1.5">Geçen Yıl Kolonu</label>
                                <input
                                  type="text"
                                  value={formData.lflLastYearColumn}
                                  onChange={e => setFormData({ ...formData, lflLastYearColumn: e.target.value })}
                                  placeholder="last_year"
                                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Tarih Kolonu */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Tarih Kolonu</label>
                          <select
                            value={formData.comparisonColumn}
                            onChange={e => setFormData({ ...formData, comparisonColumn: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                            disabled={!formData.datasetId}
                          >
                            <option value="">Tarih kolonu seçin...</option>
                            {columns.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-500 mt-1">Karşılaştırma için kullanılacak tarih/zaman kolonu</p>
                        </div>
                        
                        {/* Karşılaştırma Etiketi */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Etiket (opsiyonel)</label>
                          <input
                            type="text"
                            value={formData.comparisonLabel || ''}
                            onChange={e => setFormData({ ...formData, comparisonLabel: e.target.value })}
                            placeholder={
                              formData.comparisonType === 'yoy' ? 'vs geçen yıl' :
                              formData.comparisonType === 'mom' ? 'vs geçen ay' :
                              formData.comparisonType === 'wow' ? 'vs geçen hafta' :
                              formData.comparisonType === 'ytd' ? 'YTD vs geçen yıl' :
                              formData.comparisonType === 'lfl' ? 'LFL vs geçen yıl' : 'vs önceki dönem'
                            }
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Önizleme */}
                  <div className="pt-4">
                    <button
                      onClick={handlePreview}
                      disabled={!formData.datasetId || previewLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {previewLoading ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Önizleme
                    </button>
                    
                    {previewData && (
                      <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                        <div className="text-sm text-slate-400 mb-2">Sonuç ({previewData.executionTime}ms)</div>
                        {previewData.rowCount === 1 && Object.keys(previewData.rows[0] || {}).length === 1 ? (
                          /* Tek satır, tek kolon - büyük sayı olarak göster */
                          <div className="text-3xl font-bold text-white">
                            {formData.formatPrefix}
                            {new Intl.NumberFormat('tr-TR').format(
                              Object.values(previewData.rows[0] || {})[0] as number || 0
                            )}
                            {formData.formatSuffix}
                          </div>
                        ) : previewData.rowCount >= 1 ? (
                          /* Birden fazla satır veya kolon - tablo olarak göster */
                          <div className="max-h-40 overflow-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-700">
                                  {Object.keys(previewData.rows[0] || {}).map(key => (
                                    <th key={key} className="px-2 py-1 text-left text-slate-400">{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.rows.map((row: any, i: number) => (
                                  <tr key={i} className="border-b border-slate-800">
                                    {Object.values(row).map((val: any, j: number) => (
                                      <td key={j} className="px-2 py-1 text-white">{String(val)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.label}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-4 h-4" />
                {editingMetric ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricsPage;

