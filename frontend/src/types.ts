export interface MeterReadingState {
  id: string;
  feeder_id: string;
  position_order: number;
  household_label: string;
  voltage: number | null;
  current: number | null;
  recorded_at: string | null;
  is_dead: boolean;
  dead_reason: string | null;
}

export interface TraceStep {
  step: number;
  title: string;
  detail: string;
  status: 'info' | 'success' | 'warning' | 'error';
  data?: any;
}

export interface DetectionResult {
  feederId: string;
  status: 'normal' | 'break_detected';
  timestamp: string;
  metersEvaluated: number;
  lastHealthyMeter: MeterReadingState | null;
  firstDeadMeter: MeterReadingState | null;
  breakEventId: number | null;
  tripIssued: boolean;
  recommendedTripAction: string | null;
  trace: TraceStep[];
  meters: MeterReadingState[];
}

export interface AlertItem {
  id: number;
  break_event_id: number | null;
  message: string;
  severity: string;
  created_at: string;
  acknowledged: number;
}

export interface SimulatorConfig {
  isRunning: boolean;
  intervalMs: number;
  breakPosition: number | null;
  feederId: string;
  simulateStaleness: boolean;
}
