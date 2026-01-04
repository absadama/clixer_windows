/**
 * Clixer - Çeviri Dosyaları
 * İki dil desteklenir: Türkçe (tr) ve İngilizce (en)
 */

export type Language = 'tr' | 'en'

export interface Translations {
  // Genel
  appName: string
  loading: string
  save: string
  cancel: string
  delete: string
  edit: string
  create: string
  search: string
  filter: string
  yes: string
  no: string
  confirm: string
  close: string
  back: string
  next: string
  
  // Auth
  login: string
  logout: string
  email: string
  password: string
  forgotPassword: string
  rememberMe: string
  loginTitle: string
  loginSubtitle: string
  
  // Menü
  menu: {
    dashboard: string
    finance: string
    operations: string
    analysis: string
    stores: string
    designer: string
    data: string
    admin: string
    profile: string
  }
  
  // Dashboard
  dashboard: {
    title: string
    revenue: string
    profit: string
    orders: string
    customers: string
    today: string
    thisWeek: string
    thisMonth: string
    compared: string
  }
  
  // Finans
  finance: {
    title: string
    subtitle: string
    simulation: string
    simulationDesc: string
    simulatedRevenue: string
    criticalWarning: string
    cannotAmortize: string
    cannotAmortizeDesc: string
    openingDate: string
    initialInvestment: string
    estimatedRevenue: string
    totalExpenses: string
    netProfit: string
    profitMargin: string
    roi: string
    roiPeriod: string
    years: string
    months: string
    cannotCalculate: string
    incomeStatement: string
    totalSalesRevenue: string
    cogs: string
    grossProfit: string
    rentExpense: string
    personnelExpense: string
    royalty: string
    marketing: string
    utilities: string
    otherExpenses: string
    expenseBreakdown: string
    settings: string
    operationalExpenses: string
    fixedRent: string
    revenueShare: string
    commonArea: string
    targetCogs: string
    electricityBudget: string
    waterBudget: string
    personnelExpenses: string
    managerCount: string
    managerSalary: string
    kitchenCount: string
    kitchenSalary: string
    serviceCount: string
    serviceSalary: string
    courierCount: string
    courierSalary: string
    totalPersonnelCost: string
    investmentRoi: string
    saveFor: string
    saving: string
    saved: string
    accessRestricted: string
    accessRestrictedDesc: string
  }
  
  // Admin
  admin: {
    title: string
    systemSettings: string
    userManagement: string
    rolesPermissions: string
    ldapSso: string
    seedSettings: string
    seedingSettings: string
    general: string
    theme: string
    locale: string
    security: string
    notifications: string
    financeSettings: string
  }
  
  // Veri
  data: {
    title: string
    connections: string
    datasets: string
    etlJobs: string
    systemHealth: string
    newConnection: string
    connectionName: string
    connectionType: string
    host: string
    port: string
    database: string
    username: string
    testConnection: string
    lastSync: string
    syncNow: string
    rowCount: string
  }
  
  // Tasarım
  designer: {
    title: string
    newDesign: string
    editDesign: string
    designName: string
    designType: string
    saveDesign: string
    widgets: string
    addWidget: string
    allowedPositions: string
    selectAll: string
    managementOnly: string
    clear: string
  }
  
  // Profil
  profile: {
    title: string
    personalInfo: string
    changePassword: string
    currentPassword: string
    newPassword: string
    confirmPassword: string
    updateProfile: string
    assignedStores: string
  }
  
  // Ortak mesajlar
  messages: {
    saveSuccess: string
    saveError: string
    deleteSuccess: string
    deleteConfirm: string
    loadError: string
    connectionSuccess: string
    connectionFailed: string
    requiredField: string
    invalidEmail: string
    passwordMismatch: string
    unauthorized: string
    notFound: string
    serverError: string
  }
  
  // Zaman
  time: {
    justNow: string
    minutesAgo: string
    hoursAgo: string
    daysAgo: string
    today: string
    yesterday: string
    thisWeek: string
    thisMonth: string
  }
}

