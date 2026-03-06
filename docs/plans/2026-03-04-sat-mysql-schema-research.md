# SAT MySQL Schema Research — Powder Coating Line Integration

> Research document for DECORA ERP ← SAT CUBE MySQL integration
> Generated: 2026-03-04

---

## 1. Overview

This document covers research into SAT Italy's CUBE line controller database schema,
common industrial MySQL patterns for powder coating lines, and practical data mapping
for job costing integration with the DECORA ERP.

The SAT vertical powder coating line uses a CUBE PC running VISICOAT software with a
MySQL/MariaDB backend. The goal is one-way, read-only sync of production data into
the ERP's Postgres database (Supabase) for job costing, quality correlation, and
analytics.

---

## 2. Inferred SAT MySQL Schema

SAT does not publish their database schema publicly. The following is inferred from:
- The existing ERP `SATBatchLog` and `VisicoatRecipe` TypeScript types
- The `LineProductionBoard.tsx` stage configurations
- Common patterns in European industrial automation (Italian/German systems)
- GEMA equipment manuals already processed into the ERP knowledge base

### Naming Conventions

European industrial automation vendors commonly use:
- **English table/column names** (SAT exports CSV with English headers)
- **Italian alternatives** in parentheses where they may appear
- **snake_case** column naming
- **INT AUTO_INCREMENT** primary keys
- **DATETIME** for timestamps (MySQL local time, not UTC)
- **DECIMAL** for temperatures and measurements

### Core Tables

#### `production_order` (or `ordine_produzione`)

The primary batch record — one row per coating run on the vertical line.

```sql
CREATE TABLE production_order (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  batch_code          VARCHAR(50) NOT NULL,          -- barcode scanned at loading
  order_code          VARCHAR(50),                   -- ERP job reference (if pushed)
  recipe_id           INT,                           -- FK to recipe table
  ral_code            VARCHAR(20),
  powder_type         VARCHAR(30),                   -- solid/metallic/matt/texture/glossy
  powder_supplier     VARCHAR(100),
  hook_count          INT,
  profile_count       INT,
  conveyor_speed_mmin DECIMAL(4,2),
  -- Timestamps
  first_load_at       DATETIME,
  last_load_at        DATETIME,
  booth_start_at      DATETIME,
  booth_end_at        DATETIME,
  oven_start_at       DATETIME,
  oven_end_at         DATETIME,
  unload_end_at       DATETIME,
  status              ENUM('pending','in_progress','complete','cancelled'),
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_batch (batch_code),
  INDEX idx_status (status),
  INDEX idx_date (created_at)
) ENGINE=InnoDB;
```

#### `recipe` (or `ricetta`)

VISICOAT coating recipe — gun parameters for a given RAL/powder/profile combination.

```sql
CREATE TABLE recipe (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(255) NOT NULL,
  profile_type        VARCHAR(100),                  -- extrusion profile name
  ral_code            VARCHAR(20) NOT NULL,
  ral_description     VARCHAR(100),
  powder_type         VARCHAR(30) NOT NULL,
  powder_supplier     VARCHAR(100),
  -- Gun parameters
  voltage_kv          DECIMAL(5,1),
  current_ua          DECIMAL(5,1),
  powder_output_gmin  DECIMAL(6,1),
  air_flow            DECIMAL(4,2),
  conveyor_speed_mmin DECIMAL(4,2),
  -- HMI notes
  booth_notes         TEXT,
  packing_notes       TEXT,
  is_active           TINYINT(1) DEFAULT 1,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_ral (ral_code),
  INDEX idx_active (is_active)
) ENGINE=InnoDB;
```

#### `zone_temperature` (or `temperatura_zona`)

Per-zone temperature summary for each batch — one row per zone per batch.

```sql
CREATE TABLE zone_temperature (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  batch_id            INT NOT NULL,
  zone_name           VARCHAR(50) NOT NULL,          -- degreasing/etching/chrome/drying/booth/polymerization
  temp_min_f          DECIMAL(6,1),
  temp_avg_f          DECIMAL(6,1),
  temp_max_f          DECIMAL(6,1),
  setpoint_f          DECIMAL(6,1),
  transit_time_sec    INT,
  logged_at           DATETIME,

  INDEX idx_batch (batch_id),
  INDEX idx_zone (zone_name)
) ENGINE=InnoDB;
```

#### `alarm_event` (or `evento_allarme`)

