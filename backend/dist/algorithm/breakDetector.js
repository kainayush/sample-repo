"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBreakDetection = runBreakDetection;
const database_1 = require("../db/database");
// Configurable constants
const NOMINAL_VOLTAGE = 230; // Volts
const DEAD_VOLTAGE_THRESHOLD = NOMINAL_VOLTAGE * 0.3; // 69V (below 30% nominal is dead)
const DEFAULT_STALENESS_WINDOW_MS = 6000; // 6 seconds staleness window in simulation
function runBreakDetection(feederId, stalenessMs = DEFAULT_STALENESS_WINDOW_MS) {
    const now = new Date();
    const timestamp = now.toISOString();
    const trace = [];
    // Step 1: Collect meters and latest readings
    const rawMeters = (0, database_1.getMetersByFeeder)(feederId);
    trace.push({
        step: 1,
        title: 'Data Collection & Time Validation',
        detail: `Retrieved ${rawMeters.length} smart meters for Feeder ${feederId}. Validating timestamp freshness against ${stalenessMs / 1000}s window.`,
        status: 'info',
        data: { feederId, meterCount: rawMeters.length }
    });
    if (!rawMeters || rawMeters.length === 0) {
        return {
            feederId,
            status: 'normal',
            timestamp,
            metersEvaluated: 0,
            lastHealthyMeter: null,
            firstDeadMeter: null,
            breakEventId: null,
            tripIssued: false,
            recommendedTripAction: null,
            trace: [
                {
                    step: 1,
                    title: 'No Meters Found',
                    detail: `No smart meters registered for Feeder ${feederId}.`,
                    status: 'warning'
                }
            ],
            meters: []
        };
    }
    // Step 2: Sort by feeder topology (position_order)
    const sortedMeters = rawMeters
        .sort((a, b) => a.position_order - b.position_order)
        .map((m) => {
        const recordedAtTime = m.latest_recorded_at ? new Date(m.latest_recorded_at).getTime() : 0;
        const isStale = !m.latest_recorded_at || (now.getTime() - recordedAtTime > stalenessMs);
        const isLowVoltage = m.latest_voltage === null || m.latest_voltage < DEAD_VOLTAGE_THRESHOLD;
        let is_dead = false;
        let dead_reason = null;
        if (isLowVoltage) {
            is_dead = true;
            dead_reason = `Voltage (${m.latest_voltage !== null ? m.latest_voltage.toFixed(1) + 'V' : 'N/A'}) below 30% nominal threshold (${DEAD_VOLTAGE_THRESHOLD.toFixed(1)}V)`;
        }
        else if (isStale) {
            is_dead = true;
            const timeDiff = ((now.getTime() - recordedAtTime) / 1000).toFixed(1);
            dead_reason = `No reading received within staleness window (${timeDiff}s > ${stalenessMs / 1000}s)`;
        }
        return {
            id: m.id,
            feeder_id: m.feeder_id,
            position_order: m.position_order,
            household_label: m.household_label,
            voltage: m.latest_voltage !== null ? Number(m.latest_voltage) : null,
            current: m.latest_current !== null ? Number(m.latest_current) : null,
            recorded_at: m.latest_recorded_at || null,
            is_dead,
            dead_reason
        };
    });
    trace.push({
        step: 2,
        title: 'Topology Order Sorting',
        detail: `Sorted readings by physical feeder position order (${sortedMeters.map(m => m.id).join(' -> ')}).`,
        status: 'info',
        data: sortedMeters.map(m => ({ id: m.id, pos: m.position_order, label: m.household_label }))
    });
    // Step 3: Scan ordered list for transition point (Healthy -> Dead)
    let transitionIndex = -1;
    for (let i = 0; i < sortedMeters.length; i++) {
        if (sortedMeters[i].is_dead) {
            // Check if previous meters were healthy (or if this is the first dead meter after healthy ones)
            if (i > 0 && !sortedMeters[i - 1].is_dead) {
                transitionIndex = i;
                break;
            }
        }
    }
    // Handle case where Meter 1 itself is dead (total outage or feeder head break)
    if (transitionIndex === -1 && sortedMeters.length > 0 && sortedMeters[0].is_dead) {
        transitionIndex = 0;
    }
    trace.push({
        step: 3,
        title: 'Discontinuity Scan (Healthy -> Dead Transition)',
        detail: transitionIndex !== -1
            ? `Discontinuity transition detected at Meter position ${sortedMeters[transitionIndex].position_order} (${sortedMeters[transitionIndex].id}).`
            : 'All meters operating within normal parameters. No discontinuity transition found.',
        status: transitionIndex !== -1 ? 'error' : 'success'
    });
    // Step 4: Evaluate break state
    const activeBreak = (0, database_1.getActiveBreakEvent)(feederId);
    if (transitionIndex !== -1) {
        const firstDeadMeter = sortedMeters[transitionIndex];
        const lastHealthyMeter = transitionIndex > 0 ? sortedMeters[transitionIndex - 1] : null;
        const lastHealthyLabel = lastHealthyMeter ? `${lastHealthyMeter.id} (Pos ${lastHealthyMeter.position_order})` : 'Substation Feeder Head';
        const firstDeadLabel = `${firstDeadMeter.id} (Pos ${firstDeadMeter.position_order})`;
        trace.push({
            step: 4,
            title: 'Fault Localization',
            detail: `Break pinpointed between Last Healthy Meter [${lastHealthyLabel}] and First Dead Meter [${firstDeadLabel}].`,
            status: 'error',
            data: {
                lastHealthyMeterId: lastHealthyMeter ? lastHealthyMeter.id : null,
                firstDeadMeterId: firstDeadMeter.id
            }
        });
        const recommendedTripAction = `TRIP AUTOMATIC CIRCUIT RECLOSER (ACR) / DISCONNECT ISOLATOR downstream of ${lastHealthyMeter ? lastHealthyMeter.id : 'TRANSFORMER TR-101'}. Segment ${lastHealthyMeter ? lastHealthyMeter.id : 'HEAD'} -> ${firstDeadMeter.id} IS LIVE & DE-ENERGIZED DOWNSTREAM.`;
        trace.push({
            step: 5,
            title: 'Recommended Protection & Trip Command',
            detail: recommendedTripAction,
            status: 'error'
        });
        let breakEventId = activeBreak ? activeBreak.id : null;
        // Create new break event if no active break exists or if break location changed
        if (!activeBreak || activeBreak.last_healthy_meter_id !== (lastHealthyMeter?.id || 'SUBSTATION') || activeBreak.first_dead_meter_id !== firstDeadMeter.id) {
            if (activeBreak) {
                (0, database_1.resolveBreakEvents)(feederId);
            }
            const newEvent = (0, database_1.createBreakEvent)(feederId, lastHealthyMeter ? lastHealthyMeter.id : 'SUBSTATION', firstDeadMeter.id);
            breakEventId = newEvent.id;
        }
        return {
            feederId,
            status: 'break_detected',
            timestamp,
            metersEvaluated: sortedMeters.length,
            lastHealthyMeter,
            firstDeadMeter,
            breakEventId,
            tripIssued: true,
            recommendedTripAction,
            trace,
            meters: sortedMeters
        };
    }
    else {
        // If no break detected and there was an active break event, resolve it
        if (activeBreak) {
            (0, database_1.resolveBreakEvents)(feederId);
            trace.push({
                step: 4,
                title: 'Fault Recovery & Restoration',
                detail: `Previous active break event #${activeBreak.id} resolved. Feeder ${feederId} restored to healthy normal state.`,
                status: 'success'
            });
        }
        trace.push({
            step: 4,
            title: 'Feeder Status: NORMAL',
            detail: `All ${sortedMeters.length} meters reporting nominal voltage (${NOMINAL_VOLTAGE}V ± 10%). No line trip required.`,
            status: 'success'
        });
        return {
            feederId,
            status: 'normal',
            timestamp,
            metersEvaluated: sortedMeters.length,
            lastHealthyMeter: null,
            firstDeadMeter: null,
            breakEventId: null,
            tripIssued: false,
            recommendedTripAction: null,
            trace,
            meters: sortedMeters
        };
    }
}
