# Prometheus Energy API Handoff

This document summarizes the findings needed to create a backend API for a web app that shows energy-transfer/device telemetry. The previous web prototype used an export from the Fabric flat table, but the planned API should read live time-series data from Prometheus.

## Goal

Create an API that reads telemetry from Prometheus and returns web-friendly JSON for dashboards/charts about energy transfer and device state.

Recommended flow:

```text
Prometheus HTTP API
  -> backend API
  -> web frontend / Lovable app
```

Prometheus should be treated as a time-series data source, not as a relational table source.

## Connection Details

Prometheus base URL:

```text
http://51.12.222.74:8080/prometheus
```

Loki base URL, useful for logs/debugging:

```text
http://51.12.222.74:8080/loki
```

Authentication:

```text
Basic auth
Username: moredevs
Password: store in environment variable, do not hardcode
```

Suggested environment variables:

```bash
PROMETHEUS_BASE_URL=http://51.12.222.74:8080/prometheus
LOKI_BASE_URL=http://51.12.222.74:8080/loki
PROMETHEUS_USERNAME=moredevs
PROMETHEUS_PASSWORD=<secret>
```

## Discovered Instance

The currently visible instance/host is:

```text
rpi-m1-ac-14-006
```

Prometheus labels:

```text
instance = rpi-m1-ac-14-006
host_name = rpi-m1-ac-14-006
```

Prometheus jobs found for this instance:

```text
elonroad-datacore
localstaticsupport
```

Loki labels found:

```text
host_name
job
service_name
unit
```

Important observation:

```text
/prometheus/api/v1/targets returned no active targets
up returned an empty result
```

However, Prometheus does contain current metric data. This likely means the data is ingested via OpenTelemetry / remote-write style ingestion rather than normal Prometheus scraping. Do not rely on `up` for instance health.

## Prometheus Queries Used During Discovery

List instances:

```promql
label_values(instance)
```

HTTP API:

```bash
curl -s -u "$PROMETHEUS_USERNAME:$PROMETHEUS_PASSWORD" \
  "$PROMETHEUS_BASE_URL/api/v1/label/instance/values"
```

Count current series for the instance:

```promql
count({instance="rpi-m1-ac-14-006"})
```

At the time of discovery this returned:

```text
207 current series
```

Get raw current series:

```promql
{instance="rpi-m1-ac-14-006"}
```

Group current series by metric and job:

```promql
count by (__name__, job) ({instance="rpi-m1-ac-14-006"})
```

Group current series by job:

```promql
count by (job) ({instance="rpi-m1-ac-14-006"})
```

## Important Difference From Fabric Flat Table

The Fabric flat table is event-derived and contains columns such as:

```text
Timestamp
EventDate
DeviceId
RemoteDeviceId
Start
End
S_Wind_kWh
S_Solar_kWh
S_Hydro_kWh
S_Unknown_kWh
S_TotalEnergy_kWh
R_Wind_kWh
R_Solar_kWh
R_Hydro_kWh
R_Unknown_kWh
R_TotalEnergy_kWh
PeakSuppliedPower_Watts
PeakReceivedPower_Watts
LocalSoCRangeMin_Percent
LocalSoCRangeMax_Percent
RemoteSoCRangeMin_Percent
RemoteSoCRangeMax_Percent
VoltageRangeMin_Volts
VoltageRangeMax_Volts
```

Those exact flat-table transfer-session fields were not found as Prometheus metrics. Prometheus currently exposes live device/AC telemetry instead.

Conclusion:

```text
The new API can provide live energy/device telemetry from Prometheus,
but it cannot reproduce the exact Fabric flat-table rows unless the app exports those event/session fields as Prometheus metrics.
```

## Energy-Related Prometheus Metrics Found

Metrics discovered matching energy/device terms:

