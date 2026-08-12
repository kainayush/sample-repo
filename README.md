# Feeder Watch — Smart Meter Analytics for LT Line Break Detection

> **Smart India Hackathon (SIH) Project**  
> An intelligent SCADA analytics system that detects broken Low-Tension (LT) power line conductors using existing smart meter voltage analytics without requiring any additional hardware on the distribution line itself.

---

## ⚡ Problem Statement & Core Innovation

Circuit breakers and Automatic Circuit Reclosers (ACRs) trip exclusively on **high fault current** (short circuits, line-to-ground faults). When an LT overhead conductor snaps and hangs in mid-air or falls onto dry ground, little to no fault current flows. As a result:
- Traditional substation relays see normal current and **do not trip**.
- The snapped conductor remains **live and dangerously energized**, posing a severe risk of electrocution to pedestrians and livestock.

**Feeder Watch** solves this by leveraging smart meters installed along the feeder line. By continuously scanning voltage profiles across topology-ordered meters, it detects the exact physical point of voltage drop discontinuity and immediately pinpoints the conductor break location.

---

## 🧠 Core Algorithm

Smart meters are indexed by physical position along a feeder line ($Pos_1$ closest to transformer, $Pos_N$ furthest).

```
[ Transformer TR-101 ] ─── (Normal ~230V) ─── [ Meter 1 ] ─── (Normal ~230V) ─── [ Meter 3 ] ─── ⚡ CONDUCOR SNAP ⚡ ─── (Near 0V / Dead) ─── [ Meter 4 ] ─── [ Meter 6 ]
                                                                                   │                                                         │
                                                                           LAST HEALTHY METER                                       FIRST DEAD METER
```

1. **Ingest & Aggregate**: Collect voltage + current readings from all active smart meters on a feeder.
2. **Topology Order Sort**: Sort readings strictly by physical feeder position order ($position\_order$), ignoring meter ID or arrival order.
3. **Discontinuity Transition Scan**: Walk the ordered topology scanning for the first transition point where voltage drops from normal (within $\pm 10\%$ of nominal $230\text{V}$) to dead ($< 30\%$ of nominal $69\text{V}$, or missing data exceeding the $6\text{s}$ staleness window).
4. **Fault Localization**:
   - **Last Healthy Meter**: The last meter before the transition point.
   - **First Dead Meter**: The first meter at or after the transition point.
5. **Protection Action**: Report break located between **Last Healthy Meter** and **First Dead Meter**, and issue an immediate segment trip command to isolate downstream sections.

---

## 🏗️ System Architecture

- **Database**: Relational SQLite database using `better-sqlite3` with WAL mode, foreign keys, and indexes on `(meter_id, recorded_at)`.
- **Backend API**: Node.js + Express REST API & WebSocket server (`/ws/live`) for real-time telemetry streaming and diagnostic execution tracing.
- **Simulator**: Integrated background simulator engine & standalone CLI runner (`npm run simulator`) with interactive UI controls for fault injection and recovery.
- **Frontend Dashboard**: SCADA Control-Room dark-mode UI (`#0a0e14`, `#111820`, `#ffb454`, `#5ecbe0`, `#3ddc84`, `#ff5c5c`) with real-time feeder topology visualizer, telemetry data grid, step-by-step diagnostic reasoning trace, and alert log.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js v18.x or higher
- npm v9.x or higher

### Installation & Run

1. **Clone or navigate to project directory**:
   ```bash
   cd SIH
   ```

2. **Install all dependencies** (Root, Backend & Frontend):
   ```bash
   npm run install:all
   ```

