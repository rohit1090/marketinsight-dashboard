import React from 'react';
import { GradeBadge, RankBadge } from '../shared/SocialBadges';
import { YouTubeChannelData } from '../../../../services/socialBladeService';

interface Props {
  data: YouTubeChannelData;
}

function formatRankLabel(key: string): string {
  const map: Record<string, string> = {
    sbRank:       'SB Rank',
    subsRank:     'Subscribers Rank',
    viewsRank:    'Views Rank',
    countryRank:  'Country Rank',
    categoryRank: 'Category Rank',
  };
  return map[key] ?? key;
}

export default function ChannelOverviewCard({ data }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">

      {/* Banner */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 60%, #6D28D9 100%)' }}
      >
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {data.avatar ? (
            <img
              src={data.avatar}
              alt={data.displayName}
              className="w-14 h-14 rounded-full border-2 border-white/40 shadow-lg flex-shrink-0"
              onError={e => {
                const el = e.currentTarget;
                el.style.display = 'none';
                (el.nextSibling as HTMLElement)?.style.setProperty('display', 'flex');
              }}
            />
          ) : null}
          <div
            className="w-14 h-14 rounded-full border-2 border-white/40 shadow-lg flex-shrink-0 bg-white/20 items-center justify-center text-white text-xl font-black"
            style={{ display: data.avatar ? 'none' : 'flex' }}
          >
            {data.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-black text-lg leading-tight truncate">
                {data.displayName}
              </span>
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                ✓ Verified
              </span>
            </div>
            <p className="text-indigo-200 text-sm font-medium truncate">
              {data.handle.startsWith('@') ? data.handle : `@${data.handle}`}
            </p>
            <p className="text-indigo-200 text-xs mt-0.5">
              Member since {data.createdAt}
            </p>
          </div>
        </div>

        {/* Right */}
        <a
          href={`https://www.youtube.com/${data.handle.startsWith('@') ? data.handle : `@${data.handle}`}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 ml-3 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/30 transition-colors cursor-pointer whitespace-nowrap"
        >
          View on YouTube →
        </a>
      </div>

      {/* Ranks row */}
      <div className="bg-gray-50 border-t border-gray-100 px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <GradeBadge grade={data.grade} color={data.gradeColor} />
          {Object.entries(data.ranks).map(([k, v]) => (
            <RankBadge key={k} value={v} label={formatRankLabel(k)} />
          ))}
        </div>
      </div>

    </div>
  );
}
