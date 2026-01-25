/**
 * Core Service Routes Index
 * Aggregates all route modules
 */

import { Router } from 'express';

// Import all routes
import healthRoutes from './health.routes';
import positionsRoutes from './positions.routes';
import regionsRoutes from './regions.routes';
import ownershipGroupsRoutes from './ownership-groups.routes';
import storesRoutes from './stores.routes';
import usersRoutes from './users.routes';
import userStoresRoutes from './user-stores.routes';
import userCategoriesRoutes from './user-categories.routes';
import reportCategoriesRoutes from './report-categories.routes';
import storeFinanceRoutes from './store-finance.routes';
import settingsRoutes from './settings.routes';
import tenantsRoutes from './tenants.routes';
import designsRoutes from './designs.routes';
import componentsRoutes from './components.routes';
import labelsRoutes from './labels.routes';
import geographicRoutes from './geographic.routes';
import adminRoutes from './admin.routes';
import ldapRoutes from './ldap.routes';
import importRoutes from './import.routes';
import gridDesignsRoutes from './grid-designs.routes';
import whitelabelRoutes from './whitelabel.routes';
import searchRoutes from './search.routes';
import navigationRoutes from './navigation.routes';

const router = Router();

// Health check - no prefix
router.use('/health', healthRoutes);

// Core entity routes
router.use('/positions', positionsRoutes);
router.use('/regions', regionsRoutes);
router.use('/ownership-groups', ownershipGroupsRoutes);
router.use('/stores', storesRoutes);
router.use('/users', usersRoutes);
router.use('/users', userStoresRoutes);        // /users/:id/stores
router.use('/users', userCategoriesRoutes);    // /users/:id/categories
router.use('/report-categories', reportCategoriesRoutes);
router.use('/store-finance', storeFinanceRoutes);

// System routes
router.use('/settings', settingsRoutes);
router.use('/tenants', tenantsRoutes);
router.use('/designs', designsRoutes);
router.use('/components', componentsRoutes);
router.use('/labels', labelsRoutes);
router.use('/geographic', geographicRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// LDAP integration
router.use('/ldap', ldapRoutes);

// Import routes (Excel/Dataset)
router.use('/', importRoutes);  // /stores/import, /regions/import

// Grid designs (DataGrid state persistence)
router.use('/grid-designs', gridDesignsRoutes);

// WhiteLabel routes (logo upload, manifest.json)
router.use('/', whitelabelRoutes);  // /upload/logo, /logo-info, /manifest.json

// Unified Search
router.use('/search', searchRoutes);

// Dynamic Navigation (for search index)
router.use('/navigation', navigationRoutes);

export default router;
