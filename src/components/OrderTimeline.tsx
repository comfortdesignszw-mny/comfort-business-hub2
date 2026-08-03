import React from 'react';
import { Check, Clock, Package, Truck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DealStatus } from '../types';

export default function OrderTimeline({ status, trackingStage }: { status: DealStatus; trackingStage?: string }) {
  const steps = [
    { id: 'confirmed', label: 'Order Confirmed', icon: Clock },
    { id: 'prepared', label: 'Order being prepared', icon: Package },
    { id: 'transit', label: 'Order in Transit', icon: Truck },
    { id: 'delivered', label: 'Order Delivered!', icon: Check }
  ];

  const getStepIndex = (): number => {
    if (trackingStage === 'Order Confirmed') return 0;
    if (trackingStage === 'Order being prepared') return 1;
    if (trackingStage === 'Order in Transit') return 2;
    if (trackingStage === 'Order Delivered!' || trackingStage === 'Delivered Confirmed' || status === 'won') return 3;

    switch (status) {
      case 'pending':
      case 'confirmed':
      case 'quoted':
        return 0;
      case 'accepted':
      case 'preparing':
        return 1;
      case 'shipped':
      case 'in_transit':
        return 2;
      case 'delivered':
        return 3;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex();

  if (status === 'cancelled') {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center flex flex-col items-center gap-2">
        <AlertCircle className="text-red-500" size={24} />
        <p className="text-red-500 text-xs font-bold uppercase tracking-widest">Order Cancelled</p>
      </div>
    );
  }

  return (
    <div className="relative pt-6 pb-2 w-full px-2">
      <div className="absolute top-10 left-6 right-6 h-[2px] bg-white/10" />
      <div 
        className="absolute top-10 left-6 h-[2px] bg-primary transition-all duration-500"
        style={{ width: `${(currentIndex / (steps.length - 1)) * 85}%` }}
      />
      <div className="relative flex justify-between gap-1">
        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="flex flex-col items-center flex-1 min-w-0">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-colors duration-500 ${
                  isCurrent 
                    ? 'bg-primary text-black ring-4 ring-primary/30 shadow-[0_0_15px_rgba(0,242,254,0.6)]' 
                    : isCompleted 
                    ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                    : 'bg-[#05070a] border-2 border-white/20 text-gray-500'
                }`}
              >
                <Icon size={14} className={isCurrent ? 'animate-pulse' : ''} />
              </div>
              <p className={`mt-2.5 text-[8.5px] font-black uppercase tracking-wider text-center leading-tight ${
                isCurrent 
                  ? 'text-primary font-black scale-105' 
                  : isCompleted 
                  ? 'text-emerald-400 font-bold' 
                  : 'text-gray-500'
              }`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
