import type { Article } from '../../../types/article'

export const articlesEn: Article[] = [
  {
    id: 'designer-tasarim-studyosu-nedir',
    slug: 'tasarim-studyosu-nedir',
    title: 'What is Design Studio?',
    excerpt: 'Design dashboards and widgets with Clixer Design Studio.',
    category: 'designer',
    categoryLabel: 'Design Studio',
    tags: ['design', 'studio', 'dashboard', 'widget'],
    images: [],
    relatedArticles: ['designer-yeni-tasarim-olusturma', 'designer-widget-ekleme'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 1,
    content: `
# What is Design Studio?

Design Studio is Clixer's visual dashboard design tool. You can create professional dashboards without coding, using drag-and-drop.

## Features

### 1. Drag-and-Drop Interface
Drag widgets from the left panel and drop them onto the grid. Resize by dragging corners.

### 2. 24-Column Grid System
Grafana-style flexible grid system. Place widgets in any size and position.

### 3. Responsive Design
Your designs automatically become mobile-friendly. Preview on different screen sizes.

### 4. 17 Different Widget Types
- Cards (Big, Mini, Statistic)
- Charts (Line, Bar, Pie, Area)
- Tables and Lists
- Gauges and Progress Rings
- Special Widgets (Funnel, Heatmap, Treemap)

## Studio Interface

| Section | Description |
|---------|-------------|
| Left Panel | Widget list and adding |
| Center Area | Grid design area |
| Right Panel | Design and widget settings |
| Top Menu | Save, Open, Preview |

## Display Locations

You can display your designs in two different places:

- **Cockpit (Home)**: General summary dashboards
- **Analysis**: Detailed analysis pages

## Next Steps

- [Create New Design](/designer/yeni-tasarim-olusturma)
- [Add Widgets](/designer/widget-ekleme)
- [Widget Types](/designer/widget-turleri)
`
  },
  {
    id: 'designer-yeni-tasarim-olusturma',
    slug: 'yeni-tasarim-olusturma',
    title: 'Create New Design',
    excerpt: 'Create a new dashboard design step by step.',
    category: 'designer',
    categoryLabel: 'Design Studio',
    tags: ['design', 'new', 'create', 'dashboard'],
    images: [],
    relatedArticles: ['designer-widget-ekleme', 'designer-tasarim-kaydetme'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 2,
    content: `
# Create New Design

In this guide, you'll create a new dashboard design from scratch.

## Step 1: Open Studio

1. Select **Designer** from the left menu
2. Click the **Studio** tab

## Step 2: Enter Design Information

In the **Design Settings** section of the right panel:

1. **Design Name**: Give a meaningful name (e.g., "Daily Sales Summary")
2. **Display Location**: 
   - **Cockpit**: Home page dashboard
   - **Analysis**: Detailed analysis page

## Step 3: Set Report Permissions

Select which positions can see this report:

- ✅ General Manager
- ✅ Director
- ✅ Regional Manager
- ✅ Store Manager
- ⬜ Analyst
- ⬜ Viewer

> 💡 **Tip:** Use "All" button to select all, "Clear" to reset.

## Step 4: Report Category (Optional)

You can select a report category for separation of powers. This ensures only users authorized for certain categories can see the report.

## Step 5: Save

Click the **Save** button. Now you can start adding widgets.

## Tips

> 💡 You can edit the design name from the right panel.

> ⚠️ Changes will be lost if you leave the page without saving.

## Next Steps

- [Add Widgets](/designer/widget-ekleme) - Add widgets to design
- [Save Design](/designer/tasarim-kaydetme) - Save and load operations
`
  },
  {
    id: 'designer-widget-ekleme',
    slug: 'widget-ekleme',
    title: 'Adding Widgets',
    excerpt: 'Add and edit widgets on your dashboard.',
    category: 'designer',
    categoryLabel: 'Design Studio',
    tags: ['widget', 'add', 'edit', 'metric'],
    images: [],
    relatedArticles: ['designer-widget-turleri', 'metrics-yeni-metrik-olusturma'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 3,
    content: `
# Adding Widgets

Follow this guide to add and edit widgets on your dashboard.

## Methods to Add Widgets

### Method 1: Drag-and-Drop

1. Select a widget from the **Add Widget** section in the left panel
2. Drag the widget onto the grid
3. Drop it at the desired location

### Method 2: Click

1. Click on the widget in the left panel
2. Widget is automatically added to an empty area

## Resizing Widgets

Resize by dragging the widget's corners:

- **Bottom right corner**: Width and height together
- **Right edge**: Width only
- **Bottom edge**: Height only

Each widget has a minimum size. You cannot make it smaller than that.

## Moving Widgets

Drag from the top part (title area) of the widget to move it.

## Connecting Metrics

After adding a widget, you need to connect a metric:

1. Click on the widget
2. **Select Metric** dropdown opens in the right panel
3. Select the appropriate metric from the list
4. Widget starts displaying data

## Deleting Widgets

1. Click on the widget
2. Click the **trash** icon in the top right corner
3. Confirm

## Copying Widgets

1. Click on the widget
2. Click the **Copy** icon
3. New widget is added with the same settings

## Tips

> 💡 Widgets don't overlap, they automatically shift.

> 💡 To see grid lines, enable "Grid Lines" option from the left panel.

> ⚠️ Widget appears empty without a connected metric.

## Next Steps

- [Widget Types](/designer/widget-turleri) - All widget options
- [Chart Types](/designer/grafik-turleri) - Chart widgets
`
  },
  {
    id: 'designer-widget-turleri',
    slug: 'widget-turleri',
    title: 'Widget Types',
    excerpt: 'All widget types you can use in Clixer.',
    category: 'designer',
    categoryLabel: 'Design Studio',
    tags: ['widget', 'types', 'card', 'chart', 'table'],
    images: [],
    relatedArticles: ['designer-grafik-turleri', 'designer-tablo-widget'],
    lastUpdated: '2026-01-27',
    readingTime: 8,
    order: 4,
    content: `
# Widget Types

There are 17 different widget types in Clixer. Each is designed for different data visualization needs.

## Summary Widgets

### Big Card
Shows main KPI value in large font. Includes trend percentage and comparison.

**Usage:** Main metrics like total revenue, visitor count.

### Mini Card
Compact KPI display. Ideal for showing multiple metrics side by side.

**Usage:** Multiple KPIs in summary panels.

### Big Number
Only numerical value, minimal design.

**Usage:** Simple counters.

### Gauge
Circular gauge for target tracking.

**Usage:** Target vs actual comparison.

## Trend Widgets

### Mini Chart (Sparkline)
Small trend line.

**Usage:** Trend display inside cards.

### Trend Card
Value + trend chart together.

**Usage:** KPI and trend in single widget.

## Chart Widgets

### Bar Chart
Categorical comparison.

**Usage:** Store-based sales.

### Line Chart
Time series data.

**Usage:** Daily/weekly trends.

### Area Chart
Filled version of line chart.

**Usage:** Cumulative values.

### Pie Chart
Percentage distribution.

**Usage:** Category shares.

### Donut Chart
Pie chart with empty center.

**Usage:** Modern percentage display.

### Combo Chart
Bar + line together.

**Usage:** Sales + trend together.

## Table Widgets

### Data Table
Detailed data list.

**Usage:** Store list, product details.

### Ranking List
TOP 10 / Ranking display.

**Usage:** Best selling products.

## Special Widgets

### Funnel Chart
Staged process display.

**Usage:** Sales funnel, customer journey.

### Heatmap
Density matrix.

**Usage:** Hour/day based density.

### Treemap
Hierarchical data display.

**Usage:** Category-based distribution.

## Widget Selection Guide

| Need | Recommended Widget |
|------|-------------------|
| Single KPI display | Big Card |
| Multiple KPIs | Mini Card |
| Time trend | Line Chart |
| Comparison | Bar Chart |
| Percentage distribution | Pie/Donut |
| Detailed list | Data Table |
| Ranking | Ranking List |
| Target tracking | Gauge |
`
  },
  {
    id: 'designer-grafik-turleri',
    slug: 'grafik-turleri',
    title: 'Chart Types',
    excerpt: 'Use line, bar, pie and other chart types.',
    category: 'designer',
    categoryLabel: 'Design Studio',
    tags: ['chart', 'line', 'bar', 'pie', 'graph'],
    images: [],
    relatedArticles: ['designer-widget-turleri', 'metrics-gorsellestime-tipleri'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 5,
    content: `
# Chart Types

Learn about chart types you can use in Clixer and when to use them.

## Line Chart

**When to use:**
- Time series data
- Trend analysis
- Continuously changing data

**Example:** Daily sales trend, monthly visitor count

**Settings:**
- Line thickness
- Point display
- Filled area

## Bar Chart

**When to use:**
- Categorical comparison
- Discrete data
- Ranking display

**Example:** Store-based sales, product categories

**Settings:**
- Horizontal/Vertical orientation
- Bar width
- Grouping

## Area Chart

**When to use:**
- Cumulative values
- Volume display
- Trend + magnitude together

**Example:** Total sales accumulation, stock changes

## Pie Chart

**When to use:**
- Percentage distribution
- Part-whole relationship
- Few categories (max 7-8)

**Example:** Sales channel distribution, category shares

> ⚠️ **Warning:** More than 8 slices reduces readability.

## Donut Chart

Modern version of pie chart. The center space can be used to show total value.

## Combo Chart

**When to use:**
- Two different scales
- Value + trend together
- Comparative analysis

**Example:** Sales amount (bar) + profit margin (line)

## Funnel Chart

**When to use:**
- Staged processes
- Conversion rates
- Loss analysis

**Example:** Sales funnel (Visit → Cart → Purchase)

## Heatmap

**When to use:**
- Two-dimensional density
- Time-category matrix
- Pattern discovery

**Example:** Hour-day based sales density

## Chart Selection Guide

| Data Type | Recommended Chart |
|-----------|-------------------|
| Time series | Line, Area |
| Categorical | Bar |
| Percentage | Pie, Donut |
| Two scales | Combo |
| Process | Funnel |
| Matrix | Heatmap |
`
  },
  {
    id: 'designer-tablo-widget',
    slug: 'tablo-widget',
    title: 'Table Widget',
    excerpt: 'Create detailed lists with data table widget.',
    category: 'designer',
    categoryLabel: 'Design Studio',
    tags: ['table', 'list', 'data grid', 'widget'],
    images: [],
    relatedArticles: ['designer-widget-turleri', 'metrics-veri-tablosu-metrigi'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 6,
    content: `
# Table Widget

Create detailed data lists with the data table widget.

## What is Table Widget?

Table widget is a widget type that displays data in row and column format. Ideal for detailed data like store lists, product details, sales reports.

## Creating a Table

1. Select **Add Widget** > **Table**
2. Drag to grid
3. Connect metric (LIST or data_grid type)

## Column Settings

Columns you select when defining the metric appear in the table:

- **Column Name**: Header text
- **Column Width**: Auto or fixed
- **Alignment**: Left, center, right
- **Format**: Number, date, currency

## Sorting

- Click column header to sort
- Default sorting is defined in metric

## Filtering

Table widget is affected by dashboard filters:
- Date filter
- Region/Store filter
- RLS filters

## Pagination

Automatic pagination for multi-row data:
- Rows per page
- Page navigation

## Tips

> 💡 Horizontal scrolling activates for wide tables.

> 💡 You can adjust column widths by dragging.

> ⚠️ Too many columns can affect performance.

## Ranking List vs Table

| Feature | Ranking List | Table |
|---------|--------------|-------|
| Usage | TOP N | All data |
| Sorting | Required | Optional |
| Appearance | Compact | Detailed |
`
  },
  {
    id: 'designer-tasarim-kaydetme',
    slug: 'tasarim-kaydetme',
    title: 'Saving and Loading Designs',
    excerpt: 'Save and manage your dashboard designs.',
    category: 'designer',
    categoryLabel: 'Design Studio',
    tags: ['save', 'load', 'design', 'management'],
    images: [],
    relatedArticles: ['designer-yeni-tasarim-olusturma', 'designer-rapor-yetkileri'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 7,
    content: `
# Saving and Loading Designs

Learn how to save and manage your dashboard designs.

## Saving

### First Save

1. Enter design name
2. Select display location
3. Click **Save** button

### Saving Changes

After making changes to existing design:
- Click **Save** button
- Changes are automatically saved to the same design

## Opening Designs

1. Go to **Designs** section in the left panel
2. Select design from dropdown
3. Design loads onto grid

## Deleting Designs

1. Open the design
2. Click **Delete** button in the right panel
3. Confirm

> ⚠️ **Warning:** Deleted designs cannot be recovered!

## Copying Designs

To copy an existing design:
1. Open the design
2. Change the design name
3. Click **Save** (saves as new design)

## Tips

> 💡 Save regularly for unexpected situations.

> 💡 Use meaningful names: like "Sales Summary - v2".

> 💡 Keep test designs separate, don't mix with production.
`
  },
  {
    id: 'designer-rapor-yetkileri',
    slug: 'rapor-yetkileri',
    title: 'Report Permissions',
    excerpt: 'Define position-based access permissions for dashboards.',
    category: 'designer',
    categoryLabel: 'Design Studio',
    tags: ['permission', 'position', 'access', 'security'],
    images: [],
    relatedArticles: ['admin-pozisyon-yetkileri', 'admin-rls-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 8,
    content: `
# Report Permissions

Determine who can access dashboards based on positions.

## Permission System

There are two levels of permissions in Clixer:

1. **Report Permission**: Who can see the dashboard?
2. **Data Permission (RLS)**: What data can they see in the dashboard?

This section covers report permissions.

## Position-Based Access

When creating or editing a design:

1. Find the **Report Permissions** section in the right panel
2. Check positions that can view:
   - ☑️ General Manager
   - ☑️ Director
   - ☑️ Regional Manager
   - ☑️ Store Manager
   - ☐ Analyst
   - ☐ Viewer

## Quick Selection

- **All**: Selects all positions
- **Management**: Only manager positions
- **Clear**: Removes all selections

## Report Categories

Report categories can be used for separation of powers:

1. Assign category to design
2. Give category permission to users
3. Only authorized users see the report

## Example Scenario

| Dashboard | Authorized Positions |
|-----------|---------------------|
| General Summary | All positions |
| Financial Report | General Manager, Director |
| Store Detail | Regional Manager, Store Manager |
| Operations | Analyst |

## Tips

> 💡 Apply the least restrictive permission principle.

> ⚠️ Permission changes take effect immediately.

> ℹ️ Double-layer security is provided when used with RLS.
`
  }
]
