import React from 'react';
import { Bell, Check, AlertOctagon } from 'lucide-react';
import { AlertItem } from '../types';

interface AlertLogPanelProps {
  alerts: AlertItem[];
  onAcknowledgeAlert: (alertId: number) => void;
}

export const AlertLogPanel: React.FC<AlertLogPanelProps> = ({ alerts, onAcknowledgeAlert }) => {
  return (
    <div className="scada-panel" style={{ height: '100%' }}>
      <div className="scada-panel-header">
        <div className="scada-panel-title">
          <Bell size={18} />
          <span>System Alarm &amp; Protection Event Log</span>
        </div>
        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {alerts.filter(a => !a.acknowledged).length} Unacknowledged
        </span>
      </div>

      <div className="scada-panel-body" style={{ padding: 0, maxHeight: '420px', overflowY: 'auto' }}>
        {alerts && alerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {alerts.map((alert) => {
              const itemStyle: React.CSSProperties = {
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--panel-border)',
                background: alert.acknowledged ? 'transparent' : 'rgba(255, 92, 92, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
              };

              return (
                <div key={alert.id} style={itemStyle}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <AlertOctagon size={18} color={alert.acknowledged ? 'var(--text-muted)' : 'var(--status-red)'} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span className={`badge ${alert.severity === 'CRITICAL' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '0.65rem' }}>
                          {alert.severity}
                        </span>
                        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: alert.acknowledged ? 'var(--text-secondary)' : 'var(--text-primary)', margin: 0 }}>
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  {!alert.acknowledged ? (
                    <button className="scada-btn" onClick={() => onAcknowledgeAlert(alert.id)} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}>
                      <Check size={12} /> ACK
                    </button>
                  ) : (
                    <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--status-green)' }}>
                      ACKNOWLEDGED
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No alarm events logged.
          </div>
        )}
      </div>
    </div>
  );
};
