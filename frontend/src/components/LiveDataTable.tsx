import React from 'react';
import { Database, Wifi, WifiOff } from 'lucide-react';
import { MeterReadingState } from '../types';

interface LiveDataTableProps {
  meters: MeterReadingState[];
}

export const LiveDataTable: React.FC<LiveDataTableProps> = ({ meters }) => {
  return (
    <div className="scada-panel" style={{ height: '100%' }}>
      <div className="scada-panel-header">
        <div className="scada-panel-title">
          <Database size={18} />
          <span>Smart Meter Real-Time Telemetry Grid</span>
        </div>
        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {meters.length} Active Nodes
        </span>
      </div>

      <div className="scada-panel-body" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="scada-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Meter ID</th>
              <th>Household / Location</th>
              <th>Voltage (V)</th>
              <th>Current (A)</th>
              <th>Status</th>
              <th>Last Update</th>
            </tr>
          </thead>
          <tbody>
            {meters && meters.length > 0 ? (
              meters.map((meter) => (
                <tr key={meter.id} style={{ background: meter.is_dead ? 'rgba(255,92,92,0.05)' : undefined }}>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--signal-cyan)' }}>
                    P{meter.position_order}
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {meter.id}
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                    {meter.household_label}
                  </td>
                  <td className="mono" style={{ fontWeight: 700, color: meter.is_dead ? 'var(--status-red)' : 'var(--status-green)' }}>
                    {meter.voltage !== null ? `${meter.voltage.toFixed(1)} V` : '0.0 V'}
                  </td>
                  <td className="mono" style={{ color: 'var(--signal-cyan)' }}>
                    {meter.current !== null ? `${meter.current.toFixed(2)} A` : '0.00 A'}
                  </td>
                  <td>
                    {meter.is_dead ? (
                      <span className="badge badge-red" title={meter.dead_reason || 'Low Voltage / Dead'}>
                        <WifiOff size={10} /> DEAD
                      </span>
                    ) : (
                      <span className="badge badge-green">
                        <Wifi size={10} /> HEALTHY
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {meter.recorded_at ? new Date(meter.recorded_at).toLocaleTimeString() : 'N/A'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Awaiting telemetry stream initialization...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
