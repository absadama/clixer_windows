import type { Article } from '../../../types/article'

export const articlesEn: Article[] = [
  {
    id: 'advanced-performans-ipuclari',
    slug: 'performans-ipuclari',
    title: 'Performance Tips',
    excerpt: 'Optimize dashboard and query performance.',
    category: 'advanced',
    categoryLabel: 'Advanced',
    tags: ['performance', 'optimization', 'speed', 'cache'],
    images: [],
    relatedArticles: ['advanced-cache-yonetimi', 'data-clickhouse-yonetimi'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 1,
    content: `
# Performance Tips

Tips for optimizing dashboard and query performance.

## Dashboard Performance

### Widget Count
- Maximum 15-20 widgets recommended
- Too many widgets increase load time

### Date Range
- Narrow date ranges are faster
- Avoid ranges longer than 1 year

### Complex Metrics
- Minimize UNION and JOIN queries
- Use pre-calculated data

## Query Performance

### Partition Usage
\`\`\`sql
-- GOOD: Partition column in WHERE
WHERE date BETWEEN '2025-01-01' AND '2025-01-31'

-- BAD: No partition column
WHERE store_id = 'S001'
\`\`\`

### LIMIT Usage
\`\`\`sql
-- GOOD: Limited results
SELECT * FROM sales LIMIT 1000

-- BAD: All data
SELECT * FROM sales
\`\`\`

### Unnecessary Columns
\`\`\`sql
-- GOOD: Only needed columns
SELECT date, SUM(amount) FROM sales

-- BAD: All columns
SELECT * FROM sales
\`\`\`

## ETL Performance

### Incremental ETL
- Use incremental instead of full sync
- Transfer only changed data

### Scheduling
- Run during off-peak hours
- Avoid parallel ETL

## Cache Usage

### Cache TTL
- Frequently changing data: Short TTL (5-15 min)
- Rarely changing data: Long TTL (1-24 hours)

### Cache Clearing
- Auto clear after ETL
- Manual clear when needed

## Monitoring

### Slow Queries
- Monitor query times
- Optimize queries over 5 seconds

### Resource Usage
- Track CPU and memory usage
- Monitor disk I/O

## Checklist

- [ ] Widget count < 20
- [ ] Reasonable date range
- [ ] Partition column used
- [ ] LIMIT present
- [ ] Cache active
- [ ] Incremental ETL
`
  },
  {
    id: 'advanced-cache-yonetimi',
    slug: 'cache-yonetimi',
    title: 'Cache Management',
    excerpt: 'Redis cache configuration and management.',
    category: 'advanced',
    categoryLabel: 'Advanced',
    tags: ['cache', 'redis', 'performance', 'ttl'],
    images: [],
    relatedArticles: ['advanced-performans-ipuclari', 'admin-sistem-ayarlari'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 2,
    content: `
# Cache Management

Clixer uses Redis cache for performance.

## What is Cache?

Cache keeps frequently used data in memory to reduce query time.

## Cache Flow

\`\`\`
Request → Cache Check → In cache?
                            ↓
                    Yes: Return from cache
                    No: Fetch from DB → Write to cache → Return
\`\`\`

## Cache TTL (Time To Live)

Duration data stays in cache:

| Data Type | Recommended TTL |
|-----------|-----------------|
| Dashboard data | 5-15 minutes |
| Metric result | 5-30 minutes |
| Master data | 1-24 hours |
| User session | 30-60 minutes |

## Cache Settings

**Admin** > **System Settings** > **Cache**:

- **Default TTL**: General cache duration
- **Metric TTL**: For metric results
- **Dashboard TTL**: For dashboard data

## Manual Cache Clear

1. Go to **System Settings** > **Cache**
2. Click **Clear Cache** button
3. Select type to clear:
   - All cache
   - Metric cache
   - Dashboard cache

## Automatic Clearing

Cache is automatically cleared:
- When ETL completes
- When metric is updated
- When TTL expires

## Cache Issues

### Old Data Showing
- Clear cache
- Shorten TTL

### Low Performance
- Check if cache is active
- Check Redis connection

## Tips

> 💡 Use short TTL for critical dashboards.

> 💡 Automate cache clearing after ETL.

> ⚠️ Too short TTL reduces performance.
`
  },
  {
    id: 'advanced-2fa-kurulumu',
    slug: '2fa-kurulumu',
    title: '2FA Setup',
    excerpt: 'Two-factor authentication configuration.',
    category: 'advanced',
    categoryLabel: 'Advanced',
    tags: ['2fa', 'security', 'authenticator', 'verification'],
    images: [],
    relatedArticles: ['admin-sistem-ayarlari', 'admin-kullanici-yonetimi'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 3,
    content: `
# 2FA Setup

Increase security with two-factor authentication (2FA).

## What is 2FA?

2FA requires a second verification factor in addition to password:
1. Something you know (password)
2. Something you have (phone)

## Supported Apps

- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password

## System-wide 2FA

As admin, make 2FA mandatory for all users:

1. Go to **Admin** > **System Settings**
2. Open **Security** section
3. Turn on **2FA Required** toggle
4. Save

## User 2FA Setup

### Initial Setup
1. User logs in
2. QR code screen is shown
3. Scan with Authenticator app
4. Enter 6-digit code
5. Save backup codes

### Backup Codes
- 10 single-use codes
- Use if phone is lost
- Store in safe place

## 2FA Reset

If user lost their phone:

1. As admin, go to **Users**
2. Click 🔑 icon on user row
3. Confirm
4. User can do new setup

## Remember Device

"Remember this device" option:
- Skip 2FA for 30 days
- Only use on trusted devices
- Invalidated if IP or browser changes

## Security Recommendations

> 💡 Make 2FA mandatory in production.

> 💡 Store backup codes safely.

> ⚠️ Don't use "remember device" on public devices.

> ⚠️ Limit 2FA reset permissions.
`
  },
  {
    id: 'advanced-rapor-abonelikleri',
    slug: 'rapor-abonelikleri',
    title: 'Report Subscriptions',
    excerpt: 'Automatic email report delivery.',
    category: 'advanced',
    categoryLabel: 'Advanced',
    tags: ['report', 'subscription', 'email', 'schedule'],
    images: [],
    relatedArticles: ['admin-sistem-ayarlari', 'designer-tasarim-kaydetme'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 4,
    content: `
# Report Subscriptions

Automatically send dashboards via email.

## What is Subscription?

Report subscription sends dashboard screenshots via email at specified intervals.

## Prerequisites

1. SMTP settings configured
2. Dashboard created
3. Recipient emails defined

## SMTP Settings

**Admin** > **System Settings** > **Email**:

| Field | Example |
|-------|---------|
| SMTP Host | smtp.gmail.com |
| Port | 587 |
| Username | reports@company.com |
| Password | ******** |
| Sender | noreply@company.com |

## Create Subscription

1. Open dashboard
2. Click **Subscription** button
3. Fill in information:

| Field | Description |
|-------|-------------|
| Subscription Name | "Daily Sales Report" |
| Recipients | Email addresses |
| Schedule | Daily, Weekly, Monthly |
| Time | 08:00 |

4. Click **Save**

## Schedule Options

| Schedule | Description |
|----------|-------------|
| Daily | Every day at specific time |
| Weekly | Specific day of week |
| Monthly | Specific day of month |
| Custom | Cron expression |

## Recipient Types

### System Users
Select Clixer users.

### External Emails
Add email addresses outside the system.

## Subscription Management

**Admin** > **Report Subscriptions**:
- View active subscriptions
- Edit or delete
- Review delivery logs

## Troubleshooting

### Email Not Sending
- Check SMTP settings
- Check spam folder
- Review delivery logs

### Image Corrupted
- Ensure dashboard loads properly
- Check widgets show data

## Tips

> 💡 Prefer early morning hours.

> 💡 Too many recipients can affect performance.

> ⚠️ Don't send sensitive data to external emails.
`
  },
  {
    id: 'advanced-white-label',
    slug: 'white-label',
    title: 'White Label (Branding)',
    excerpt: 'Logo and theme customization.',
    category: 'advanced',
    categoryLabel: 'Advanced',
    tags: ['white label', 'logo', 'theme', 'branding'],
    images: [],
    relatedArticles: ['admin-sistem-ayarlari'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 5,
    content: `
# White Label (Branding)

Customize Clixer with your own brand.

## Change Logo

1. Go to **Admin** > **System Settings**
2. Open **Appearance** section
3. Click **Upload Logo** button
4. Select logo file

### Logo Requirements
- Format: PNG (transparent background recommended)
- Size: Maximum 500KB
- Resolution: 200x50 pixels recommended

## Application Name

Change the name shown in title:
1. Enter in **Application Name** field
2. Save

## Theme Colors

### Primary Color
For buttons, links and highlights.

### Background
Dashboard background color.

### Card Color
Widget card color.

## Favicon

Icon shown in browser tab:
1. Click **Upload Favicon** button
2. Select ICO or PNG file
3. Save

## PWA Icon

Mobile home screen icon:
1. Click **Upload PWA Icon** button
2. Select 512x512 PNG file
3. Save

## Customization Preview

Preview changes before saving:
1. Click **Preview** button
2. Check new appearance
3. Save if satisfied

## Tips

> 💡 Use light-colored logo for dark theme.

> 💡 Use consistent brand colors.

> 💡 Use high-resolution images.
`
  },
  {
    id: 'advanced-mobil-kullanim',
    slug: 'mobil-kullanim',
    title: 'Mobile Usage (PWA)',
    excerpt: 'Use Clixer on mobile devices.',
    category: 'advanced',
    categoryLabel: 'Advanced',
    tags: ['mobile', 'pwa', 'phone', 'tablet'],
    images: [],
    relatedArticles: ['getting-started-ilk-giris'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 6,
    content: `
# Mobile Usage (PWA)

Clixer can be used on mobile devices as a Progressive Web App (PWA).

## What is PWA?

PWA lets you use a web application like a mobile app:
- Can be added to home screen
- Can work offline
- Can receive notifications

## Add to Home Screen

### iOS (Safari)
1. Open Clixer in Safari
2. Tap **Share** icon
3. Select **Add to Home Screen**
4. Confirm **Add**

### Android (Chrome)
1. Open Clixer in Chrome
2. Tap **Menu** (⋮) icon
3. Select **Add to home screen**
4. Confirm **Add**

## Mobile Interface

Interface automatically adapts on mobile devices:
- Sidebar hidden (hamburger menu)
- Widgets single column
- Touch optimized

## Mobile Features

### Dashboard Viewing
- Swipe between widgets
- Pinch-to-zoom
- Portrait/landscape mode support

### Filters
- Mobile-friendly date picker
- Touch-friendly dropdowns

### Charts
- Touch for details
- Swipe to change time range

## Performance Tips

> 💡 WiFi connection recommended.

> 💡 Too many widgets slow down mobile.

> 💡 Simple dashboards are ideal for mobile.

## Limitations

Some features are limited on mobile:
- Designer cannot be used
- Data management limited
- File upload restricted

## Troubleshooting

### App Not Opening
- Clear browser cache
- Remove and re-add app

### Slow Loading
- Check internet connection
- Use dashboard with fewer widgets
`
  },
  {
    id: 'advanced-sorun-giderme',
    slug: 'sorun-giderme',
    title: 'Troubleshooting',
    excerpt: 'Common issues and solutions.',
    category: 'advanced',
    categoryLabel: 'Advanced',
    tags: ['issue', 'error', 'solution', 'debug'],
    images: [],
    relatedArticles: ['getting-started-sss', 'advanced-performans-ipuclari'],
    lastUpdated: '2026-01-27',
    readingTime: 8,
    order: 7,
    content: `
# Troubleshooting

Common issues and solutions.

## Login Issues

### "Wrong password" error
- Is Caps Lock off?
- Correct email?
- Try password reset

### 2FA code not working
- Is phone time correct?
- Correct account?
- Request 2FA reset from admin

### Account locked
- Contact admin
- Check if account is active

## Dashboard Issues

### Widget not loading
1. Refresh page (F5)
2. Clear browser cache
3. Try different browser

### Data not showing
1. Check date range
2. Check filters
3. Check RLS assignment

### Wrong data showing
1. Check metric definition
2. Check dataset
3. Check ETL status

## Performance Issues

### Dashboard slow
1. Reduce widget count
2. Narrow date range
3. Check cache

### Query timeout
1. Optimize query
2. Use partition
3. Add LIMIT

## ETL Issues

### ETL failed
1. Test connection
2. Check source database
3. Review error logs

### Data missing
1. Check date range
2. Is there data in source?
3. Check filter conditions

## Browser Issues

### Page not displaying properly
- Use supported browser
- Update browser
- Clear cache

### JavaScript error
- Check browser console
- Disable extensions
- Try incognito mode

## Getting Support

If your issue isn't resolved:
1. Note the error message
2. Take screenshot
3. Contact system administrator
4. Write to support@clixer.io

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Unauthorized | Login again |
| 403 | Access denied | Check permissions |
| 404 | Not found | Check URL |
| 500 | Server error | Report to admin |
| 503 | Service unavailable | Wait and retry |
`
  },
  {
    id: 'advanced-ldap-entegrasyonu',
    slug: 'ldap-entegrasyonu',
    title: 'LDAP Integration',
    excerpt: 'Enterprise login with Active Directory.',
    category: 'advanced',
    categoryLabel: 'Advanced',
    tags: ['ldap', 'active directory', 'sso', 'enterprise'],
    images: [],
    relatedArticles: ['admin-kullanici-yonetimi', 'advanced-2fa-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 8,
    content: `
# LDAP Integration

Enterprise authentication with Active Directory.

## What is LDAP?

LDAP (Lightweight Directory Access Protocol) is used for enterprise user management. Provides integration with Active Directory.

## Benefits

- Centralized user management
- Single password (SSO-like)
- Automatic user synchronization
- Group-based authorization

## LDAP Configuration

**Admin** > **System Settings** > **LDAP**:

| Field | Example |
|-------|---------|
| LDAP URL | ldap://dc.company.local:389 |
| Base DN | DC=company,DC=local |
| Bind DN | CN=clixer,OU=Services,DC=company,DC=local |
| Bind Password | ******** |
| User Filter | (sAMAccountName={username}) |

## Connection Test

1. Enter settings
2. Click **Test** button
3. Wait for "Connection successful" message

## User Mapping

Map LDAP fields to Clixer fields:

| LDAP Field | Clixer Field |
|------------|--------------|
| sAMAccountName | username |
| mail | email |
| givenName | firstName |
| sn | lastName |
| memberOf | groups |

## Group Mapping

Map LDAP groups to Clixer positions:

| LDAP Group | Clixer Position |
|------------|-----------------|
| CN=Managers | General Manager |
| CN=Analysts | Analyst |
| CN=Viewers | Viewer |

## Auto Synchronization

Automatically sync LDAP users:
- New users created automatically
- Deleted users deactivated
- Group changes reflected

## Security Notes

> ⚠️ LDAP user can only login via LDAP.

> ⚠️ LDAPS (SSL) is recommended.

> 💡 Give minimum permissions to service account.

## Troubleshooting

### Connection error
- Check firewall rules
- Verify LDAP URL
- Check bind credentials

### User not found
- Check user filter
- Check base DN
- Verify user exists in AD
`
  }
]
