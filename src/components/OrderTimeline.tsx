import React from 'react';
import { Check, Clock, Package, Truck, AlertCircle } from 'lucide-react';
import { DealStatus } from '../types';

export default function OrderTimeline({ status }: { status: DealStatus }) {
  const steps = [
    { id: 'pending', label: 'Received', icon: Clock },
    { id: 'accepted', label: 'Preparing', icon: Package },
    { id: 'shipped', label: 'Out for Delivery', icon: Truck },
    { id: 'delivered', label: 'Delivered', icon: Check }
  ];

  const getStepIndex = (s: DealStatus) => {
    switch (s) {
      case 'pending': return 0;
      case 'quoted': return 0;
      case 'accepted': return 1;
      case 'shipped': return 2;
      case 'delivered': return 3;
      default: return -1;
    }
  };

  const currentIndex = getStepIndex(status);

  if (status === 'cancelled') {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center flex flex-col items-center gap-2">
        <AlertCircle className="text-red-500" size={24} />
        <p className="text-red-500 text-xs font-bold uppercase tracking-widest">Order Cancelled</p>
      </div>
    );
  }

  return (
    <div className="relative pt-6 pb-2 w-full px-4">
      <div className="absolute top-10 left-8 right-8 h-[2px] bg-white/10" />
      <div 
        className="absolute top-10 left-8 h-[2px] bg-primary transition-all duration-500"
        style={{ width: `calc(${(currentIndex / (steps.length - 1)) * 100}% - 4rem)` }}
      />
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="flex flex-col items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-colors duration-500 ${
                  isCompleted 
                    ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]' 
                    : 'bg-[#05070a] border-2 border-white/20 text-gray-500'
                }`}
              >
                <Icon size={14} className={isCurrent ? 'animate-pulse' : ''} />
              </div>
              <p className={`mt-3 text-[9px] font-bold uppercase tracking-widest text-center ${
                isCompleted ? 'text-white' : 'text-gray-500'
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
