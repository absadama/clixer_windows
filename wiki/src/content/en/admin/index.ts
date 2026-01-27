import type { Article } from '../../../types/article'

export const articlesEn: Article[] = [
  {
    id: 'admin-yonetim-paneli-nedir',
    slug: 'yonetim-paneli-nedir',
    title: 'What is Admin Panel?',
    excerpt: 'General introduction to Clixer admin panel.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['admin', 'panel', 'settings', 'management'],
    images: [],
    relatedArticles: ['admin-kullanici-yonetimi', 'admin-pozisyon-yetkileri'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 1,
    content: `
# What is Admin Panel?

Admin Panel is Clixer's system management interface. Users, permissions, and system settings are managed here.

## Access

Select **Admin** (⚙️) from the left menu.

> ⚠️ Only Admin authorized users can access the admin panel.

## Main Sections

### Users
- Add/edit users
- Password reset
- 2FA management
- Active/Inactive status

### Positions
- Position definition
- Permission management
- Role assignments

### Master Data
- Region definitions
- Store definitions
- Organization structure

### RLS (Row Level Security)
- Data access rules
- User-store mapping

### System Settings
- General settings
- Security settings
- Theme settings

## Permission Levels

| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | All permissions |
| ADMIN | User and settings management |
| USER | View only |

## Next Steps

- [User Management](/admin/kullanici-yonetimi)
- [Position Permissions](/admin/pozisyon-yetkileri)
- [RLS Setup](/admin/rls-kurulumu)
`
  },
  {
    id: 'admin-kullanici-yonetimi',
    slug: 'kullanici-yonetimi',
    title: 'User Management',
    excerpt: 'Add, edit and manage users.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['user', 'add', 'edit', 'management'],
    images: [],
    relatedArticles: ['admin-pozisyon-yetkileri', 'admin-rls-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 2,
    content: `
# User Management

Add, edit and manage system users.

## User List

1. Go to **Admin** > **Users** tab
2. View existing users

List information:
- Full Name
- Email
- Position
- Status (Active/Inactive)
- Last login

## Add New User

1. Click **+ New User** button
2. Fill in information:

| Field | Description |
|-------|-------------|
| First Name | User's first name |
| Last Name | User's last name |
| Email | Login email |
| Password | Initial password |
| Position | Role/position |
| Phone | Optional |

3. Click **Save** button

## Edit User

1. Click **Edit** icon on user row
2. Update information
3. Click **Save** button

## Reset Password

1. Enter edit mode for user
2. Click **Reset Password** button
3. Enter new password
4. Save

## Reset 2FA

If user lost their 2FA device:
1. Click 🔑 icon on user row
2. Confirm
3. User can set up with new QR code

## Deactivate User

1. Edit user
2. Turn off **Active** toggle
3. Save

> ⚠️ Deactivated user cannot login.

## Bulk Operations

- Select multiple users
- Bulk activate/deactivate
- Bulk change position

## Tips

> 💡 Apply strong password policy.

> 💡 Immediately deactivate departing staff.

> 💡 Regularly review user list.
`
  },
  {
    id: 'admin-pozisyon-yetkileri',
    slug: 'pozisyon-yetkileri',
    title: 'Position Permissions',
    excerpt: 'Role and permission management.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['position', 'permission', 'role', 'access'],
    images: [],
    relatedArticles: ['admin-kullanici-yonetimi', 'admin-rls-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 3,
    content: `
# Position Permissions

Assign permissions to positions and manage roles.

## What is Position?

Position defines the user's role in the organization. Each position can have different permissions.

## Default Positions

| Position | Description |
|----------|-------------|
| General Manager | Access to all data |
| Director | Department-based access |
| Regional Manager | Region-based access |
| Store Manager | Store-based access |
| Analyst | Analysis permission |
| Viewer | View only |

## Create Position

1. Go to **Admin** > **Positions** tab
2. Click **+ New Position**
3. Enter position name and code
4. Save

## Assign Permissions

Define permissions for each position:

### Module Permissions
- ✅ Dashboard viewing
- ✅ Analysis page
- ❌ Designer access
- ❌ Data management
- ❌ Admin panel

### Data Permissions
- All data
- Region-based
- Store-based
- Own data

## Permission Matrix

| Permission | GM | Dir | RM | SM |
|------------|----|----|----|----|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Designer | ✅ | ✅ | ❌ | ❌ |
| Data | ✅ | ❌ | ❌ | ❌ |
| Admin | ✅ | ❌ | ❌ | ❌ |

## Position Hierarchy

Upper positions can see data of lower positions:

\`\`\`
General Manager
    └── Director
        └── Regional Manager
            └── Store Manager
\`\`\`

## Tips

> 💡 Apply least privilege principle.

> 💡 Document position changes.

> ⚠️ Deleting position affects users.
`
  },
  {
    id: 'admin-rls-nedir',
    slug: 'rls-nedir',
    title: 'What is RLS (Row Level Security)?',
    excerpt: 'Learn about row level security concept.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['rls', 'security', 'data', 'access'],
    images: [],
    relatedArticles: ['admin-rls-kurulumu', 'admin-pozisyon-yetkileri'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 4,
    content: `
# What is RLS (Row Level Security)?

RLS is a security mechanism that ensures users only see data they are authorized to view.

## How RLS Works

1. Store/region assignment is made to user
2. Queries are automatically filtered
3. User only sees authorized data

## Example Scenario

### Without RLS
All users see all stores' data.

### With RLS
| User | Can See |
|------|---------|
| John (Regional Manager) | Marmara region stores |
| Mike (Store Manager) | Only their store |
| Sarah (General Manager) | All stores |

## RLS Components

### 1. Reference Column
Filtering column in dataset (store_id, region_id)

### 2. Master Data
Store and region definitions

### 3. User Assignment
User-store mapping

## RLS Flow

\`\`\`
User Login → Permission Check → Query Filtering → Result
     ↓              ↓                 ↓
   Mike        Store: S001      WHERE store_id = 'S001'
\`\`\`

## Benefits

- Data security
- Automatic filtering
- Central management
- Auditability

## Next Steps

- [RLS Setup](/admin/rls-kurulumu)
- [Master Data Management](/admin/bolge-ekleme)
`
  },
  {
    id: 'admin-rls-kurulumu',
    slug: 'rls-kurulumu',
    title: 'RLS Setup',
    excerpt: 'Step by step RLS configuration.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['rls', 'setup', 'configuration', 'security'],
    images: [],
    relatedArticles: ['admin-rls-nedir', 'admin-magaza-ekleme'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 5,
    content: `
# RLS Setup

Configure Row Level Security step by step.

## Prerequisites

1. Master data defined (regions, stores)
2. Reference column exists in datasets
3. Users created

## Step 1: Check Master Data

In **Admin** > **Master Data** section:
- Are regions defined?
- Are stores defined?
- Is hierarchy correct?

## Step 2: Dataset Reference Column

Select reference column in dataset settings:
- store_id
- region_id
- or custom column

## Step 3: User Assignment

1. Go to **Admin** > **Users**
2. Edit user
3. Open **RLS Assignments** section
4. Select store/region

### Assignment Types

| Type | Description |
|------|-------------|
| Store | Single store access |
| Region | All stores in region |
| All | Access to all data |

## Step 4: Test

1. Login with test user
2. Check dashboards
3. Only authorized data should appear

## Multiple Assignment

You can assign multiple stores to a user:
- Store 1 ✅
- Store 2 ✅
- Store 3 ❌

## Hierarchical Access

When regional manager is assigned:
- Sees all stores in region
- Also sees sub-regions

## Troubleshooting

### Data Not Showing
- Is RLS assignment made?
- Is reference column correct?
- Is there data in dataset?

### Too Much Data Showing
- Is assignment too broad?
- Is "All" selected?
- Check position permission

## Tips

> 💡 Verify with test user.

> 💡 Document changes.

> ⚠️ Wrong assignment can cause data leak.
`
  },
  {
    id: 'admin-bolge-ekleme',
    slug: 'bolge-ekleme',
    title: 'Add Region',
    excerpt: 'Define regions in master data.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['region', 'master data', 'definition'],
    images: [],
    relatedArticles: ['admin-magaza-ekleme', 'admin-rls-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 6,
    content: `
# Add Region

Define your organization's region structure.

## Region Page

1. Go to **Admin** > **Master Data** > **Regions**
2. View existing regions

## Add New Region

1. Click **+ New Region** button
2. Fill in information:

| Field | Description | Example |
|-------|-------------|---------|
| Region Code | Unique code | MAR |
| Region Name | Display name | Marmara |
| Parent Region | Hierarchy | Turkey |

3. Click **Save**

## Region Hierarchy

\`\`\`
Turkey
├── Marmara
│   ├── Istanbul Europe
│   └── Istanbul Asia
├── Aegean
│   └── Izmir
└── Central Anatolia
    └── Ankara
\`\`\`

## Edit Region

1. Click **Edit** icon on region row
2. Update information
3. Save

## Delete Region

> ⚠️ Before deleting region:
> - Move stores underneath
> - Update RLS assignments

## Bulk Import

Add regions in bulk from CSV file:
1. Click **Import** button
2. Select CSV file
3. Map columns
4. Import

## Tips

> 💡 Use consistent coding (3 letters).

> 💡 Keep hierarchy simple.

> 💡 Plan changes ahead.
`
  },
  {
    id: 'admin-magaza-ekleme',
    slug: 'magaza-ekleme',
    title: 'Add Store',
    excerpt: 'Define stores in master data.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['store', 'master data', 'definition'],
    images: [],
    relatedArticles: ['admin-bolge-ekleme', 'admin-rls-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 7,
    content: `
# Add Store

Define your organization's store/branch structure.

## Store Page

1. Go to **Admin** > **Master Data** > **Stores**
2. View existing stores

## Add New Store

1. Click **+ New Store** button
2. Fill in information:

| Field | Description | Example |
|-------|-------------|---------|
| Store Code | Unique code | S001 |
| Store Name | Display name | Downtown |
| Region | Parent region | Istanbul Asia |
| Open Date | For LFL | 2020-01-15 |
| Status | Active/Inactive | Active |

3. Click **Save**

## Store Information

### Required Fields
- Store Code
- Store Name
- Region

### Optional Fields
- Address
- Phone
- Open date
- Close date
- Square meters
- Employee count

## Dates for LFL

For Like-for-Like comparison:
- **Open Date**: Date store opened
- **Close Date**: If closed (NULL = active)

## Store Status

| Status | Description |
|--------|-------------|
| Active | Normal operation |
| Inactive | Temporarily closed |
| Closed | Permanently closed |

## Bulk Import

Import stores from dataset:
1. Click **Import from Dataset** button
2. Select dataset
3. Map columns
4. Import

## Tips

> 💡 Keep store codes consistent.

> 💡 Enter open dates correctly (critical for LFL).

> 💡 Mark closed stores as "Closed", don't delete.
`
  },
  {
    id: 'admin-sistem-ayarlari',
    slug: 'sistem-ayarlari',
    title: 'System Settings',
    excerpt: 'Configure general system settings.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['system', 'settings', 'configuration', 'security'],
    images: [],
    relatedArticles: ['admin-yonetim-paneli-nedir', 'advanced-2fa-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 8,
    content: `
# System Settings

Configure Clixer's general system settings.

## Settings Page

Go to **Admin** > **System Settings**.

## General Settings

### Application Name
Name shown on dashboards.

### Logo
Upload custom logo (PNG, max 500KB).

### Theme
- Dark theme (default)
- Light theme

### Language
- Turkish
- English

## Security Settings

### 2FA Requirement
Make 2FA mandatory for all users.

### Session Duration
Auto logout time (minutes).

### Password Policy
- Minimum length
- Upper/lowercase
- Number requirement
- Special character

### IP Whitelist
Access only from specific IPs.

## Email Settings

SMTP settings for report subscriptions:

| Field | Description |
|-------|-------------|
| SMTP Host | Mail server |
| Port | 587 or 465 |
| Username | SMTP user |
| Password | SMTP password |
| Sender | noreply@company.com |

## Cache Settings

### Cache TTL
Data cache duration (seconds).

### Clear Cache
Manual cache clear button.

## Tips

> 💡 Make 2FA mandatory in production.

> 💡 Keep session duration reasonable (30-60 min).

> ⚠️ Setting changes affect all users.
`
  },
  {
    id: 'admin-rapor-kategorileri',
    slug: 'rapor-kategorileri',
    title: 'Report Categories',
    excerpt: 'Report categories for separation of powers.',
    category: 'admin',
    categoryLabel: 'Admin Panel',
    tags: ['report', 'category', 'permission', 'separation'],
    images: [],
    relatedArticles: ['designer-rapor-yetkileri', 'admin-pozisyon-yetkileri'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 9,
    content: `
# Report Categories

Define report categories for separation of powers.

## What is Report Category?

Report categories group dashboards and control access. Adds an extra security layer on top of position permissions.

## Why Use?

- Department-based access
- Protection of confidential reports
- Regulatory compliance

## Create Category

1. Go to **Admin** > **Report Categories**
2. Click **+ New Category**
3. Enter information:

| Field | Example |
|-------|---------|
| Category Name | Financial Reports |
| Description | Finance team only |
| Color | Red |

4. Save

## Assign Report to Category

When creating design in Designer:
1. Select from **Report Category** dropdown
2. Save

## Assign Category to User

1. Edit user
2. Open **Report Categories** section
3. Select categories they can access

## Example Scenario

| Category | Can Access |
|----------|------------|
| General Reports | All users |
| Financial | Finance team |
| HR Reports | HR team |
| Executive | Top management only |

## Category + Position

Two-layer permission control:

1. **Position permission**: Can they see the report?
2. **Category permission**: Do they have access to this category?

Both conditions must be met.

## Tips

> 💡 Too many categories creates complexity.

> 💡 Define a default category.

> 💡 Announce category changes.
`
  }
]