Equipment alarms and events logged by the CUBE controller.

```sql
CREATE TABLE alarm_event (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  event_time          DATETIME NOT NULL,
  event_type          ENUM('alarm','warning','info','reset'),
  source              VARCHAR(50),                   -- CM40/OC07/conveyor/oven/pretreat
  error_code          VARCHAR(20),
  severity            TINYINT,                       -- 1=critical, 2=major, 3=minor, 4=info
  message             TEXT,
  batch_id            INT,
  acknowledged        TINYINT(1) DEFAULT 0,
  resolved_at         DATETIME,

  INDEX idx_time (event_time),
  INDEX idx_severity (severity),
  INDEX idx_batch (batch_id)
) ENGINE=InnoDB;
```

#### `conveyor_log` (or `log_trasportatore`)

Real-time conveyor telemetry (if SAT logs this — may be PLC-only).

```sql
CREATE TABLE conveyor_log (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  logged_at           DATETIME NOT NULL,
  speed_mmin          DECIMAL(4,2),                  -- actual measured speed
  speed_setpoint_mmin DECIMAL(4,2),                  -- target speed
  encoder_position    BIGINT,                        -- CAN-Bus encoder pulses
  chain_load_pct      DECIMAL(5,1),                  -- drive load percentage
  batch_id            INT,

  INDEX idx_time (logged_at),
  INDEX idx_batch (batch_id)
) ENGINE=InnoDB;
```

#### `powder_consumption` (or `consumo_polvere`)

May be tracked at the OC07 level (powder hopper weight or bag count) or estimated.

```sql
CREATE TABLE powder_consumption (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  batch_id            INT NOT NULL,
  recipe_id           INT,
  powder_lot          VARCHAR(50),
  -- Weight tracking (if hopper has load cells)
  start_weight_kg     DECIMAL(8,2),
  end_weight_kg       DECIMAL(8,2),
  consumed_kg         DECIMAL(8,2),                  -- computed: start - end + refills
  refill_kg           DECIMAL(8,2),
  -- Calculated (from recipe params)
  estimated_kg        DECIMAL(8,2),
  transfer_efficiency DECIMAL(5,2),                  -- actual / theoretical * 100
  -- Virgin vs. reclaim ratio
  virgin_pct          DECIMAL(5,1),
  reclaim_pct         DECIMAL(5,1),
  logged_at           DATETIME,

  INDEX idx_batch (batch_id)
) ENGINE=InnoDB;
```

#### `oven_profile` (or `profilo_forno`)

Detailed time-temperature curve data for cure oven.

```sql
CREATE TABLE oven_profile (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  batch_id            INT NOT NULL,
  oven_zone           VARCHAR(30),                   -- 'drying' or 'curing'
  logged_at           DATETIME NOT NULL,
  air_temp_f          DECIMAL(6,1),
  setpoint_f          DECIMAL(6,1),
  pmt_temp_f          DECIMAL(6,1),                  -- peak metal temperature
  burner_firing       TINYINT(1),
  burner_output_pct   DECIMAL(5,1),

  INDEX idx_batch_time (batch_id, logged_at)
) ENGINE=InnoDB;
```

---

## 3. Data Fields Most Valuable for Job Costing

### 3.1 Time Per Batch/Job

| SAT Data Point | Source Table | ERP Use |
|---------------|-------------|---------|
| `first_load_at` to `unload_end_at` | `production_order` | Total elapsed time per batch |
| `booth_start_at` to `booth_end_at` | `production_order` | Coating cycle time |
| `oven_start_at` to `oven_end_at` | `production_order` | Cure cycle time |
| Transit times per zone | `zone_temperature` | Identify bottlenecks |
| Conveyor speed | `production_order` | Throughput rate (profiles/hour) |

**Job costing formula:**
```
Labor cost = (unload_end_at - first_load_at) * (labor_rate * operator_count)
Line time cost = elapsed_hours * line_overhead_rate_per_hour
```

### 3.2 Powder Usage Per Job

| SAT Data Point | Source | ERP Use |
|---------------|--------|---------|
| `consumed_kg` | `powder_consumption` | Direct material cost per batch |
| `transfer_efficiency` | `powder_consumption` | Waste tracking |
| `virgin_pct` / `reclaim_pct` | `powder_consumption` | Reclaim efficiency |

**Job costing formula:**
```
Powder cost = consumed_kg * powder_price_per_kg
```

