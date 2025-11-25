import React from 'react';
import { AppState } from '../types';

interface StepIndicatorProps {
  currentStep: AppState;
}

const steps = [
  { id: AppState.IDLE, label: 'Upload' },
  { id: AppState.EXTRACTING, label: 'Processing' },
  { id: AppState.REVIEW, label: 'Review & Config' },
  { id: AppState.GENERATING_AUDIO, label: 'Generating' },
  { id: AppState.PLAYBACK, label: 'Complete' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const getCurrentIndex = () => {
    // Treat TRANSLATING as part of GENERATING visually for simplicity
    if (currentStep === AppState.TRANSLATING) return 3;
    return steps.findIndex(s => s.id === currentStep);
  };

  const currentIndex = getCurrentIndex();

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <div className="flex justify-between relative">
        {/* Progress Bar Background */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -z-10 transform -translate-y-1/2 rounded-full"></div>
        
        {/* Active Progress Bar */}
        <div 
          className="absolute top-1/2 left-0 h-1 bg-indigo-500 -z-10 transform -translate-y-1/2 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300
                  ${isActive 
                    ? 'bg-indigo-600 border-indigo-600 text-white' 
                    : 'bg-slate-800 border-slate-600 text-slate-400'}
                  ${isCurrent ? 'ring-4 ring-indigo-500/30 scale-110' : ''}
                `}
              >
                {index + 1}
              </div>
              <span className={`mt-2 text-xs font-medium ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};