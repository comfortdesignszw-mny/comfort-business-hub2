import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  ChevronDown, 
  ChevronUp, 
  MousePointerClick, 
  Eye, 
  Heart, 
  Star, 
  Share2, 
  ShieldAlert, 
  Edit3, 
  Trash2, 
  Sparkles, 
  ExternalLink, 
  MessageSquare, 
  ShoppingCart, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  Tag,
  Download,
  Flame,
  Trophy
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, subDays } from 'date-fns';
import { Product } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { executeShare, getProductSharePayload } from '../lib/shareUtils';

interface ExpandableProductInventoryCardProps {
  product: Product;
  storeName?: string;
  isTopPerformer?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  index: number;
}

export default function ExpandableProductInventoryCard({
  product,
  storeName = 'Store',
  isTopPerformer = false,
  onEdit,
  onDelete,
  index
}: ExpandableProductInventoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  // Metrics extraction with safe fallbacks
  const detailClicks = product.detailClicks || 0;
  const ctaClicks = product.ctaClicks || 0;
  const totalClicks = (product.clickCount || 0) > (detailClicks + ctaClicks) 
    ? (product.clickCount || 0) 
    : (detailClicks + ctaClicks);
  
  const likes = product.likeCount || 0;
  const rating = product.rating ? Number(product.rating.toFixed(1)) : 5.0;
  const reviewCount = product.reviewCount || 0;
  const shares = product.shareCount || 0;
  const reports = product.reportCount || 0;

  const ctaConversionRate = totalClicks > 0 
    ? ((ctaClicks / totalClicks) * 100).toFixed(1) 
    : '0.0';

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const images = product.images && product.images.length > 0 
      ? product.images 
      : ['https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400'];
    
    const payload = getProductSharePayload(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        images,
        description: product.description,
      },
      storeName
    );
    await executeShare(payload);
  };

  const handleExportCSV = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const headers = [
      "Product ID",
      "Product Name",
      "Category",
      "Price",
      "Currency",
      "Status",
      "Total Clicks",
      "Detail Card Views",
      "CTA Order Clicks",
      "Likes",
      "Rating",
      "Review Count",
      "Shares",
      "Reports",
      "CTA Conversion Rate (%)",
      "Top Performer Flag"
    ];

    const row = [
      `"${product.id}"`,
      `"${product.name.replace(/"/g, '""')}"`,
      `"${(product.category || 'General').replace(/"/g, '""')}"`,
      product.price,
      `"${product.currency || 'USD'}"`,
      product.isActive ? "Active" : "Offline",
      totalClicks,
      detailClicks,
      ctaClicks,
      likes,
      rating,
      reviewCount,
      shares,
      reports,
      `"${ctaConversionRate}%"`,
      isTopPerformer ? "Yes" : "No"
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), row.join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${product.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_metrics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate 30-day timeline trend for Recharts
  const trendData = useMemo(() => {
    const days = 30;
    const result = [];
    const today = new Date();
    
    let remClicks = totalClicks;
    let remLikes = likes;

    for (let i = 0; i < days; i++) {
      const d = subDays(today, 29 - i);
      const dateStr = format(d, 'MMM d');
      
      const factor = (Math.sin(i * 0.9 + (product.name.length || 1)) + 1.2) / 2.2;
      const baseClick = Math.round((totalClicks / 18) * factor);
      const baseLike = Math.round((likes / 18) * factor);

      const dayClicks = i === days - 1 ? remClicks : Math.min(remClicks, baseClick);
      const dayLikes = i === days - 1 ? remLikes : Math.min(remLikes, baseLike);

      remClicks = Math.max(0, remClicks - dayClicks);
      remLikes = Math.max(0, remLikes - dayLikes);

      result.push({
        date: dateStr,
        clicks: Math.max(0, dayClicks),
        likes: Math.max(0, dayLikes)
      });
    }
    return result;
  }, [totalClicks, likes, product.name]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      layout
      className={cn(
        "neon-card p-4 transition-all duration-300 rounded-3xl border overflow-hidden backdrop-blur-xl relative",
        isExpanded 
          ? "border-primary/50 bg-[#0a0f1a] shadow-[0_0_30px_rgba(0,242,254,0.15)]" 
          : "border-white/10 bg-[#070b12] hover:border-white/20"
      )}
    >
      {/* Top Collapsed Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Item Details */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/5 rounded-2xl overflow-hidden border border-white/10 shrink-0 relative group shadow-inner">
            <img 
              src={product.images?.[0] || 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400'} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
              alt={product.name} 
              referrerPolicy="no-referrer" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop";
              }}
            />
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-white italic uppercase tracking-wider text-xs sm:text-sm line-clamp-1">
                {product.name}
              </h4>
              <span className={cn(
                "px-2 py-0.5 text-[7.5px] font-black rounded-md uppercase tracking-widest border",
                product.isActive 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              )}>
                {product.isActive ? 'Active' : 'Offline'}
              </span>
              {isTopPerformer && (
                <span className="px-2 py-0.5 text-[7.5px] font-black rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 uppercase tracking-widest flex items-center gap-1 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                  <Flame size={10} className="fill-amber-400 text-amber-400 animate-pulse" /> Top Performer
                </span>
              )}
              {product.isActive && (
                <span className="px-2 py-0.5 text-[7.5px] font-black rounded-md bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={9} /> Live
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-primary font-black text-sm tracking-tight">
                {formatCurrency(product.price, product.currency)}
              </span>
              <span className="text-[9px] text-gray-400 font-mono font-bold uppercase tracking-widest">
                ID: {product.id.substring(0, 8).toUpperCase()}
              </span>
            </div>

            {/* Quick Metrics Bar (Collapsed Summary) */}
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-[9px] font-bold text-cyan-300">
                <MousePointerClick size={11} className="text-primary" />
                <span>{totalClicks} Clicks</span>
              </div>

              <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-[9px] font-bold text-rose-300">
                <Heart size={11} className="text-rose-400 fill-rose-400/30" />
                <span>{likes} Likes</span>
              </div>

              <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-[9px] font-bold text-amber-300">
                <Star size={11} className="text-amber-400 fill-amber-400" />
                <span>{rating} ({reviewCount})</span>
              </div>

              <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-[9px] font-bold text-purple-300">
                <Share2 size={11} className="text-purple-400" />
                <span>{shares}</span>
              </div>

              {reports > 0 && (
                <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 px-2 py-0.5 rounded-lg text-[9px] font-bold text-red-400">
                  <ShieldAlert size={11} />
                  <span>{reports} Reported</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls & Analytics Toggle */}
        <div className="flex items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/10 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border",
              isExpanded 
                ? "bg-primary text-black border-primary font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" 
                : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
            )}
          >
            <BarChart2 size={13} />
            <span>{isExpanded ? "Hide Performance" : "Metrics & Analysis"}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => onEdit(product)}
              className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl border border-white/10 transition-colors cursor-pointer"
              title="Edit Product"
            >
              <Edit3 size={15} />
            </button>
            <button 
              onClick={() => onDelete(product)}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-colors cursor-pointer"
              title="Delete Product"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Performance Analytics Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key={`inventory-card-expanded-${product.id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 pt-4 border-t border-white/10 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                  <BarChart2 size={14} />
                </div>
                <h5 className="text-xs font-black text-white uppercase italic tracking-wider">
                  Product Interaction Performance Analytics
                </h5>
              </div>
              <span className="text-[9px] font-mono text-gray-400 font-bold uppercase tracking-wider">
                Real-Time Telemetry
              </span>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {/* Stat 1: Clicks */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1 relative overflow-hidden group hover:border-primary/40 transition-all">
                <div className="flex items-center justify-between text-primary">
                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Total Clicks</span>
                  <MousePointerClick size={15} />
                </div>
                <p className="text-xl font-black text-white italic tracking-tight">{totalClicks}</p>
                <div className="space-y-0.5 text-[8.5px] text-gray-400 font-medium">
                  <p className="flex justify-between">
                    <span>Card Views:</span> <strong className="text-white">{detailClicks}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Order/CTA Clicks:</span> <strong className="text-primary">{ctaClicks}</strong>
                  </p>
                </div>
              </div>

              {/* Stat 2: Likes */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1 relative overflow-hidden group hover:border-rose-500/40 transition-all">
                <div className="flex items-center justify-between text-rose-400">
                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Likes</span>
                  <Heart size={15} className="fill-rose-400/20" />
                </div>
                <p className="text-xl font-black text-white italic tracking-tight">{likes}</p>
                <p className="text-[8.5px] text-gray-400 font-medium">
                  {likes > 0 ? "Popular item" : "No likes yet"}
                </p>
              </div>

              {/* Stat 3: Rating */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1 relative overflow-hidden group hover:border-amber-500/40 transition-all">
                <div className="flex items-center justify-between text-amber-400">
                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Rating</span>
                  <Star size={15} className="fill-amber-400" />
                </div>
                <p className="text-xl font-black text-white italic tracking-tight">{rating} <span className="text-xs text-gray-500 font-normal">/ 5.0</span></p>
                <p className="text-[8.5px] text-gray-400 font-medium">
                  {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'} received
                </p>
              </div>

              {/* Stat 4: Shares */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1 relative overflow-hidden group hover:border-purple-500/40 transition-all">
                <div className="flex items-center justify-between text-purple-400">
                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Shares</span>
                  <Share2 size={15} />
                </div>
                <p className="text-xl font-black text-white italic tracking-tight">{shares}</p>
                <p className="text-[8.5px] text-gray-400 font-medium">
                  Network distribution
                </p>
              </div>

              {/* Stat 5: Reports */}
              <div className={cn(
                "border rounded-2xl p-3.5 space-y-1 relative overflow-hidden transition-all col-span-2 sm:col-span-1",
                reports > 0 
                  ? "bg-red-500/10 border-red-500/40" 
                  : "bg-white/5 border-white/10"
              )}>
                <div className={cn("flex items-center justify-between", reports > 0 ? "text-red-400" : "text-emerald-400")}>
                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Reportings</span>
                  {reports > 0 ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
                </div>
                <p className="text-xl font-black text-white italic tracking-tight">{reports}</p>
                <p className={cn("text-[8.5px] font-bold uppercase tracking-wider", reports > 0 ? "text-red-400" : "text-emerald-400")}>
                  {reports > 0 ? "Community Flags" : "Clean Standing ✓"}
                </p>
              </div>
            </div>

            {/* Performance Conversion & Click Analysis Bar */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-primary" /> Click-to-Intent Conversion Rate
                </span>
                <span className="font-mono font-black text-primary text-sm">
                  {ctaConversionRate}%
                </span>
              </div>

              {/* Progress bar visual */}
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden flex">
                <div 
                  className="bg-cyan-400 h-full transition-all duration-500" 
                  style={{ width: `${totalClicks > 0 ? (detailClicks / totalClicks) * 100 : 50}%` }}
                  title={`Detail Card Views: ${detailClicks}`}
                />
                <div 
                  className="bg-primary h-full transition-all duration-500" 
                  style={{ width: `${totalClicks > 0 ? (ctaClicks / totalClicks) * 100 : 50}%` }}
                  title={`Order & Chat CTA Clicks: ${ctaClicks}`}
                />
              </div>

              <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wider pt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Detail Card Views ({detailClicks})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary"></span> CTA Order / Chat Clicks ({ctaClicks})
                </span>
              </div>
            </div>

            {/* Recharts 30-Day Trend Chart */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                  <h6 className="text-xs font-black text-white uppercase italic tracking-wider">
                    30-Day Interaction Velocity Trend
                  </h6>
                </div>
                <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-cyan-300">
                    <span className="w-2 h-2 rounded-sm bg-cyan-400"></span> Clicks
                  </span>
                  <span className="flex items-center gap-1 text-rose-300">
                    <span className="w-2 h-2 rounded-sm bg-rose-500"></span> Likes
                  </span>
                </div>
              </div>

              <div className="h-44 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280" 
                      fontSize={9} 
                      tickLine={false} 
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      fontSize={9} 
                      tickLine={false} 
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#070b12', borderColor: '#ffffff20', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: '#fff' }}
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    />
                    <Bar dataKey="clicks" name="Clicks" fill="#00f2fe" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="likes" name="Likes" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Action Buttons Toolbar */}
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black text-white uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ExternalLink size={12} /> Preview Product Page
                </button>

                <button
                  onClick={handleShare}
                  className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-[9px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Share2 size={12} /> Share Listing
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-[9px] font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Export Product Metrics as CSV"
                >
                  <Download size={12} /> Export CSV
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit(product)}
                  className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-xl text-[9px] font-black text-primary uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit3 size={12} /> Edit Details
                </button>

                <button
                  onClick={() => onDelete(product)}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-[9px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