If no load cells, estimate:
```
estimated_kg = profile_count * avg_surface_area_m2 * target_dft_um * powder_density_factor
```
Where `powder_density_factor` is typically 1.4-1.8 g/m2/um for standard polyester.

### 3.3 Energy Consumption Correlations

SAT doesn't directly meter gas/electricity per batch. Practical approach:
- Install pulse-output gas submeters on each burner gas line
- Install pulse-output kWh meters on conveyor, booth, and oven circuits
- Log pulses against SAT batch start/end timestamps

### 3.4 Rework/Reject Tracking

SAT doesn't track rework directly. ERP correlates:
- QC rejection in ERP → link to `SATBatchLog.id` → retrieve all process params
- Root cause analysis → query zone temps, cure times for rejected batch
- Rework cost → track re-run as new SAT batch linked to same ERP job

### 3.5 Throughput Metrics

```
Hooks per hour = hook_count / elapsed_hours
Line utilization = sum(batch_time) / shift_time * 100
Color change time = next.first_load - prev.unload_end
OEE = availability * performance * quality
```

---

## 4. Existing ERP Types That Map to SAT Data

| ERP Type | File | Maps to SAT Table |
|----------|------|-------------------|
| `SATBatchLog` | `src/types/index.ts:2433` | `production_order` + `zone_temperature` |
| `VisicoatRecipe` | `src/types/index.ts:2392` | `recipe` + `profile` |
| `OvenCureLog` | `src/types/index.ts:1818` | `oven_profile` (detailed cure curve) |
| `Batch` | `src/types/index.ts:411` | `production_order` (ERP-side batch) |
| `Job.satBatchCode` | `src/types/index.ts:346` | `production_order.batch_code` join key |
| `Job.satBatchLogId` | `src/types/index.ts:354` | `production_order.id` after import |

---

## 5. MySQL to Postgres Sync Options

### Option A: Periodic CSV Import (Current Path -- Low Risk)

SAT writes `orders.csv` on batch close. Already partially implemented:
- `SATBatchLog` type exists
- `ADD_SAT_BATCH_LOG` dispatch exists

**Recommended for Phase 1.**

### Option B: Lightweight Polling Agent (Recommended for Phase 2)

A small service on the plant LAN reads new rows from SAT MySQL via read-only user
and writes to Supabase via REST API. No binlog access needed.

### Option C: Debezium CDC

Overkill for single-line install. Consider only if real-time monitoring needed.

### Option D: SAT-Side Triggers

Requires SAT cooperation to modify their database. SAT may object.

### Recommendation

- **Phase 1 (now):** CSV import. Zero risk. SAT-supported.
- **Phase 2 (after schema discovery):** Polling agent. Read-only MySQL user.
- **Phase 3 (future):** Real-time monitoring via Debezium or OPC-UA if needed.

---

## 6. Next Steps / Action Items

1. **TeamViewer into SAT CUBE PC** -- Run `SHOW TABLES` and `SHOW CREATE TABLE` for
   each table. Compare actual schema against Section 2 above.

2. **Create a read-only MySQL user** on SAT database:
   ```sql
   CREATE USER 'erp_readonly'@'%' IDENTIFIED BY 'strong_password';
   GRANT SELECT ON SAT_DB.* TO 'erp_readonly'@'%';
   FLUSH PRIVILEGES;
   ```

3. **Export a sample `orders.csv`** from VISICOAT Production screen and compare columns.

4. **Contact SAT Italy** requesting:
   - MySQL schema documentation for the CUBE controller
   - Any published API or integration guide for VISICOAT Advanced ERP mode
   - Confirmation of MySQL version and authentication method

5. **Implement Phase 1:** Automate CSV file watch + parse + POST cycle.

6. **Design the polling agent** as a Python or Node service for Phase 2.

7. **Install submetering** for gas and electricity to enable per-batch energy costing.

---

## 7. Job Cost Model (Complete)

```
Total Job Cost =
    Material (powder_consumed_kg * price_per_kg)
  + Labor ((unload_time - load_time) * crew_count * labor_rate)
  + Line Overhead (line_hours * line_rate_per_hour)
  + Pretreat Chemical (prorated per hook based on shift consumption)
  + Gas Energy (prorated per batch based on oven time and gas meter)
  + Electrical (prorated per batch based on conveyor time)
  + Rework (if re-run, add second pass cost)
```
