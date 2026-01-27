import type { Article } from '../../../types/article'

export const articlesEn: Article[] = [
  {
    id: 'data-veri-yonetimi-nedir',
    slug: 'veri-yonetimi-nedir',
    title: 'What is Data Management?',
    excerpt: 'General introduction to Clixer data management module.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['data', 'management', 'connection', 'dataset', 'etl'],
    images: [],
    relatedArticles: ['data-baglanti-olusturma', 'data-dataset-olusturma'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 1,
    content: `
# What is Data Management?

Data Management is the module where Clixer manages your data. Database connections, datasets, and ETL operations are managed from this module.

## Data Flow

\`\`\`
Source Database → Connection → Dataset → ETL → ClickHouse → Metric → Dashboard
\`\`\`

## Main Components

### 1. Connections
Provides access to source databases.
- SQL Server, PostgreSQL, MySQL
- REST API

### 2. Datasets
Definition of data to be extracted.
- Source table/query
- Column selection
- Partition settings

### 3. ETL Operations
Data transfer processes.
- Manual execution
- Scheduled tasks
- Incremental updates

### 4. ClickHouse
Analytics database.
- Fast querying
- Big data support
- Column-based storage

## Data Menu

When you select **Data** from the left menu:

| Tab | Description |
|-----|-------------|
| Connections | Database connections |
| Datasets | Data sets |
| ETL | Transfer operations |
| ClickHouse | Analytics tables |

## Next Steps

1. [Create Connection](/data/baglanti-olusturma)
2. [Create Dataset](/data/dataset-olusturma)
3. [Run ETL](/data/etl-calistirma)
`
  },
  {
    id: 'data-baglanti-olusturma',
    slug: 'baglanti-olusturma',
    title: 'Create Connection',
    excerpt: 'Create a connection to your source database.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['connection', 'database', 'sql server'],
    images: [],
    relatedArticles: ['data-mssql-baglantisi', 'data-dataset-olusturma'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 2,
    content: `
# Create Connection

Follow this guide to create a connection to your source database.

## Open Connection Page

1. Select **Data** from the left menu
2. Click the **Connections** tab
3. Click **+ New Connection** button

## Connection Information

### Connection Name
Give a meaningful name: "ERP Database", "Sales DB"

### Connection Type
Supported types:
- Microsoft SQL Server
- PostgreSQL
- MySQL
- REST API

### Server Information

| Field | Description | Example |
|-------|-------------|---------|
| Host | Server address | 192.168.1.100 |
| Port | Connection port | 1433 (MSSQL) |
| Database | Database name | ERP_DB |
| Username | User name | clixer_user |
| Password | Password | ******** |

## Connection Test

1. Enter all information
2. Click **Test** button
3. Wait for "Connection successful" message

### If Test Fails

| Error | Possible Cause | Solution |
|-------|----------------|----------|
| Connection timeout | Server unreachable | Firewall/network check |
| Login failed | Wrong credentials | Check user/password |
| Database not found | Wrong DB name | Check database name |

## Save

After successful test, click **Save** button.

## Security

> ⚠️ Passwords are stored encrypted.

> 💡 Create a user with read-only permissions.

> 💡 Use IP whitelist.

## Next Steps

- [Create Dataset](/data/dataset-olusturma)
- [MSSQL Connection](/data/mssql-baglantisi)
`
  },
  {
    id: 'data-mssql-baglantisi',
    slug: 'mssql-baglantisi',
    title: 'SQL Server Connection',
    excerpt: 'Connect to Microsoft SQL Server database.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['mssql', 'sql server', 'microsoft', 'connection'],
    images: [],
    relatedArticles: ['data-baglanti-olusturma', 'data-postgresql-baglantisi'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 3,
    content: `
# SQL Server Connection

Guide for creating a connection to Microsoft SQL Server database.

## Requirements

- SQL Server 2012 or later
- TCP/IP protocol enabled
- Access permission from Clixer server

## Connection Settings

| Field | Value |
|-------|-------|
| Type | Microsoft SQL Server |
| Port | 1433 (default) |
| Encryption | Optional |

## Create SQL Server User

\`\`\`sql
-- Create login
CREATE LOGIN clixer_reader WITH PASSWORD = 'StrongPassword123!';

-- Create user in database
USE ERP_DB;
CREATE USER clixer_reader FOR LOGIN clixer_reader;

-- Grant read permission
EXEC sp_addrolemember 'db_datareader', 'clixer_reader';
\`\`\`

## Firewall Settings

Open SQL Server's port 1433:
- Add rule in Windows Firewall
- Allow in network security group

## Named Instance

If using named instance:
- Host: server\\instance_name
- Port: Dynamic port number

## Common Errors

### Login Failed
- Wrong username/password
- SQL Authentication disabled

### Connection Timeout
- Firewall blocking
- Wrong IP/port

### Cannot Open Database
- Wrong database name
- User has no access permission

## Tips

> 💡 Use SQL Authentication instead of Windows Authentication.

> 💡 Grant read permission only to required tables.

> ⚠️ Don't use SA user!
`
  },
  {
    id: 'data-dataset-olusturma',
    slug: 'dataset-olusturma',
    title: 'Create Dataset',
    excerpt: 'Define a new dataset.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['dataset', 'data', 'table', 'create'],
    images: [],
    relatedArticles: ['data-dataset-ayarlari', 'data-etl-calistirma'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 4,
    content: `
# Create Dataset

A dataset is a data set to be transferred from source database to Clixer.

## Open Dataset Page

1. Select **Data** from the left menu
2. Click the **Datasets** tab
3. Click **+ New Dataset** button

## Basic Information

### Dataset Name
Give a meaningful name: "Daily Sales", "Store List"

### Connection Selection
Which database to pull data from.

## Data Source

### Table Selection
Select an existing table:
1. Select from **Select Table** dropdown
2. Columns are automatically listed

### Custom Query
Write SQL for complex data:
\`\`\`sql
SELECT 
  date,
  store_id,
  SUM(amount) as total_amount,
  COUNT(*) as transaction_count
FROM sales
WHERE date >= '2025-01-01'
GROUP BY date, store_id
\`\`\`

## Column Selection

Select which columns to transfer:

| Column | Type | Selected |
|--------|------|----------|
| date | Date | ✅ |
| store_id | String | ✅ |
| amount | Float | ✅ |
| description | String | ❌ |

> 💡 Don't select unnecessary columns, affects performance.

## Partition Column

Select partition column for date-based partitioning:

- Required for incremental ETL
- Usually date column is selected
- Improves query performance

## Preview

View first 100 rows with **Preview** button.

## Save

1. Configure all settings
2. Click **Save** button
3. Ready to run ETL

## Next Steps

- [Dataset Settings](/data/dataset-ayarlari)
- [Run ETL](/data/etl-calistirma)
`
  },
  {
    id: 'data-dataset-ayarlari',
    slug: 'dataset-ayarlari',
    title: 'Dataset Settings',
    excerpt: 'Partition, reference column and other settings.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['dataset', 'settings', 'partition', 'reference'],
    images: [],
    relatedArticles: ['data-dataset-olusturma', 'data-etl-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 5,
    content: `
# Dataset Settings

Configure advanced settings for the dataset.

## Partition Column

### What is it?
Column that partitions data by date. Used for incremental updates in ETL.

### How to Select?
- Must be date type column
- Usually "date", "created_at", "transaction_date"
- Must have value in every row (not NULL)

### Benefits
- Enables incremental ETL
- Improves query performance
- Optimizes storage

## Reference Column

### What is it?
Column used for RLS (Row Level Security).

### Examples
- store_id: Store-based filtering
- region_id: Region-based filtering
- user_id: User-based filtering

## Data Type Mapping

Map source and target data types:

| Source (SQL Server) | Target (ClickHouse) |
|---------------------|---------------------|
| INT | Int32 |
| BIGINT | Int64 |
| VARCHAR | String |
| DECIMAL | Float64 |
| DATETIME | DateTime |
| DATE | Date |

## Column Name Editing

You can change column names:
- Don't use special characters
- Use underscore instead of space
- Lowercase recommended

## Default Values

Default for NULL values:
- Numeric: 0
- Text: ''
- Date: Must be specified

## Tips

> 💡 Partition column should be indexed.

> 💡 Reference column is critical for RLS.

> ⚠️ Column type change can break ETL.
`
  },
  {
    id: 'data-etl-nedir',
    slug: 'etl-nedir',
    title: 'What is ETL?',
    excerpt: 'Learn about Extract, Transform, Load concept.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['etl', 'extract', 'transform', 'load'],
    images: [],
    relatedArticles: ['data-etl-calistirma', 'data-zamanlanmis-etl'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 6,
    content: `
# What is ETL?

ETL (Extract, Transform, Load) is the three stages of data transfer process.

## ETL Stages

### 1. Extract
Pulling data from source database.

- SQL query is executed
- Data is read
- Loaded into memory

### 2. Transform
Converting data to target format.

- Data type conversion
- Cleaning
- Calculation

### 3. Load
Writing to target database.

- Transfer to ClickHouse
- Partition-based writing
- Indexing

## ETL Types

### Full Load
Loads all data from scratch.
- Used in initial setup
- Takes long time
- Deletes all data and rewrites

### Incremental Load
Loads only changed data.
- Daily/hourly updates
- Fast
- Works based on partition column

## ETL Flow

\`\`\`
Source DB → Extract → Transform → Load → ClickHouse
    ↓          ↓          ↓         ↓
  Query      Read     Convert    Write
\`\`\`

## ETL in Clixer

Clixer automatically manages ETL operations:
- Manual triggering
- Scheduled execution
- Error handling
- Logging

## Next Steps

- [Run ETL](/data/etl-calistirma)
- [Scheduled ETL](/data/zamanlanmis-etl)
`
  },
  {
    id: 'data-etl-calistirma',
    slug: 'etl-calistirma',
    title: 'Run ETL',
    excerpt: 'Start manual ETL operation.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['etl', 'run', 'manual', 'sync'],
    images: [],
    relatedArticles: ['data-etl-nedir', 'data-zamanlanmis-etl'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 7,
    content: `
# Run ETL

Follow this guide to manually start an ETL operation.

## Open ETL Page

1. Select **Data** from the left menu
2. Click the **ETL** tab

## Dataset Selection

Select the dataset to run ETL:
1. Select from dataset list
2. Or run all with "All"

## ETL Type Selection

### Full Sync
- Deletes all data and reloads
- Use for initial setup
- Takes long time

### Incremental Sync
- Loads only new/changed data
- For daily use
- Fast

## Date Range

Specify date range for incremental sync:
- Start date
- End date

## Execute

1. Click **Start** button
2. Follow progress bar
3. Wait for completion message

## ETL Statuses

| Status | Description |
|--------|-------------|
| Waiting | In queue |
| Running | Operation in progress |
| Completed | Successful |
| Failed | Unsuccessful |

## On Error

1. Read error message
2. Review log details
3. Fix the issue
4. Run again

## Tips

> 💡 Use Full Sync for first ETL.

> 💡 Incremental is sufficient for daily updates.

> ⚠️ Dashboards may be affected during Full Sync.
`
  },
  {
    id: 'data-zamanlanmis-etl',
    slug: 'zamanlanmis-etl',
    title: 'Scheduled ETL',
    excerpt: 'Set up automatic ETL scheduling.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['etl', 'schedule', 'cron', 'automatic'],
    images: [],
    relatedArticles: ['data-etl-calistirma', 'data-etl-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 8,
    content: `
# Scheduled ETL

Set up scheduling to automatically run ETL operations.

## Schedule Settings

Find the **Schedule** section in dataset edit screen.

### Schedule Type

| Type | Description | Example |
|------|-------------|---------|
| Hourly | Every hour | Every hour on the hour |
| Daily | Every day | Every night at 02:00 |
| Weekly | Once a week | Every Monday |
| Custom | Cron expression | */30 * * * * |

### Cron Expression

Cron format for custom scheduling:
\`\`\`
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-7)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)
\`\`\`

### Examples

| Expression | Description |
|------------|-------------|
| 0 2 * * * | Every day at 02:00 |
| 0 */4 * * * | Every 4 hours |
| 0 0 * * 1 | Every Monday at midnight |
| */30 * * * * | Every 30 minutes |

## Enable Schedule

1. Select schedule type
2. Enter time/cron expression
3. Turn on **Enable Schedule** toggle
4. Save

## Monitor Schedule

View scheduled tasks in ETL tab:
- Last run time
- Next run time
- Status

## Tips

> 💡 Choose off-peak hours (night).

> 💡 Consider source database load.

> ⚠️ Too frequent scheduling can affect performance.
`
  },
  {
    id: 'data-clickhouse-yonetimi',
    slug: 'clickhouse-yonetimi',
    title: 'ClickHouse Management',
    excerpt: 'Manage analytics database tables.',
    category: 'data',
    categoryLabel: 'Data Management',
    tags: ['clickhouse', 'analytics', 'table', 'database'],
    images: [],
    relatedArticles: ['data-etl-nedir', 'advanced-performans-ipuclari'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 9,
    content: `
# ClickHouse Management

ClickHouse is Clixer's analytics database. Optimized for fast querying.

## What is ClickHouse?

- Column-based (columnar) database
- Optimized for big data
- Real-time analytics
- High compression ratio

## ClickHouse Page

1. Select **Data** from the left menu
2. Click the **ClickHouse** tab

## Table List

View existing tables:
- Table name
- Row count
- Disk size
- Last update

## Table Details

Click on a table to see details:
- Column list
- Data types
- Partition info
- Indexes

## Run Query

Admin users can run SQL queries:

\`\`\`sql
SELECT 
  toStartOfMonth(date) as month,
  SUM(amount) as total
FROM daily_sales
WHERE date >= '2025-01-01'
GROUP BY month
ORDER BY month
\`\`\`

> ⚠️ Only SELECT queries can be executed.

## Table Cleanup

To clean old data:
1. Select table
2. Click **Clean** button
3. Specify date range
4. Confirm

## Performance Tips

> 💡 Use partition column in WHERE.

> 💡 Don't add unnecessary columns to SELECT.

> 💡 Limit result count with LIMIT.

## Disk Usage

Monitor table sizes:
- Large tables can affect performance
- Archive old data
- Delete unnecessary tables
`
  }
]
