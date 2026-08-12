import React from 'react';
import { Zap, Flame, ShieldAlert } from 'lucide-react';
import { DetectionResult, MeterReadingState } from '../types';

interface FeederTopologyProps {
  detectionResult: DetectionResult | null;
}

export const FeederTopology: React.FC<FeederTopologyProps> = ({ detectionResult }) => {
  const meters: MeterReadingState[] = detectionResult?.meters || [
    { id: 'MTR-01', feeder_id: 'FDR-ALPHA-01', position_order: 1, household_label: 'Substation Gate', voltage: 230, current: 5.0, recorded_at: null, is_dead: false, dead_reason: null },
    { id: 'MTR-02', feeder_id: 'FDR-ALPHA-01', position_order: 2, household_label: 'Sector 4 North', voltage: 230, current: 5.0, recorded_at: null, is_dead: false, dead_reason: null },
    { id: 'MTR-03', feeder_id: 'FDR-ALPHA-01', position_order: 3, household_label: 'Market Complex', voltage: 230, current: 5.0, recorded_at: null, is_dead: false, dead_reason: null },
    { id: 'MTR-04', feeder_id: 'FDR-ALPHA-01', position_order: 4, household_label: 'Residential Block A', voltage: 230, current: 5.0, recorded_at: null, is_dead: false, dead_reason: null },
    { id: 'MTR-05', feeder_id: 'FDR-ALPHA-01', position_order: 5, household_label: 'School Junction', voltage: 230, current: 5.0, recorded_at: null, is_dead: false, dead_reason: null },
    { id: 'MTR-06', feeder_id: 'FDR-ALPHA-01', position_order: 6, household_label: 'Terminal Station', voltage: 230, current: 5.0, recorded_at: null, is_dead: false, dead_reason: null }
  ];

  const lastHealthy = detectionResult?.lastHealthyMeter;
  const firstDead = detectionResult?.firstDeadMeter;
  const isBreakActive = detectionResult?.status === 'break_detected';

  const bannerStyle: React.CSSProperties = {
    background: 'rgba(255, 92, 92, 0.12)',
    border: '1px solid var(--status-red)',
    borderRadius: '6px',
    padding: '0.8rem 1.25rem',
    marginBottom: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    boxShadow: '0 0 15px rgba(255, 92, 92, 0.2)'
  };

  return (
    <div className="scada-panel">
      <div className="scada-panel-header">
        <div className="scada-panel-title">
          <Zap size={18} />
          <span>Feeder Line Physical Topology Schematic</span>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--status-green)' }}>
            <span className="status-dot status-dot-green"></span> Healthy Meter
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--status-red)' }}>
            <span className="status-dot status-dot-red"></span> Dead / De-energized
          </span>
        </div>
      </div>

      <div className="scada-panel-body" style={{ background: '#0a0e14', padding: '2rem 1.5rem' }}>
        {/* Recommended Trip Alert Banner */}
        {isBreakActive && (
          <div style={bannerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ShieldAlert size={26} color="var(--status-red)" style={{ animation: 'bounce-break 1s infinite alternate' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--status-red)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                  LT LINE BREAK CONFIRMED BETWEEN [{lastHealthy ? lastHealthy.id : 'HEAD'}] AND [{firstDead?.id}]
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {detectionResult?.recommendedTripAction}
                </div>
              </div>
            </div>
            <div className="badge badge-red" style={{ padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}>
              ACR TRIP EXECUTED
            </div>
          </div>
        )}

        {/* Feeder Diagram Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', minWidth: '700px' }}>
          
          {/* Substation Transformer TR-101 Node */}
          <div className="transformer-node">
            <div className="transformer-icon">
              <Zap size={24} />
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--signal-cyan)', fontFamily: 'var(--font-mono)' }}>
              TR-101
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
              11kV/415V Substation
            </div>
          </div>

          {/* Render Meters and Conductor Lines */}
          {meters.map((meter, idx) => {
            const isLastHealthy = lastHealthy?.id === meter.id;
            const isFirstDead = firstDead?.id === meter.id;

            // Conductor segment before this meter
            const prevMeterIsDead = idx > 0 && meters[idx - 1].is_dead;
            const isBreakPointSegment = isBreakActive && (
              (lastHealthy ? lastHealthy.id === meters[idx - 1]?.id : idx === 0) && isFirstDead
            );

            const meterIconStyle: React.CSSProperties = {
              border: isLastHealthy ? '2px solid var(--accent-amber)' : undefined,
              boxShadow: isLastHealthy ? '0 0 15px var(--accent-amber)' : undefined
            };

            return (
              <React.Fragment key={meter.id}>
                {/* Conductor Cable Segment */}
                <div style={{ flex: 1, position: 'relative', margin: '0 4px' }}>
                  <div className={`conductor-segment ${isBreakPointSegment ? 'broken' : prevMeterIsDead ? 'dead-segment' : ''}`} />
                  
                  {/* Conductor Break Marker UI */}
                  {isBreakPointSegment && (
                    <div className="break-indicator">
                      <Flame size={22} color="var(--status-red)" />
                      <span style={{ fontSize: '0.65rem', background: 'var(--status-red)', color: '#fff', padding: '1px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                        SNAP LOCATION
                      </span>
                    </div>
                  )}
                </div>

                {/* Smart Meter Box Node */}
                <div className="meter-node">
                  <div className={`meter-icon ${meter.is_dead ? 'dead' : ''}`} style={meterIconStyle}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      P{meter.position_order}
                    </span>
                    <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                      {meter.id}
                    </span>
                  </div>

                  {/* Readings readout badge */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: meter.is_dead ? 'var(--status-red)' : 'var(--status-green)'
                    }}>
                      {meter.voltage !== null ? `${meter.voltage.toFixed(1)}V` : 'NO DATA'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                      {meter.current !== null ? `${meter.current.toFixed(1)}A` : '0A'}
                    </div>
                  </div>

                  {/* Topology Labels */}
                  {isLastHealthy && (
                    <div className="badge badge-amber" style={{ fontSize: '0.65rem', padding: '1px 4px' }}>
                      LAST HEALTHY
                    </div>
                  )}
                  {isFirstDead && (
                    <div className="badge badge-red" style={{ fontSize: '0.65rem', padding: '1px 4px' }}>
                      FIRST DEAD
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
