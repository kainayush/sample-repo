import { useEffect, useState, useRef, useCallback } from 'react';
import { DetectionResult, AlertItem } from '../types';

interface UseWebSocketReturn {
  isConnected: boolean;
  latestDetection: DetectionResult | null;
  alerts: AlertItem[];
  connectionError: string | null;
  refreshAlerts: () => void;
}

export function useWebSocket(feederId = 'FDR-ALPHA-01'): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [latestDetection, setLatestDetection] = useState<DetectionResult | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);

  const fetchInitialData = useCallback(async () => {
    try {
      // Fetch initial feeder status & detection result
      const statusRes = await fetch(`/api/feeders/${feederId}/status`);
      const statusData = await statusRes.json();
      if (statusData.success && statusData.detectionResult) {
        setLatestDetection(statusData.detectionResult);
      }

      // Fetch alerts
      const alertsRes = await fetch('/api/alerts?limit=50');
      const alertsData = await alertsRes.json();
      if (alertsData.success) {
        setAlerts(alertsData.alerts);
      }
    } catch (err: any) {
      console.error('[Frontend] Error fetching initial API status:', err);
    }
  }, [feederId]);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    console.log(`[WebSocket] Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connection established');
      setIsConnected(true);
      setConnectionError(null);
      fetchInitialData();
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'DETECTION_RESULT') {
          setLatestDetection(payload.data);
          // Refetch alerts on break detection to catch newly generated alerts
          fetch('/api/alerts?limit=50')
            .then(res => res.json())
            .then(data => { if (data.success) setAlerts(data.alerts); });
        } else if (payload.type === 'ALERTS_UPDATE') {
          setAlerts(payload.data);
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing message:', err);
      }
    };

    ws.onerror = () => {
      console.error('[WebSocket] Socket error observed');
      setConnectionError('WebSocket connection error');
    };

    ws.onclose = () => {
      console.log('[WebSocket] Connection closed. Reconnecting in 2 seconds...');
      setIsConnected(false);
      socketRef.current = null;
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    socketRef.current = ws;
  }, [fetchInitialData]);

  useEffect(() => {
    fetchInitialData();
    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect, fetchInitialData]);

  const refreshAlerts = useCallback(() => {
    fetch('/api/alerts?limit=50')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAlerts(data.alerts);
      });
  }, []);

  return {
    isConnected,
    latestDetection,
    alerts,
    connectionError,
    refreshAlerts
  };
}
