import React from 'react';
import { Cpu, CheckCircle2, AlertTriangle, XCircle, Info, ChevronRight } from 'lucide-react';
import { TraceStep } from '../types';

interface AlgorithmTracePanelProps {
  trace: TraceStep[] | undefined;
  timestamp: string | undefined;
}

export const AlgorithmTracePanel: React.FC<AlgorithmTracePanelProps> = ({ trace, timestamp }) => {
  return (
    <div className="scada-panel" style={{ height: '100%' }}>
      <div className="scada-panel-header">
        <div className="scada-panel-title">
          <Cpu size={18} />
          <span>Core Algorithm Diagnostic Execution Trace</span>
        </div>
        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-amber)' }}>
          {timestamp ? `Last Run: ${new Date(timestamp).toLocaleTimeString()}` : 'Idle'}
        </span>
      </div>

      <div className="scada-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
        {trace && trace.length > 0 ? (
          trace.map((step) => {
            let icon = <Info size={16} color="var(--signal-cyan)" />;
            let borderColor = 'var(--panel-border)';
            let titleColor = 'var(--text-primary)';

            if (step.status === 'success') {
              icon = <CheckCircle2 size={16} color="var(--status-green)" />;
              borderColor = 'rgba(61, 220, 132, 0.3)';
              titleColor = 'var(--status-green)';
            } else if (step.status === 'warning') {
              icon = <AlertTriangle size={16} color="var(--accent-amber)" />;
              borderColor = 'rgba(255, 180, 84, 0.3)';
              titleColor = 'var(--accent-amber)';
            } else if (step.status === 'error') {
              icon = <XCircle size={16} color="var(--status-red)" />;
              borderColor = 'rgba(255, 92, 92, 0.4)';
              titleColor = 'var(--status-red)';
            }

            return (
              <div key={step.step}
                style={{
                  background: 'rgba(17, 24, 32, 0.8)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '6px',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {icon}
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: titleColor }}>
                      Step {step.step}: {step.title}
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    EXEC_OK
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: 0, paddingLeft: '1.5rem', lineHeight: '1.4' }}>
                  {step.detail}
                </p>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No trace log generated yet.
          </div>
        )}
      </div>
    </div>
  );
};