```text
elonroad_ac_auxiliary_voltage_volts
elonroad_ac_battery_current_amperes
elonroad_ac_battery_state_of_charge_ratio
elonroad_ac_battery_voltage_volts
elonroad_ac_beacon_distance_meters
elonroad_ac_ccs_state_ratio
elonroad_ac_collector_actual_position_front_horizontal_ratio
elonroad_ac_collector_actual_position_vertical_ratio
elonroad_ac_collector_motor_current_amperes
elonroad_ac_collector_motor_output_voltage_volts
elonroad_ac_collector_motor_relay_ratio
elonroad_ac_collector_state_ratio
elonroad_ac_contactor_charge_controller_closed_ratio
elonroad_ac_dc_meter_current_amperes
elonroad_ac_dc_meter_input_joules_total
elonroad_ac_dc_meter_voltage_volts
elonroad_ac_energy_link_demand_current_amperes
elonroad_ac_energy_link_demand_voltage_volts
elonroad_ac_energy_link_state_ratio
elonroad_ac_energy_link_storage_state_of_charge_ratio
elonroad_ac_ignition_on_ratio
elonroad_ac_movement_disabled_ratio
elonroad_ac_state_ratio
```

Closest metric for energy transferred:

```promql
elonroad_ac_dc_meter_input_joules_total{instance="rpi-m1-ac-14-006"}
```

During discovery this metric existed but current value was `0` for the visible instance. Historical range queries may still show useful values depending on the selected time window.

## Recommended Prometheus Expressions

Energy meter total in kWh:

```promql
elonroad_ac_dc_meter_input_joules_total{instance="rpi-m1-ac-14-006"} / 3600000
```

Energy increase over a selected range, in kWh:

```promql
increase(elonroad_ac_dc_meter_input_joules_total{instance="rpi-m1-ac-14-006"}[24h]) / 3600000
```

Current voltage:

```promql
elonroad_ac_dc_meter_voltage_volts{instance="rpi-m1-ac-14-006"}
```

Current amperage:

```promql
elonroad_ac_dc_meter_current_amperes{instance="rpi-m1-ac-14-006"}
```

Estimated current power in watts:

```promql
elonroad_ac_dc_meter_voltage_volts{instance="rpi-m1-ac-14-006"}
*
elonroad_ac_dc_meter_current_amperes{instance="rpi-m1-ac-14-006"}
```

Battery state of charge as percent:

```promql
elonroad_ac_battery_state_of_charge_ratio{instance="rpi-m1-ac-14-006"} * 100
```

Battery voltage:

```promql
elonroad_ac_battery_voltage_volts{instance="rpi-m1-ac-14-006"}
```

Battery current:

```promql
elonroad_ac_battery_current_amperes{instance="rpi-m1-ac-14-006"}
```

Energy link demand voltage:

```promql
elonroad_ac_energy_link_demand_voltage_volts{instance="rpi-m1-ac-14-006"}
```

Energy link demand current:

```promql
elonroad_ac_energy_link_demand_current_amperes{instance="rpi-m1-ac-14-006"}
```

Energy link storage state of charge:

```promql
elonroad_ac_energy_link_storage_state_of_charge_ratio{instance="rpi-m1-ac-14-006"} * 100
```

AC/device state metrics:

```promql
elonroad_ac_state_ratio{instance="rpi-m1-ac-14-006"}
elonroad_ac_collector_state_ratio{instance="rpi-m1-ac-14-006"}
elonroad_ac_energy_link_state_ratio{instance="rpi-m1-ac-14-006"}
elonroad_ac_ccs_state_ratio{instance="rpi-m1-ac-14-006"}
```

These state metrics include labels such as:

```text
elonroad_ac_state_name
elonroad_ac_collector_state_name
elonroad_ac_energy_link_state_name
elonroad_ac_ccs_state_name
```

Observed state label values included:

```text
UndockFailed
WaitingForCollector
Unknown
Undocking
Disconnected
ReadyForNewSession
```

Do not assume the numeric values are boolean without validating the instrumentation semantics.

## Prometheus HTTP API Usage

Instant query:

```http
GET /api/v1/query?query=<promql>
```

Range query:

```http
GET /api/v1/query_range?query=<promql>&start=<rfc3339-or-unix>&end=<rfc3339-or-unix>&step=<duration>
```

Example range query:

