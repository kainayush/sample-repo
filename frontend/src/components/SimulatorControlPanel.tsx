import React, { useState, useEffect } from 'react';
import { Sliders, Flame, RefreshCw, AlertTriangle, Play, Square, Clock } from 'lucide-react';
import { SimulatorConfig } from '../types';

export const SimulatorControlPanel: React.FC = () => {
  const [config, setConfig] = useState<SimulatorConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/simulator/config');
      const data = await res.json();
      if (data.success) setConfig(data.config);
    } catch (err) {
      console.error('[SimulatorControl] Error fetching config:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const triggerBreak = async (position: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulator/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position })
      });
      const data = await res.json();
      if (data.success) setConfig(data.config);
    } catch (err) {
      console.error('[SimulatorControl] Error injecting break:', err);
    } finally {
      setLoading(false);
    }
  };

  const restoreLine = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulator/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) setConfig(data.config);
    } catch (err) {
      console.error('[SimulatorControl] Error restoring line:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStaleness = async () => {
    if (!config) return;
    setLoading(true);
    try {
      const res = await fetch('/api/simulator/staleness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !config.simulateStaleness })
      });
      const data = await res.json();
      if (data.success) setConfig(data.config);
    } catch (err) {
      console.error('[SimulatorControl] Error toggling staleness:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoSimulator = async () => {
    if (!config) return;
    setLoading(true);
    try {
      const res = await fetch('/api/simulator/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ running: !config.isRunning })
      });
      const data = await res.json();
      if (data.success) setConfig(data.config);
    } catch (err) {
      console.error('[SimulatorControl] Error toggling simulator:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scada-panel">
      <div className="scada-panel-header">
        <div className="scada-panel-title">
          <Sliders size={18} />
          <span>Interactive SCADA Simulator &amp; Fault Injector</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button className={`scada-btn ${config?.isRunning ? 'scada-btn-success' : 'scada-btn-danger'}`}
            onClick={toggleAutoSimulator}
            disabled={loading}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
          >
            {config?.isRunning ? <Square size={12} /> : <Play size={12} />}
            <span>{config?.isRunning ? 'Pause Telemetry' : 'Resume Telemetry'}</span>
          </button>
        </div>
      </div>

      <div className="scada-panel-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Break Position Trigger Buttons */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-amber)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Flame size={14} /> Inject Conductor Snap (Downstream of Meter):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {[1, 2, 3, 4, 5, 6].map((pos) => {
              const isCurrentBreak = config?.breakPosition === pos;
              return (
                <button key={pos}
                  className={`scada-btn ${isCurrentBreak ? 'scada-btn-danger' : ''}`}
                  onClick={() => triggerBreak(pos)}
                  disabled={loading}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    border: isCurrentBreak ? '2px solid var(--status-red)' : undefined
                  }}
                >
                  Break at P{pos} (MTR-0{pos})
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls & Staleness Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button className="scada-btn scada-btn-success" onClick={restoreLine} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            <RefreshCw size={14} />
            <span>Restore Feeder to Normal</span>
          </button>

          <button className={`scada-btn ${config?.simulateStaleness ? 'scada-btn-danger' : ''}`}
            onClick={toggleStaleness}
            disabled={loading}
            style={{ padding: '0.5rem 0.8rem' }}
          >
            <Clock size={14} />
            <span>{config?.simulateStaleness ? 'Staleness Test: ON' : 'Test Staleness Window'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
