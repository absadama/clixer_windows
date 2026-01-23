/**
 * Core Service Type Definitions
 */

import { Request } from 'express';

// Extended Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tenantId: string;
    role: string;
    positionCode?: string;
    filterLevel?: string;
    filterValue?: string;
    canSeeAllCategories?: boolean;
    categoryIds?: number[];
  };
}

// Position
export interface Position {
  code: string;
  name: string;
  hierarchy_level: number;
  can_see_all_stores: boolean;
  description?: string;
  filter_level?: string;
}

// User
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  position_code?: string;
  tenant_id: string;
  is_active: boolean;
  created_at: Date;
  filter_value?: string;
  can_see_all_categories?: boolean;
}

// Store
export interface Store {
  store_id: string;
  store_name: string;
  region_id?: number;
  city_code?: string;
  district_name?: string;
  ownership_group_id?: number;
  is_active: boolean;
}

// Region
export interface Region {
  id: number;
  name: string;
  description?: string;
  tenant_id: string;
}

// Ownership Group
export interface OwnershipGroup {
  id: number;
  name: string;
  description?: string;
  tenant_id: string;
}

// Report Category
export interface ReportCategory {
  id: number;
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  tenant_id: string;
}

// Store Finance Settings
export interface StoreFinanceSettings {
  store_id: string;
  store_name: string;
  fixed_rent?: number;
  revenue_share_percent?: number;
  common_area_cost?: number;
  target_cogs_percent?: number;
  royalty_percent?: number;
  marketing_percent?: number;
  electricity_budget?: number;
  water_budget?: number;
  manager_count?: number;
  manager_salary?: number;
  kitchen_count?: number;
  kitchen_salary?: number;
  service_count?: number;
  service_salary?: number;
  courier_count?: number;
  courier_salary?: number;
  initial_investment?: number;
  opening_date?: Date;
}

// Design
export interface Design {
  id: number;
  name: string;
  description?: string;
  tenant_id: string;
  created_by: string;
  is_public: boolean;
}

// Settings
export interface Setting {
  key: string;
  value: string;
  description?: string;
  tenant_id: string;
}

// Label
export interface Label {
  id: number;
  type: string;
  key: string;
  label: string;
  tenant_id: string;
}

// LDAP Config
export interface LdapConfig {
  id: number;
  tenant_id: string;
  server_url: string;
  bind_dn: string;
  search_base: string;
  is_active: boolean;
}

// Geographic
export interface City {
  code: string;
  name: string;
}

export interface District {
  name: string;
  city_code: string;
}
