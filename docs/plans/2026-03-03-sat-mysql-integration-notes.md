# SAT Vertical Line MySQL Integration — Planning Notes

**Date**: 2026-03-03
**Status**: Discovery phase — need to explore database schema

---

## Context

SAT Italy has provided MySQL credentials to the database that runs the vertical powder coating line. This database contains real-time production data that is currently not captured in the ERP.

## Data of Interest

1. **Production/batch data** — batch records, line speed, parts processed, start/end times, powder usage
2. **Oven/cure data** — temperatures, cure times, PMT readings, oven zone data
3. **Recipes/programs** — coating programs, color recipes, parameter settings
4. **Alarms/events** — equipment alarms, fault logs, production events, downtime records

All of the above is valuable for **job costing** (actual material + time vs. estimates).

## Existing ERP Types That Map to SAT Data

| SAT Data | ERP Type (already exists) | Notes |
|----------|-------------------------|-------|
| Oven temperature + PMT | `OvenCureLog` | Has PMT, time-at-temp, cure window pass/fail fields |
| Batch records | `Batch` | Has `powderLotNumber`, `ovenCureLogId` linkage |
| Cure compliance | `ComplianceStandard` | AAMA 2603/2604/2605, Qualicoat, etc. |
| DFT readings | `MilThicknessReading` | Multi-point DFT per ISO 2360 |
| Equipment alarms | `MaintenanceTask` | Could create alert-type work orders |

## Architecture (Preliminary)

- **Sync direction**: One-way read (SAT MySQL → ERP Postgres)
- **Where it runs**: ROG PC (same LAN as SAT line controller)
- **How**: Scheduled Node.js/Deno script or Supabase Edge Function that connects to SAT MySQL, reads new records since last sync, transforms + inserts into ERP Postgres
- **Frequency**: Every 5-15 minutes for production data, hourly for recipes/alarms
- **Conflict policy**: SAT is the source of truth for production data (no edits in ERP)

## Visicoat

SAT's Visicoat coating management software may have additional data (color management, recipe library, quality data). Need to understand:
- Is Visicoat data in the same MySQL database or a separate system?
- What tables/data does Visicoat add beyond the PLC/SCADA data?

## Next Steps

1. [ ] Get MySQL connection details (host, port, user, password, database name)
2. [ ] Connect and run schema exploration (SHOW TABLES, DESCRIBE, sample SELECTs)
3. [ ] Map SAT tables → ERP types
4. [ ] Design sync service (frequency, error handling, conflict resolution)
5. [ ] Build sync service on ROG PC
6. [ ] Wire production data into existing ERP views (Costing, Quality, Equipment)

## Connection Details

```
Host:     ___________
Port:     3306 (default MySQL)
Username: ___________
Password: ___________
Database: ___________
```

(Fill in when ready to explore)