export const translations: Record<Language, Translations> = {
  tr: {
    appName: 'Clixer',
    loading: 'Yükleniyor...',
    save: 'Kaydet',
    cancel: 'İptal',
    delete: 'Sil',
    edit: 'Düzenle',
    create: 'Oluştur',
    search: 'Ara',
    filter: 'Filtrele',
    yes: 'Evet',
    no: 'Hayır',
    confirm: 'Onayla',
    close: 'Kapat',
    back: 'Geri',
    next: 'İleri',
    
    login: 'Giriş Yap',
    logout: 'Çıkış Yap',
    email: 'E-posta',
    password: 'Şifre',
    forgotPassword: 'Şifremi Unuttum',
    rememberMe: 'Beni Hatırla',
    loginTitle: 'Hoş Geldiniz',
    loginSubtitle: 'Hesabınıza giriş yapın',
    
    menu: {
      dashboard: 'Kokpit',
      finance: 'Finans',
      operations: 'Operasyon',
      analysis: 'Detaylı Analiz',
      stores: 'Mağazalar',
      designer: 'Tasarım Stüdyosu',
      data: 'Veri Bağlantıları',
      admin: 'Yönetim Paneli',
      profile: 'Profilim',
    },
    
    dashboard: {
      title: 'Kokpit',
      revenue: 'Ciro',
      profit: 'Kar',
      orders: 'Sipariş',
      customers: 'Müşteri',
      today: 'Bugün',
      thisWeek: 'Bu Hafta',
      thisMonth: 'Bu Ay',
      compared: 'karşılaştırıldığında',
    },
    
    finance: {
      title: 'Finansal Şeffaflık & Karlılık',
      subtitle: 'Yatırımcı Gözüyle ROI ve P&L Simülasyonu',
      simulation: 'Simülasyon Modu',
      simulationDesc: 'Aylık ciroyu değiştirerek karlılık ve ROI üzerindeki etkiyi analiz edin.',
      simulatedRevenue: 'Simüle Edilen Ciro',
      criticalWarning: 'KRİTİK UYARI',
      cannotAmortize: 'Amorti Edilemiyor',
      cannotAmortizeDesc: 'Mevcut ciro ve gider yapısıyla işletme zarar etmektedir. Yatırım geri dönüşü hesaplanamaz. Lütfen ciro hedefini artırın veya giderleri optimize edin.',
      openingDate: 'Açılış Tarihi',
      initialInvestment: 'İlk Yatırım',
      estimatedRevenue: 'Tahmini Ciro (Aylık)',
      totalExpenses: 'Toplam Gider',
      netProfit: 'Net Kar (EBITDA)',
      profitMargin: 'Kar Marjı',
      roi: 'Yatırım Geri Dönüş Süresi (ROI)',
      roiPeriod: 'Geri Dönüş Süresi',
      years: 'Yıl',
      months: 'Ay',
      cannotCalculate: 'Hesaplanamıyor',
      incomeStatement: 'Gelir Tablosu Detayı',
      totalSalesRevenue: 'Toplam Satış Geliri',
      cogs: 'Mal Maliyeti (COGS)',
      grossProfit: 'Brüt Kar',
      rentExpense: 'Kira Gideri',
      personnelExpense: 'Personel Gideri',
      royalty: 'Royalty',
      marketing: 'Pazarlama',
      utilities: 'Utilities (Elektrik + Su)',
      otherExpenses: 'Diğer Giderler',
      expenseBreakdown: 'Gider Dağılımı',
      settings: 'Ayarlar',
      operationalExpenses: 'Operasyonel Giderler',
      fixedRent: 'Sabit Kira',
      revenueShare: 'Ciro Kira Payı',
      commonArea: 'Ortak Alan Gideri',
      targetCogs: 'Hedef COGS',
      electricityBudget: 'Elektrik Bütçesi',
      waterBudget: 'Su Bütçesi',
      personnelExpenses: 'Personel Giderleri',
      managerCount: 'Müdür Sayısı',
      managerSalary: 'Müdür Maaşı',
      kitchenCount: 'Mutfak Sayısı',
      kitchenSalary: 'Mutfak Maaşı',
      serviceCount: 'Servis Sayısı',
      serviceSalary: 'Servis Maaşı',
      courierCount: 'Kurye Sayısı',
      courierSalary: 'Kurye Maaşı',
      totalPersonnelCost: 'Toplam Personel Maliyeti',
      investmentRoi: 'Yatırım & ROI',
      saveFor: 'için Kaydet',
      saving: 'Kaydediliyor...',
      saved: 'Kaydedildi!',
      accessRestricted: 'Erişim Kısıtlı',
      accessRestrictedDesc: 'Bu ayarlara erişim yetkiniz bulunmamaktadır. Yetki almak için yöneticinizle iletişime geçin.',
    },
    
    admin: {
      title: 'Yönetim Paneli',
      systemSettings: 'Sistem Ayarları',
      userManagement: 'Kullanıcı Yönetimi',
      rolesPermissions: 'Rol & Yetkiler',
      ldapSso: 'LDAP / SSO',
      seedSettings: 'Varsayılan Ayarları Yükle',
      seedingSettings: 'Yükleniyor...',
      general: 'Genel',
      theme: 'Tema',
      locale: 'Dil & Bölge',
      security: 'Güvenlik',
      notifications: 'Bildirimler',
      financeSettings: 'Finans',
    },
    
    data: {
      title: 'Veri Bağlantıları',
      connections: 'Bağlantılar',
      datasets: 'Veri Setleri',
      etlJobs: 'ETL İşleri',
      systemHealth: 'Sistem Sağlığı',
      newConnection: 'Yeni Bağlantı',
      connectionName: 'Bağlantı Adı',
      connectionType: 'Bağlantı Türü',
      host: 'Sunucu',
      port: 'Port',
      database: 'Veritabanı',
      username: 'Kullanıcı Adı',
      testConnection: 'Bağlantıyı Test Et',
      lastSync: 'Son Senkronizasyon',
      syncNow: 'Şimdi Senkronize Et',
      rowCount: 'Satır Sayısı',
    },
    
    designer: {
      title: 'Tasarım Stüdyosu',
      newDesign: 'Yeni Tasarım',
      editDesign: 'Tasarımı Düzenle',
      designName: 'Tasarım Adı',
      designType: 'Tasarım Türü',
      saveDesign: 'Tasarımı Kaydet',
      widgets: 'Widget\'lar',
      addWidget: 'Widget Ekle',
      allowedPositions: 'Görüntüleme İzni (Pozisyonlar)',
      selectAll: 'Tümünü Seç',
      managementOnly: 'Sadece Yönetim',
      clear: 'Temizle',
    },
    
    profile: {
      title: 'Profilim',
      personalInfo: 'Kişisel Bilgiler',
      changePassword: 'Şifre Değiştir',
      currentPassword: 'Mevcut Şifre',
      newPassword: 'Yeni Şifre',
      confirmPassword: 'Şifre Tekrar',
      updateProfile: 'Profili Güncelle',
      assignedStores: 'Atanan Mağazalar',
    },
    
    messages: {
      saveSuccess: 'Başarıyla kaydedildi',
      saveError: 'Kaydetme hatası',
      deleteSuccess: 'Başarıyla silindi',
      deleteConfirm: 'Silmek istediğinizden emin misiniz?',
      loadError: 'Yükleme hatası',
      connectionSuccess: 'Bağlantı başarılı',
      connectionFailed: 'Bağlantı başarısız',
      requiredField: 'Bu alan zorunludur',
      invalidEmail: 'Geçersiz e-posta adresi',
      passwordMismatch: 'Şifreler eşleşmiyor',
      unauthorized: 'Bu işlem için yetkiniz yok',
      notFound: 'Kayıt bulunamadı',
      serverError: 'Sunucu hatası',
    },
    
    time: {
      justNow: 'Az önce',
      minutesAgo: 'dakika önce',
      hoursAgo: 'saat önce',
      daysAgo: 'gün önce',
      today: 'Bugün',
      yesterday: 'Dün',
      thisWeek: 'Bu hafta',
      thisMonth: 'Bu ay',
    },
  },
  
  en: {
    appName: 'Clixer',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    yes: 'Yes',
    no: 'No',
    confirm: 'Confirm',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    
    login: 'Login',
    logout: 'Logout',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot Password',
    rememberMe: 'Remember Me',
    loginTitle: 'Welcome',
    loginSubtitle: 'Sign in to your account',
    
    menu: {
      dashboard: 'Dashboard',
      finance: 'Finance',
      operations: 'Operations',
      analysis: 'Detailed Analysis',
      stores: 'Stores',
      designer: 'Design Studio',
      data: 'Data Connections',
      admin: 'Admin Panel',
      profile: 'My Profile',
    },
    
    dashboard: {
      title: 'Dashboard',
      revenue: 'Revenue',
      profit: 'Profit',
      orders: 'Orders',
      customers: 'Customers',
      today: 'Today',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      compared: 'compared to',
    },
    
    finance: {
      title: 'Financial Transparency & Profitability',
      subtitle: 'ROI and P&L Simulation from Investor Perspective',
      simulation: 'Simulation Mode',
      simulationDesc: 'Analyze the impact on profitability and ROI by changing monthly revenue.',
      simulatedRevenue: 'Simulated Revenue',
      criticalWarning: 'CRITICAL WARNING',
      cannotAmortize: 'Cannot Amortize',
      cannotAmortizeDesc: 'The business is operating at a loss with current revenue and expense structure. Return on investment cannot be calculated. Please increase revenue target or optimize expenses.',
      openingDate: 'Opening Date',
      initialInvestment: 'Initial Investment',
      estimatedRevenue: 'Estimated Revenue (Monthly)',
      totalExpenses: 'Total Expenses',
      netProfit: 'Net Profit (EBITDA)',
      profitMargin: 'Profit Margin',
      roi: 'Return on Investment Period (ROI)',
      roiPeriod: 'Payback Period',
      years: 'Years',
      months: 'Months',
      cannotCalculate: 'Cannot Calculate',
      incomeStatement: 'Income Statement Details',
      totalSalesRevenue: 'Total Sales Revenue',
      cogs: 'Cost of Goods Sold (COGS)',
      grossProfit: 'Gross Profit',
      rentExpense: 'Rent Expense',
      personnelExpense: 'Personnel Expense',
      royalty: 'Royalty',
      marketing: 'Marketing',
      utilities: 'Utilities (Electricity + Water)',
      otherExpenses: 'Other Expenses',
      expenseBreakdown: 'Expense Breakdown',
      settings: 'Settings',
      operationalExpenses: 'Operational Expenses',
      fixedRent: 'Fixed Rent',
      revenueShare: 'Revenue Share',
      commonArea: 'Common Area Cost',
      targetCogs: 'Target COGS',
      electricityBudget: 'Electricity Budget',
      waterBudget: 'Water Budget',
      personnelExpenses: 'Personnel Expenses',
      managerCount: 'Manager Count',
      managerSalary: 'Manager Salary',
      kitchenCount: 'Kitchen Staff Count',
      kitchenSalary: 'Kitchen Staff Salary',
      serviceCount: 'Service Staff Count',
      serviceSalary: 'Service Staff Salary',
      courierCount: 'Courier Count',
      courierSalary: 'Courier Salary',
      totalPersonnelCost: 'Total Personnel Cost',
      investmentRoi: 'Investment & ROI',
      saveFor: 'Save for',
      saving: 'Saving...',
      saved: 'Saved!',
      accessRestricted: 'Access Restricted',
      accessRestrictedDesc: 'You do not have permission to access these settings. Contact your administrator for access.',
    },
    
    admin: {
      title: 'Admin Panel',
      systemSettings: 'System Settings',
      userManagement: 'User Management',
      rolesPermissions: 'Roles & Permissions',
      ldapSso: 'LDAP / SSO',
      seedSettings: 'Load Default Settings',
      seedingSettings: 'Loading...',
      general: 'General',
      theme: 'Theme',
      locale: 'Language & Region',
      security: 'Security',
      notifications: 'Notifications',
      financeSettings: 'Finance',
    },
    
    data: {
      title: 'Data Connections',
      connections: 'Connections',
      datasets: 'Datasets',
      etlJobs: 'ETL Jobs',
      systemHealth: 'System Health',
      newConnection: 'New Connection',
      connectionName: 'Connection Name',
      connectionType: 'Connection Type',
      host: 'Host',
      port: 'Port',
      database: 'Database',
      username: 'Username',
      testConnection: 'Test Connection',
      lastSync: 'Last Sync',
      syncNow: 'Sync Now',
      rowCount: 'Row Count',
    },
    
    designer: {
      title: 'Design Studio',
      newDesign: 'New Design',
      editDesign: 'Edit Design',
      designName: 'Design Name',
      designType: 'Design Type',
      saveDesign: 'Save Design',
      widgets: 'Widgets',
      addWidget: 'Add Widget',
      allowedPositions: 'View Permission (Positions)',
      selectAll: 'Select All',
      managementOnly: 'Management Only',
      clear: 'Clear',
    },
    
    profile: {
      title: 'My Profile',
      personalInfo: 'Personal Information',
      changePassword: 'Change Password',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      updateProfile: 'Update Profile',
      assignedStores: 'Assigned Stores',
    },
    
    messages: {
      saveSuccess: 'Saved successfully',
      saveError: 'Save error',
      deleteSuccess: 'Deleted successfully',
      deleteConfirm: 'Are you sure you want to delete?',
      loadError: 'Loading error',
      connectionSuccess: 'Connection successful',
      connectionFailed: 'Connection failed',
      requiredField: 'This field is required',
      invalidEmail: 'Invalid email address',
      passwordMismatch: 'Passwords do not match',
      unauthorized: 'You are not authorized for this action',
      notFound: 'Record not found',
      serverError: 'Server error',
    },
    
    time: {
      justNow: 'Just now',
      minutesAgo: 'minutes ago',
      hoursAgo: 'hours ago',
      daysAgo: 'days ago',
      today: 'Today',
      yesterday: 'Yesterday',
      thisWeek: 'This week',
      thisMonth: 'This month',
    },
  },
}




