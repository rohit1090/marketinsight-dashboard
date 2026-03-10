
import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { format, subDays, startOfQuarter, subYears, isSameDay } from 'date-fns';
import { DateRange, DateRangePreset } from '../types';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS: DateRangePreset[] = ['Last 7 Days', 'Last 30 Days', 'This Quarter', 'Last Year', 'Custom'];

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'Custom') {
      onChange({ ...value, preset: 'Custom' });
      return;
    }

    let startDate = new Date();
    let endDate = new Date();

    switch (preset) {
      case 'Last 7 Days':
        startDate = subDays(new Date(), 7);
        break;
      case 'Last 30 Days':
        startDate = subDays(new Date(), 30);
        break;
      case 'This Quarter':
        startDate = startOfQuarter(new Date());
        break;
      case 'Last Year':
        startDate = subYears(new Date(), 1);
        break;
    }

    onChange({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      preset
    });
    setIsOpen(false);
  };

  const handleDateChange = (field: 'startDate' | 'endDate', date: string) => {
    onChange({
      ...value,
      [field]: date,
      preset: 'Custom'
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
      >
        <Calendar className="w-4 h-4 text-slate-400" />
        <span>
          {value.preset === 'Custom' 
            ? `${format(new Date(value.startDate), 'MMM d')} - ${format(new Date(value.endDate), 'MMM d, yyyy')}`
            : value.preset}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors"
              >
                {preset}
                {value.preset === preset && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            ))}
          </div>
          
          <div className="p-4 bg-slate-50/50">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
                <input
                  type="date"
                  value={value.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
                <input
                  type="date"
                  value={value.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            
            {value.preset === 'Custom' && (
              <button
                onClick={() => setIsOpen(false)}
                className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
              >
                Apply Range
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
