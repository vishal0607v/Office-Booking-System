import React from 'react';
import { motion } from 'motion/react';
import { Armchair, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { Seat, Booking } from '../types';
import { SEATS } from '../constants';

interface SeatMapProps {
  selectedDate: string;
  bookings: Booking[];
  onSeatSelect: (seat: Seat) => void;
  selectedSeatId?: string;
}

export default function SeatMap({ selectedDate, bookings, onSeatSelect, selectedSeatId }: SeatMapProps) {
  const getBookingForSeat = (seatId: string) => {
    return bookings.find(b => b.seatId === seatId && b.status === 'active');
  };

  return (
    <div className="relative w-full overflow-auto bg-slate-50 rounded-xl border border-slate-200 p-8 min-h-[400px]">
      <div className="grid grid-cols-10 gap-4 min-w-[600px]">
        {SEATS.map((seat) => {
          const booking = getBookingForSeat(seat.id);
          const isBooked = !!booking;
          const isSelected = selectedSeatId === seat.id;

          return (
            <motion.button
              key={seat.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !isBooked && onSeatSelect(seat)}
              disabled={isBooked}
              className={cn(
                "relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200",
                isBooked 
                  ? "bg-slate-200 border-slate-300 cursor-not-allowed opacity-60" 
                  : isSelected
                    ? "bg-indigo-100 border-indigo-500 shadow-md ring-2 ring-indigo-200"
                    : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm",
                seat.type === 'floater' && !isBooked && !isSelected && "border-dashed border-amber-300 bg-amber-50/30"
              )}
            >
              <Armchair 
                className={cn(
                  "w-6 h-6 mb-1",
                  isBooked ? "text-slate-400" : isSelected ? "text-indigo-600" : "text-slate-600",
                  seat.type === 'floater' && !isBooked && "text-amber-600"
                )} 
              />
              <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                {seat.label}
              </span>
              
              {isBooked && (
                <div className="absolute -top-1 -right-1 bg-slate-500 text-white text-[8px] px-1 rounded-full">
                  ❌
                </div>
              )}
              
              {seat.type === 'floater' && (
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[8px] px-1 rounded-full font-bold">
                  F
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-6 text-xs font-medium text-slate-500 border-t border-slate-200 pt-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white border-2 border-slate-200" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-slate-200 border-2 border-slate-300" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-indigo-100 border-2 border-indigo-500" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-50/30 border-2 border-dashed border-amber-300" />
          <span>Floater</span>
        </div>
      </div>
    </div>
  );
}