```bash
curl -G -s -u "$PROMETHEUS_USERNAME:$PROMETHEUS_PASSWORD" \
  --data-urlencode 'query=elonroad_ac_dc_meter_input_joules_total{instance="rpi-m1-ac-14-006"} / 3600000' \
  --data-urlencode 'start=2026-05-19T00:00:00Z' \
  --data-urlencode 'end=2026-05-20T00:00:00Z' \
  --data-urlencode 'step=60s' \
  "$PROMETHEUS_BASE_URL/api/v1/query_range"
```

Example current telemetry query:

```bash
curl -G -s -u "$PROMETHEUS_USERNAME:$PROMETHEUS_PASSWORD" \
  --data-urlencode 'query={instance="rpi-m1-ac-14-006", __name__=~"elonroad_ac_.*"}' \
  "$PROMETHEUS_BASE_URL/api/v1/query"
```

## Recommended Backend API Endpoints

Instances:

```http
GET /api/instances
```

Suggested behavior:

Use Prometheus label values:

```http
GET $PROMETHEUS_BASE_URL/api/v1/label/instance/values
```

Return:

```json
{
  "instances": [
    {
      "id": "rpi-m1-ac-14-006",
      "hostName": "rpi-m1-ac-14-006"
    }
  ]
}
```

Current device snapshot:

```http
GET /api/device/status?instance=rpi-m1-ac-14-006
```

Should return latest values for voltage, current, estimated power, SoC, state labels, and timestamp.

Example response shape:

```json
{
  "instance": "rpi-m1-ac-14-006",
  "timestamp": "2026-05-20T11:40:20Z",
  "voltageVolts": 0,
  "currentAmperes": 0,
  "estimatedPowerWatts": 0,
  "batterySocPercent": 0,
  "batteryVoltageVolts": 0,
  "batteryCurrentAmperes": 0,
  "energyLinkDemandVoltageVolts": 0,
  "energyLinkDemandCurrentAmperes": 0,
  "states": {
    "ac": "UndockFailed",
    "collector": "Unknown",
    "energyLink": "Disconnected",
    "ccs": "ReadyForNewSession"
  }
}
```

Energy summary:

```http
GET /api/energy/summary?instance=rpi-m1-ac-14-006&from=2026-05-19T00:00:00Z&to=2026-05-20T00:00:00Z
```

Should use `increase(...[range]) / 3600000` or query range data and calculate from samples server-side.

Example response shape:

```json
{
  "instance": "rpi-m1-ac-14-006",
  "from": "2026-05-19T00:00:00Z",
  "to": "2026-05-20T00:00:00Z",
  "energyTransferredKWh": 0,
  "peakEstimatedPowerWatts": 0,
  "averageEstimatedPowerWatts": 0,
  "minBatterySocPercent": 0,
  "maxBatterySocPercent": 0
}
```

Energy/time-series chart data:

```http
GET /api/energy/timeseries?instance=rpi-m1-ac-14-006&from=2026-05-19T00:00:00Z&to=2026-05-20T00:00:00Z&step=60s
```

Recommended returned series:

```json
{
  "instance": "rpi-m1-ac-14-006",
  "from": "2026-05-19T00:00:00Z",
  "to": "2026-05-20T00:00:00Z",
  "step": "60s",
  "series": {
    "energyKWh": [
      { "timestamp": "2026-05-19T00:00:00Z", "value": 0 }
    ],
    "estimatedPowerWatts": [
      { "timestamp": "2026-05-19T00:00:00Z", "value": 0 }
    ],
    "voltageVolts": [
      { "timestamp": "2026-05-19T00:00:00Z", "value": 0 }
    ],
    "currentAmperes": [
      { "timestamp": "2026-05-19T00:00:00Z", "value": 0 }
    ],
    "batterySocPercent": [
      { "timestamp": "2026-05-19T00:00:00Z", "value": 0 }
    ]
  }
}
```

Raw metric passthrough for debugging:

```http
GET /api/prometheus/query?query=<promql>
GET /api/prometheus/query-range?query=<promql>&from=<date>&to=<date>&step=60s
```

This is optional. If implemented, protect it carefully or allow only whitelisted queries.

## Backend Implementation Notes

Use Basic Auth when calling Prometheus.

Never expose Prometheus credentials to the frontend.

Validate user input:

