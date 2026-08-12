import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { Header } from './components/Header';
import { FeederTopology } from './components/FeederTopology';
import { LiveDataTable } from './components/LiveDataTable';
import { AlgorithmTracePanel } from './components/AlgorithmTracePanel';
import { AlertLogPanel } from './components/AlertLogPanel';
import { SimulatorControlPanel } from './components/SimulatorControlPanel';

export const App: React.FC = () => {
  const { isConnected, latestDetection, alerts, refreshAlerts } = useWebSocket('FDR-ALPHA-01');

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        refreshAlerts();
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  return (
    <div className="scada-container">
      {/* SCADA Top Header Banner */}
      <Header isConnected={isConnected} latestDetection={latestDetection} />

      {/* Simulator Control & Fault Injection Bar */}
      <SimulatorControlPanel />

      {/* Feeder Physical Topology Visualizer */}
      <FeederTopology detectionResult={latestDetection} />

      {/* 3-Column SCADA Analytical Dashboard Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.25rem',
        flex: 1
      }}>
        {/* Real-time Telemetry Data Table */}
        <LiveDataTable meters={latestDetection?.meters || []} />

        {/* Diagnostic Algorithm Execution Trace */}
        <AlgorithmTracePanel trace={latestDetection?.trace} timestamp={latestDetection?.timestamp} />

        {/* System Protection Alarm Log */}
        <AlertLogPanel alerts={alerts} onAcknowledgeAlert={handleAcknowledgeAlert} />
      </div>
    </div>
  );
};

export default App;
