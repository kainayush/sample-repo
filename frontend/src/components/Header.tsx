import React from 'react';
import { Activity, ShieldAlert, ShieldCheck, Zap, Radio } from 'lucide-react';
import { DetectionResult } from '../types';

interface HeaderProps {
  isConnected: boolean;
  latestDetection: DetectionResult | null;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, latestDetection }) => {
  const isBreakActive = latestDetection?.status === 'break_detected';

  return (
    <header className="scada-panel" style={{ borderBottom: '2px solid var(--panel-border)' }}>
      <div style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,180,84,0.2), rgba(255,92,92,0.2))',
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid var(--accent-amber)',
            display: 'flex'
          }}>
            <Zap size={24} color="var(--accent-amber)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.04em', color: '#fff', margin: 0 }}>
              FEEDER WATCH <span style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', fontWeight: 500 }}>v1.0 (SIH)</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              Smart Meter Analytics for LT Line Break Detection &amp; Automated Segment Tripping
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Feeder Identifier */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>FEEDER ID</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--signal-cyan)', fontFamily: 'var(--font-mono)' }}>FDR-ALPHA-01</span>
          </div>

          {/* Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} className={isConnected ? 'badge badge-green' : 'badge badge-red'}>
            <Radio size={12} className={isConnected ? 'status-dot-green' : 'status-dot-red'} />
            <span>{isConnected ? 'LIVE WS' : 'DISCONNECTED'}</span>
          </div>

          {/* System Status Banner */}
          {isBreakActive ? (
            <div className="badge badge-red" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} />
              <span>LT LINE BREAK ACTIVE - TRIP ISSUED</span>
            </div>
          ) : (
            <div className="badge badge-green" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} />
              <span>LINE HEALTHY (NOMINAL)</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
