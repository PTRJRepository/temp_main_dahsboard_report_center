/**
 * lib/reports/config.ts
 * Central module registry for PT Rebinmas Report Center.
 * Used by module pages and navigation components.
 */

import { liveInventoryReports } from '@/lib/reports/inventory/config';

export type ModuleStatus = 'active' | 'coming_soon' | 'locked';
export type ModuleIcon =
  | 'Package'
  | 'Wallet'
  | 'Users'
  | 'BarChart3';

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  reportCount: number;
  route: string;
  status: ModuleStatus;
  lastUpdated: string;
  color: string;
  icon: ModuleIcon;
}

/** Lookup map for O(1) access by module id */
export const MODULE_CONFIGS: ModuleConfig[] = [
  {
    id: 'procurement',
    name: 'Procurement',
    description: 'Live Inventory reports grouped under one procurement workspace.',
    reportCount: liveInventoryReports.length,
    route: '/report-center?module=procurement#modules',
    status: 'active',
    lastUpdated: 'Today 09:00',
    color: '#167A3A',
    icon: 'Package',
  },
  {
    id: 'financial',
    name: 'Financial',
    description: 'Productivity, cost efficiency, and financial performance reporting.',
    reportCount: 16,
    route: '/report-center?module=financial#modules',
    status: 'active',
    lastUpdated: 'Today 08:00',
    color: '#2563EB',
    icon: 'Wallet',
  },
  {
    id: 'human-resources',
    name: 'Human Resources',
    description: 'Payroll, wage register, attendance, premium, overtime, wages comparison, and impact reports.',
    reportCount: 94,
    route: '/report-center?module=human-resources#modules',
    status: 'active',
    lastUpdated: 'Today 08:00',
    color: '#DB2777',
    icon: 'Users',
  },
  {
    id: 'budget',
    name: 'Budget',
    description: 'Budget planning, budget realization, and variance analysis reports.',
    reportCount: 12,
    route: '/report-center?module=budget#modules',
    status: 'active',
    lastUpdated: 'Today 08:00',
    color: '#D99A00',
    icon: 'BarChart3',
  },
];

/** All valid module IDs for generateStaticParams */
export const MODULE_IDS = MODULE_CONFIGS.map((m) => m.id);

/** Lookup helper */
export const getModuleConfig = (id: string): ModuleConfig | undefined =>
  MODULE_CONFIGS.find((m) => m.id === id);
