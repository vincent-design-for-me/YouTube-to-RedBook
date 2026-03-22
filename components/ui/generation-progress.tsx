'use client';

const STEPS = [
  { id: 1, label: '提取知识点' },
  { id: 2, label: '生成文案' },
  { id: 3, label: '生成配图' },
];

interface GenerationStepBarProps {
  /** Which steps are completed (1, 2, 3) */
  completedStep: number;
  /** Which step is currently active/in-progress (1, 2, 3) */
  activeStep: number;
  /** Which step content the user is viewing */
  viewingStep: number;
  /** Whether something is currently being generated */
  isProcessing: boolean;
  /** Status message to display */
  message?: string;
  /** Callback when user clicks a step to view it */
  onStepClick: (step: number) => void;
}

export function GenerationStepBar({
  completedStep,
  activeStep,
  viewingStep,
  isProcessing,
  message,
  onStepClick,
}: GenerationStepBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        {STEPS.map((step, index) => {
          const isCompleted = step.id <= completedStep;
          const isActive = step.id === activeStep;
          const isViewing = step.id === viewingStep;
          const isClickable = step.id <= completedStep + 1 && step.id <= activeStep;

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full
                  ${isClickable ? 'cursor-pointer hover:bg-accent' : 'cursor-default'}
                  ${isViewing ? 'bg-accent' : ''}
                `}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isActive && isProcessing
                        ? 'bg-primary/20 text-primary ring-2 ring-primary animate-pulse'
                        : isActive
                          ? 'bg-primary/20 text-primary ring-2 ring-primary'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? '✓' : step.id}
                </div>
                <span
                  className={`text-xs ${
                    isViewing || isActive
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`h-px w-4 shrink-0 ${
                    step.id < activeStep ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {message && isProcessing && (
        <p className="text-center text-sm text-muted-foreground animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