3. **Launch Full Application** (Backend + Frontend simultaneously):
   ```bash
   npm run dev
   ```

   - **Frontend SCADA Dashboard**: Open [http://localhost:3000](http://localhost:3000)
   - **Backend REST API**: [http://localhost:3001/api](http://localhost:3001/api)
   - **Live WebSocket Stream**: `ws://localhost:3001/ws/live`

4. **(Optional) Run Standalone CLI Simulator**:
   To emulate physical sensor nodes sending readings via command line:
   ```bash
   # Normal simulation
   npm run simulator

   # Simulate conductor break downstream of Meter 4
   npm run simulator -- --break 4
   ```

---

## 🔌 Swapping Simulator for Real Physical ESP32 Hardware

The system is built to ingest data from physical smart meters or ESP32 microcontrollers without modifying a single line of backend code.

### Required Hardware per Node
- ESP32 NodeMCU / DevKit V1
- ZMPT101B AC Voltage Sensor Module (connected to ADC pin `VP` / `A0` / `GPIO36`)
- ACS712 AC Current Sensor Module (connected to ADC pin `GPIO34`)
- Wi-Fi connection to local network

### Arduino / C++ Firmware Code for ESP32

Flash the following sketch onto your physical ESP32 nodes (change `WIFI_SSID`, `WIFI_PASS`, `BACKEND_IP`, and `METER_ID` per node):

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// IP Address of the machine running Feeder Watch Backend
const char* BACKEND_URL = "http://192.168.1.100:3001/api/readings";

// Configure unique ID for each physical meter (e.g. MTR-01, MTR-02)
const char* METER_ID = "MTR-01";

const int VOLTAGE_SENSOR_PIN = 36; // ADC pin for ZMPT101B
const int CURRENT_SENSOR_PIN = 34; // ADC pin for ACS712

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to Wi-Fi!");
}

float readACVoltage() {
  // Read analog value from ZMPT101B sensor and convert to RMS Voltage
  int raw = analogRead(VOLTAGE_SENSOR_PIN);
  float voltage = (raw / 4095.0) * 3.3 * 100.0; // Calibrate multiplier for 230V AC
  return voltage;
}

float readACCurrent() {
  int raw = analogRead(CURRENT_SENSOR_PIN);
  float current = (raw / 4095.0) * 3.3 * 5.0; // Calibrate multiplier for current
  return current;
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(BACKEND_URL);
    http.addHeader("Content-Type", "application/json");

    float v = readACVoltage();
    float i = readACCurrent();

    StaticJsonDocument<200> doc;
    doc["meter_id"] = METER_ID;
    doc["voltage"] = v;
    doc["current"] = i;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0) {
      Serial.printf("Telemetry sent. HTTP Response: %d\n", httpResponseCode);
    } else {
      Serial.printf("Error sending POST: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }

  delay(1500); // Sample & transmit every 1.5 seconds
}
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/feeders` | List all registered feeders |
| `GET` | `/api/feeders/:id/meters` | Get meters for a feeder in topology order with latest voltage/current |
| `POST` | `/api/readings` | Ingest new meter reading(s) `{meter_id, voltage, current}` |
| `GET` | `/api/feeders/:id/status` | Get active break fault status & last-healthy/first-dead pair |
| `GET` | `/api/alerts` | Get timestamped alert log |
| `POST` | `/api/alerts/:id/acknowledge` | Mark alert acknowledged |
| `POST` | `/api/simulator/break` | Inject simulated break at meter position |
| `POST` | `/api/simulator/restore` | Restore feeder to normal healthy operation |

---

## 📊 Database ER Diagram / Schema

- `feeders`: `id`, `name`, `transformer_label`, `created_at`
- `meters`: `id`, `feeder_id` (FK), `position_order`, `household_label`, `installed_at`
- `readings`: `id`, `meter_id` (FK), `voltage`, `current`, `recorded_at` *(Indexed)*
- `break_events`: `id`, `feeder_id` (FK), `last_healthy_meter_id`, `first_dead_meter_id`, `detected_at`, `resolved_at`, `status`, `trip_issued`
- `alerts`: `id`, `break_event_id` (FK), `message`, `severity`, `created_at`, `acknowledged`
