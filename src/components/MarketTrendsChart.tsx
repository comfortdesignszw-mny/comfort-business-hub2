import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { TrendingUp, Activity, Sparkles, Filter, ShieldAlert, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../constants';
import { formatCurrency } from '../lib/utils';

// Historical market trends mock dataset generated dynamically per sector
const generateTrendData = (category: string) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  let basePrice = 120;
  let baseDemand = 60;

  if (category === 'Electronics & Gadgets' || category === 'Electronics') {
    basePrice = 280;
    baseDemand = 85;
  } else if (category === 'Building & Construction Materials' || category === 'Hardware') {
    basePrice = 450;
    baseDemand = 70;
  } else if (category === 'Solar & Renewable Energy' || category === 'Energy') {
    basePrice = 620;
    baseDemand = 95;
  } else if (category === 'FMCG & Groceries') {
    basePrice = 45;
    baseDemand = 90;
  }

  return months.map((month, idx) => {
    // Cyclic variance with seasonal spike
    const seasonalFactor = Math.sin((idx / 12) * Math.PI * 2) * 25;
    const priceFactor = Math.cos((idx / 12) * Math.PI * 2) * 15;
    const randomNoise = (Math.sin(idx * 3) + 1) * 8;

    const price = Math.round(basePrice + priceFactor + randomNoise);
    const demandIndex = Math.min(100, Math.max(20, Math.round(baseDemand + seasonalFactor + randomNoise / 2)));
    const marginPercent = Math.round(18 + (demandIndex / 100) * 14);

    return {
      month,
      avgPrice: price,
      demandIndex,
      marginPercent,
      supplyVolume: Math.round(demandIndex * 12.5)
    };
  });
};

export default function MarketTrendsChart({ userCategory = 'Electronics & Gadgets' }: { userCategory?: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string>(userCategory || 'Electronics & Gadgets');
  const [viewMode, setViewMode] = useState<'price_demand' | 'margins_supply'>('price_demand');

  const trendData = generateTrendData(selectedCategory);

  // Calculate high/low summaries
  const currentPrice = trendData[trendData.length - 1].avgPrice;
  const prevPrice = trendData[trendData.length - 2].avgPrice;
  const priceChange = Math.round(((currentPrice - prevPrice) / prevPrice) * 100);

  const currentDemand = trendData[trendData.length - 1].demandIndex;
  const avgMargin = Math.round(trendData.reduce((acc, curr) => acc + curr.marginPercent, 0) / trendData.length);

  return (
    <div className="neon-card p-5 sm:p-6 space-y-6 border-primary/30 bg-[#0d1117]/90 backdrop-blur-xl relative overflow-hidden rounded-3xl shadow-[0_0_50px_rgba(0,242,254,0.08)]">
      {/* Background glow element */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <TrendingUp size={18} />
            </div>
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary block">
                Regional Market Matrix
              </span>
              <h3 className="text-lg font-black italic uppercase tracking-tight text-white flex items-center gap-2">
                Supply Node Market Trends
              </h3>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Selector */}
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl">
            <Filter size={12} className="text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-[#0d1117] text-white">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center bg-black/60 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('price_demand')}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'price_demand'
                  ? 'bg-primary text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Price vs Demand
            </button>
            <button
              onClick={() => setViewMode('margins_supply')}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'margins_supply'
                  ? 'bg-primary text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Margins & Volume
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-black/40 border border-white/5 p-3 rounded-2xl space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Avg Benchmark Price</span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black text-white italic">{formatCurrency(currentPrice, 'USD')}</span>
            <span className={`text-[10px] font-bold flex items-center ${priceChange >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
              {priceChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(priceChange)}%
            </span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 p-3 rounded-2xl space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Demand Cycle Score</span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black text-primary italic">{currentDemand}/100</span>
            <span className="text-[9px] text-gray-400 uppercase font-bold">
              {currentDemand > 75 ? 'Peak Demand' : currentDemand > 50 ? 'Steady' : 'Low Season'}
            </span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 p-3 rounded-2xl space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Avg Sector Margin</span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black text-neon-green italic">{avgMargin}%</span>
            <span className="text-[9px] text-gray-400 uppercase font-bold">Estimated</span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 p-3 rounded-2xl space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Recommended Action</span>
          <div className="text-[10px] font-black text-accent truncate">
            {currentDemand > 75 ? '⚡ Stock High Volume' : currentDemand < 45 ? '🛡️ Hold Premium Tier' : '📈 Dynamic Pricing'}
          </div>
        </div>
      </div>

      {/* Main Recharts Chart Canvas */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'price_demand' ? (
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00f2fe" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="demandGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#39FF14" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#39FF14" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis yAxisId="left" stroke="#00f2fe" tick={{ fill: '#00f2fe', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#39FF14" tick={{ fill: '#39FF14', fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0d1117', 
                  borderColor: '#00f2fe33', 
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                  fontSize: '11px',
                  color: '#fff'
                }} 
              />
              <Area 
                yAxisId="left" 
                type="monotone" 
                dataKey="avgPrice" 
                name="Avg Price ($)" 
                stroke="#00f2fe" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#priceGlow)" 
              />
              <Area 
                yAxisId="right" 
                type="monotone" 
                dataKey="demandIndex" 
                name="Demand Index" 
                stroke="#39FF14" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#demandGlow)" 
              />
            </AreaChart>
          ) : (
            <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis stroke="#f093fb" tick={{ fill: '#f093fb', fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0d1117', 
                  borderColor: '#f093fb33', 
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                  fontSize: '11px',
                  color: '#fff'
                }} 
              />
              <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }} />
              <Bar dataKey="marginPercent" name="Est. Margin %" fill="#f093fb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="supplyVolume" name="Trade Units" fill="#00f2fe" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Advisory Node Footer */}
      <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <Zap size={16} className="text-primary shrink-0 animate-pulse" />
          <p className="text-[10px] text-gray-300 font-medium">
            <strong className="text-white">AI Node Insight:</strong> Historical trends for <span className="text-primary font-bold">{selectedCategory}</span> indicate peak demand cycles approaching. Suppliers stocking items early capture up to 22% higher trade volumes.
          </p>
        </div>
      </div>
    </div>
  );
}
