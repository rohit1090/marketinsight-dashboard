
import { DashboardData } from './types';

export const MOCK_DASHBOARD_DATA: DashboardData = {
  metrics: [
    { label: 'Total Ad Spend', value: 45280, change: 12.5, trend: 'up', format: 'currency' },
    { label: 'Total Conversions', value: 1240, change: 8.2, trend: 'up', format: 'number' },
    { label: 'Avg. ROAS', value: 4.2, change: -2.1, trend: 'down', format: 'number' },
    { label: 'Cost Per Acquisition', value: 36.5, change: -5.4, trend: 'up', format: 'currency' },
  ],
  channelPerformance: [
    { channel: 'Facebook Ads', spend: 15400, impressions: 850000, clicks: 12500, conversions: 420, roas: 3.8 },
    { channel: 'Google Search', spend: 18200, impressions: 420000, clicks: 28400, conversions: 580, roas: 5.2 },
    { channel: 'Instagram Ads', spend: 8200, impressions: 1200000, clicks: 8400, conversions: 180, roas: 2.9 },
    { channel: 'LinkedIn Ads', spend: 3480, impressions: 45000, clicks: 1200, conversions: 60, roas: 4.5 },
  ],
  competitors: [
    { name: 'My Brand', marketShare: 24, adSpend: 45000, engagementRate: 4.2, sentiment: 82 },
    { name: 'Rival A', marketShare: 31, adSpend: 62000, engagementRate: 3.8, sentiment: 75 },
    { name: 'MarketLeader B', marketShare: 35, adSpend: 85000, engagementRate: 4.5, sentiment: 88 },
    { name: 'Startup C', marketShare: 10, adSpend: 12000, engagementRate: 5.1, sentiment: 91 },
  ],
  historicalData: [
    { date: '2024-01-01', spend: 42000, conversions: 1100 },
    { date: '2024-02-01', spend: 38000, conversions: 950 },
    { date: '2024-03-01', spend: 45000, conversions: 1240 },
    { date: '2024-04-01', spend: 41000, conversions: 1150 },
    { date: '2024-05-01', spend: 48000, conversions: 1320 },
    { date: '2024-06-01', spend: 52000, conversions: 1450 },
  ]
};

export const CHANNELS = ['All Channels', 'Facebook', 'Instagram', 'Google Ads', 'LinkedIn', 'TikTok'];