```text
instance must be from /api/instances
from/to must be valid dates
step must be constrained, for example 10s, 30s, 60s, 5m, 1h
range must be capped to avoid expensive Prometheus queries
```

Recommended default step selection:

```text
<= 6 hours: 30s or 60s
<= 24 hours: 60s or 5m
<= 7 days: 15m
> 7 days: 1h
```

Prometheus returns timestamps as Unix seconds. Convert them to ISO 8601 strings before returning to the web.

Prometheus values are strings. Convert numeric values to numbers in the API response.

For counters such as `elonroad_ac_dc_meter_input_joules_total`, prefer `increase()` over subtracting first/last samples manually, because `increase()` handles counter resets better.

For calculated power, multiplication of voltage and current can be done either in PromQL or server-side after fetching both series. PromQL is simpler:

```promql
elonroad_ac_dc_meter_voltage_volts{instance="<instance>"}
*
elonroad_ac_dc_meter_current_amperes{instance="<instance>"}
```

## Loki Debugging Queries

Loki host values:

```bash
curl -s -u "$PROMETHEUS_USERNAME:$PROMETHEUS_PASSWORD" \
  "$LOKI_BASE_URL/api/v1/label/host_name/values"
```

Recent logs for host:

```bash
curl -G -s -u "$PROMETHEUS_USERNAME:$PROMETHEUS_PASSWORD" \
  --data-urlencode 'query={host_name="rpi-m1-ac-14-006"}' \
  --data-urlencode 'limit=50' \
  --data-urlencode 'direction=BACKWARD' \
  "$LOKI_BASE_URL/api/v1/query_range"
```

Observed Loki streams included:

```text
datacoremachine.service
coremachine.service
ssh.service
cron.service
dbus.service
systemd-logind.service
ens.service
bluetooth.service
user@1000.service
```

## Fabric Context Only

The previous data source for the web prototype was an export from this Fabric flat table:

```text
EnergyNetworkTransferSessionEvent_Flat
```

Its construction chain in Fabric:

```text
EnmsExportStream_Events-ExportEvent
  -> ExportEvent
  -> EnergyNetworkTransferSessionEvent
  -> EnergyNetworkTransferSessionEvent_Flat
```

The `ExportEvent` ingestion mapping:

```json
[
  { "column": "Name", "path": "$.Name" },
  { "column": "Payload", "path": "$.Payload" }
]
```

`EnergyNetworkTransferSessionEvent` is populated from `ExportEvent` using update policy function:

```text
Get_EnergyNetworkTransferSessionEvents
```

It filters only:

```kusto
Name startswith "EnergyNetworkTransferSessionsEvent_"
```

Then it expands:

```kusto
Payload.DetSessions.EtSessions
```

`EnergyNetworkTransferSessionEvent_Flat` is populated from `EnergyNetworkTransferSessionEvent` using update policy function:

```text
Get_EnergyNetworkTransferSessionEvent_Flat
```

That function parses `SuppliedEnergy` and `ReceivedEnergy` and aggregates energy mix into columns by source.

This Fabric lineage is useful for understanding the old export, but the new API should not assume Prometheus can return the same event rows.

## Suggested First API Version

Build the first version around the metrics that definitely exist:

```text
instances
current status
energy kWh over time
voltage over time
current over time
estimated power over time
battery SoC over time
state labels
```

Minimum useful endpoints:

```text
GET /api/instances
GET /api/device/status
GET /api/energy/summary
GET /api/energy/timeseries
```

Minimum required Prometheus metrics:

```text
elonroad_ac_dc_meter_input_joules_total
elonroad_ac_dc_meter_voltage_volts
elonroad_ac_dc_meter_current_amperes
elonroad_ac_battery_state_of_charge_ratio
elonroad_ac_state_ratio
elonroad_ac_collector_state_ratio
elonroad_ac_energy_link_state_ratio
elonroad_ac_ccs_state_ratio
```

If the product needs exact session-level rows like the Fabric flat table, the backend must either:

```text
1. read from Fabric/KQL instead of Prometheus, or
2. add new application instrumentation that exports transfer-session fields as Prometheus metrics.
```
