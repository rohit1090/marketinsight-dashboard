
export interface MarketingMetric {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  format: 'currency' | 'number' | 'percentage';
}

export interface ChannelPerformance {
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
}

export interface CompetitorData {
  name: string;
  marketShare: number;
  adSpend: number;
  engagementRate: number;
  sentiment: number;
}

export interface LiveMarketReport {
  summary: string;
  sources: { uri: string; title: string }[];
}

export interface MarketingTask {
  id: string;
  title: string;
  status: 'ideation' | 'progress' | 'review' | 'done';
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  campaign: string;
}

export interface ApiConnection {
  id: string;
  channel: string;
  apiKey: string;
  accountId: string;
  status: 'connected' | 'disconnected';
  lastSynced?: string;
}

export interface CompetitorProfile {
  id: string;
  name: string;
  domain: string;
  trackingApis: string[];
}

export interface DashboardData {
  metrics: MarketingMetric[];
  channelPerformance: ChannelPerformance[];
  competitors: CompetitorData[];
  historicalData: any[];
}

// Fix: Added missing AgentLog interface for AgentHubPanel
export interface AgentLog {
  id: string;
  timestamp: string;
  type: 'analysis' | 'success' | 'alert' | 'action';
  message: string;
}

// Fix: Added missing AgentIntervention interface for AgentHubPanel
export interface AgentIntervention {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  channel: string;
  status: 'pending' | 'executing' | 'completed';
}

export enum ViewMode {
  OVERVIEW = 'overview',
  SEO_SUITE = 'seo_suite',
  SOCIAL_HUB = 'social_hub',
  WORKFLOWS = 'workflows',
  COMPETITORS = 'competitors',
  MARKET_INTEL = 'market_intel',
  AI_STRATEGY = 'ai_strategy',
  SETTINGS = 'settings'
}

export type DateRangePreset = 'Last 7 Days' | 'Last 30 Days' | 'This Quarter' | 'Last Year' | 'Custom';

export interface DateRange {
  startDate: string;
  endDate: string;
  preset: DateRangePreset;
}
