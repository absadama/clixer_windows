import type { Article } from '../../../types/article'

export const articlesEn: Article[] = [
  {
    id: 'getting-started-clixer-nedir',
    slug: 'clixer-nedir',
    title: 'What is Clixer?',
    excerpt: 'Learn the basic features of Clixer enterprise analytics platform and what it does.',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    tags: ['introduction', 'basics', 'analytics', 'dashboard'],
    images: [],
    relatedArticles: ['getting-started-ilk-giris', 'getting-started-temel-kavramlar'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 1,
    content: `
# What is Clixer?

Clixer is an enterprise-level **business intelligence (BI) and analytics platform**. It allows you to visualize, analyze, and report your data.

## What Can You Do with Clixer?

With Clixer, you can:

- **Create Dashboards**: Design interactive dashboards with drag-and-drop interface
- **Track KPIs**: Monitor your key performance indicators in real-time
- **Data Integration**: Pull data from various databases (SQL Server, PostgreSQL, MySQL)
- **Automated Reporting**: Send scheduled reports via email
- **Mobile Access**: Access your dashboards from phone or tablet

## Who Can Use It?

Clixer can be used without software knowledge:

| Role | Use Case |
|------|----------|
| CEO | Company-wide KPI tracking |
| Regional Manager | Regional performance analysis |
| Store Manager | Store sales reports |
| Analyst | Detailed data analysis |

## Key Features

### 1. Design Studio
Design dashboards without coding. Drag and drop widgets, resize them.

### 2. Metric Management
Define your KPIs. Perform calculations like sum, average, count.

### 3. Data Management
Connect your databases, create datasets, schedule ETL jobs.

### 4. Permission Management
Ensure users only see data they're authorized to view (RLS).

## Next Steps

To start using Clixer:

1. [First Login](/getting-started/ilk-giris) - Get to know the interface
2. [Basic Concepts](/getting-started/temel-kavramlar) - Learn the terminology
3. [Quick Start](/getting-started/hizli-baslangic) - First dashboard in 5 minutes

> 💡 **Tip:** You can quickly access any topic from the left menu.
`
  },
  {
    id: 'getting-started-ilk-giris',
    slug: 'ilk-giris',
    title: 'First Login and Interface Tour',
    excerpt: 'Make your first login to Clixer and get to know the interface.',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    tags: ['login', 'interface', 'menu', 'navigation'],
    images: [],
    relatedArticles: ['getting-started-clixer-nedir', 'getting-started-temel-kavramlar'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 2,
    content: `
# First Login and Interface Tour

In this guide, you'll learn how to login to Clixer and explore the interface.

## Logging In

1. Open the Clixer URL in your browser
2. Enter your **Email** and **Password**
3. Click the **Login** button

> ℹ️ **Note:** Use the credentials provided by your system administrator for first login.

## 2FA (Two-Factor Authentication)

If 2FA is enabled in your system:

1. Open Google Authenticator or similar app
2. Scan the QR code
3. Enter the 6-digit code

## Main Interface

After logging in, you'll see:

### Left Menu (Sidebar)

| Menu | Description |
|------|-------------|
| 🏠 Home | Dashboard list |
| 📊 Dashboard | Selected dashboard view |
| 📈 Analysis | Detailed analysis page |
| 🎨 Designer | Design studio |
| 📁 Data | Connection and dataset management |
| ⚙️ Admin | Admin panel (for authorized users) |

### Top Menu

- **Date Picker**: Set the date range for reports
- **Filters**: Apply filters like region, store
- **Profile**: Account settings and logout

### Filter Bar

With the filter bar on dashboards:

- Select **date range** (Today, This Week, This Month, Custom)
- Filter by **Region**
- Select **Store**

## Changing Theme

Clixer comes with dark theme. To change theme:

1. Click the profile icon at top right
2. Select **Settings**
3. Choose your preference in **Theme** section

## Next Steps

- [Basic Concepts](/getting-started/temel-kavramlar) - Learn Dataset, Metric, Widget concepts
- [Quick Start](/getting-started/hizli-baslangic) - Create your first dashboard
`
  },
  {
    id: 'getting-started-temel-kavramlar',
    slug: 'temel-kavramlar',
    title: 'Basic Concepts',
    excerpt: 'Learn about Dataset, Metric, Widget and RLS concepts.',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    tags: ['concept', 'dataset', 'metric', 'widget', 'rls'],
    images: [],
    relatedArticles: ['getting-started-hizli-baslangic', 'metrics-metrik-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 3,
    content: `
# Basic Concepts

Understanding these basic concepts is important for using Clixer effectively.

## 1. Connection

A **Connection** is the database connection that Clixer uses to access your data.

Supported databases:
- Microsoft SQL Server
- PostgreSQL
- MySQL
- REST API

> 💡 **Example:** You create a connection to your company's ERP system database.

## 2. Dataset

A **Dataset** is a data set pulled from a connection and prepared for use in Clixer.

A dataset includes:
- Source table or query
- Columns (date, number, text)
- Partition column (date-based partitioning)

> 💡 **Example:** "Daily Sales" dataset pulls daily data from the sales table.

## 3. ETL (Extract, Transform, Load)

**ETL** is the data transfer process from source database to Clixer.

| Phase | Description |
|-------|-------------|
| Extract | Pull data from source database |
| Transform | Transform data (format, calculation) |
| Load | Load into Clixer (ClickHouse) |

ETL operations can be:
- Run manually
- Scheduled (nightly, hourly)

## 4. Metric

A **Metric** is a meaningful value calculated from data.

Metric components:
- **Dataset**: Source of data
- **Column**: Field to calculate
- **Calculation Type**: Sum, Average, Count
- **Visualization**: Card, chart, table

> 💡 **Example:** "Total Revenue" metric is the sum of the amount column in sales table.

## 5. Widget

A **Widget** is a visual component displayed on a dashboard.

Widget types:
- **Card**: Single KPI value
- **Chart**: Line, bar, pie charts
- **Table**: Data list
- **Gauge**: Target tracking

## 6. Dashboard (Design)

A **Dashboard** is a visual report page where widgets come together.

Dashboard features:
- Drag-and-drop editing
- Responsive design (mobile-friendly)
- Permission-based access

## 7. RLS (Row Level Security)

**RLS** ensures users only see data they're authorized to view.

| User | Visible Data |
|------|--------------|
| CEO | All stores |
| Regional Manager | Stores in their region |
| Store Manager | Only their store |

## Relationship Between Concepts

\`\`\`
Connection → Dataset → Metric → Widget → Dashboard
                         ↓
                        RLS (Filtering)
\`\`\`

## Next Steps

- [Quick Start](/getting-started/hizli-baslangic) - Apply these concepts in practice
- [Create Dataset](/data/dataset-olusturma) - Create your first dataset
- [Create Metric](/metrics/yeni-metrik-olusturma) - Define your first metric
`
  },
  {
    id: 'getting-started-hizli-baslangic',
    slug: 'hizli-baslangic',
    title: 'First Dashboard in 5 Minutes',
    excerpt: 'Create your first dashboard step by step.',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    tags: ['quick start', 'dashboard', 'first step'],
    images: [],
    relatedArticles: ['designer-yeni-tasarim-olusturma', 'metrics-yeni-metrik-olusturma'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 4,
    content: `
# First Dashboard in 5 Minutes

In this guide, you'll create your first dashboard step by step.

## Prerequisites

Before starting, make sure you have:
- ✅ Logged into Clixer
- ✅ At least one dataset created
- ✅ At least one metric defined

> ℹ️ **Note:** If you don't have datasets and metrics, check the [Data Management](/data/veri-yonetimi-nedir) section first.

## Step 1: Open Design Studio

1. Select **Designer** (🎨) from the left menu
2. Click the **Studio** tab

## Step 2: Create New Design

1. Enter **Design Name** in the right panel (e.g., "Sales Summary")
2. Select **Display Location**:
   - **Cockpit**: Main page dashboard
   - **Analysis**: Detailed analysis page
3. Click **Save** button

## Step 3: Add Widget

1. Go to **Add Widget** section in the left panel
2. Drag **Big Card** widget and drop it on the grid
3. Click the widget, settings will open in the right panel

## Step 4: Connect Metric

1. Click **Select Metric** dropdown in widget settings
2. Select a metric from the list (e.g., "Total Revenue")
3. Widget will automatically display the data

## Step 5: Resize

Resize the widget by dragging its corners:
- **Width**: Drag left-right
- **Height**: Drag up-down

## Step 6: Add More Widgets

Repeat the same steps to add:
- **Mini Card**: For compact KPIs
- **Chart**: To see trends
- **Table**: For detailed list

## Step 7: Save

1. Click the **Save** button at top right
2. Your dashboard is saved!

## Result

Congratulations! You've created your first dashboard. 🎉

Now:
- View it from **Dashboard** menu
- Try date filters
- Check mobile view

## Next Steps

- [Widget Types](/designer/widget-turleri) - Explore all widget options
- [Create Charts](/designer/grafik-turleri) - Add visual charts
- [Edit Metrics](/metrics/yeni-metrik-olusturma) - Define custom metrics

> 💡 **Tip:** Regularly update your dashboard and customize it according to your needs.
`
  },
  {
    id: 'getting-started-sss',
    slug: 'sss',
    title: 'Frequently Asked Questions',
    excerpt: 'Most frequently asked questions and answers.',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    tags: ['faq', 'questions', 'answers', 'help'],
    images: [],
    relatedArticles: ['getting-started-clixer-nedir', 'advanced-sorun-giderme'],
    lastUpdated: '2026-01-27',
    readingTime: 8,
    order: 5,
    content: `
# Frequently Asked Questions

## General Questions

### How do I login to Clixer?
You can login with the email and password provided by your system administrator. If 2FA is enabled, you'll need to enter a verification code from Google Authenticator or similar app.

### I forgot my password, what should I do?
Click the "Forgot Password" link on the login screen. A password reset link will be sent to your email address.

### Can I access from mobile devices?
Yes! Clixer has a responsive design. You can access from your browser or add it to your home screen to use it like an app (PWA).

---

## Dashboard Questions

### Why is my dashboard empty?
Possible reasons:
1. No data in selected date range
2. Filters are too restrictive
3. Unauthorized data area

**Solution:** Expand the date range and check filters.

### Why aren't widgets loading?
1. Check your internet connection
2. Refresh the page (F5)
3. Clear browser cache

### How often is data updated?
Depends on ETL scheduling. Usually:
- **Daily data**: Every night
- **Real-time data**: Hourly or more frequent

---

## Metric Questions

### What's the difference between Metric and Widget?
- **Metric**: Calculation definition (what to calculate)
- **Widget**: Visual display (how to show)

A metric can be used in multiple widgets.

### When should SQL mode be used?
- When complex calculations are needed
- When joining multiple tables (UNION)
- When custom filtering logic is required

### What is LFL (Like-for-Like)?
Comparable period analysis. Only compares stores that were open in both periods.

---

## Data Questions

### Why isn't my data up to date?
1. Check if ETL job ran
2. Look at last ETL time
3. Check if data exists in source database

### How do I connect a new database?
1. Go to **Data** > **Connections** menu
2. Click **+ New Connection**
3. Enter database information
4. Verify connection with **Test**

### What's the difference between Dataset and Table?
- **Table**: Raw data in source database
- **Dataset**: Optimized data transferred to Clixer

---

## Permission Questions

### Why can't I see some data?
Due to RLS (Row Level Security). You only see data you're authorized to view. Contact your system administrator for more access.

### How do I add a new user?
Follow **Admin** > **Users** > **+ New User** path. (Requires admin permission)

---

## Performance Questions

### Why is my dashboard loading slowly?
Possible reasons:
1. Too many widgets
2. Wide date range
3. Complex calculations

**Solution:** Narrow the date range, remove unnecessary widgets.

### Why is data delayed?
Depends on ETL processing time and cache TTL. Contact your system administrator for real-time data.

---

## More Help

If you couldn't find your issue:
- Check the [Troubleshooting](/advanced/sorun-giderme) guide
- Contact your system administrator
- Send email to support@clixer.io
`
  }
]
