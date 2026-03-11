import React from 'react';
import { StatCard } from '../shared/SocialBadges';
import { YouTubeChannelData, formatNumber, formatEarnings } from '../../../../services/socialBladeService';

interface Props {
  data: YouTubeChannelData;
}

export default function CreatorStatsGrid({ data }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        icon="👥"
        label="SUBSCRIBERS (30 DAYS)"
        value={`+${formatNumber(data.subsGrowth.d30)}`}
        sub={`of ${formatNumber(data.totalSubscribers)} total`}
        color="green"
      />
      <StatCard
        icon="👁"
        label="VIEWS (30 DAYS)"
        value={`+${formatNumber(data.viewsGrowth.d30)}`}
        sub={`of ${formatNumber(data.totalViews)} total`}
        color="blue"
      />
      <StatCard
        icon="💰"
        label="MONTHLY EST. EARNINGS"
        value={formatEarnings(data.monthlyEarningsMin, data.monthlyEarningsMax)}
        sub="Based on 30-day views"
        color="amber"
      />
      <StatCard
        icon="📈"
        label="YEARLY EST. EARNINGS"
        value={formatEarnings(data.yearlyEarningsMin, data.yearlyEarningsMax)}
        sub="Projected annual"
        color="purple"
      />
    </div>
  );
}
