import evaluateFormula from "../utils/evaluator";

// -------------- Random generator utilities (may want to seed if we you wanna lock-in) ------------------
function idxToColLabel(idx) {
  let n = idx;
  let col = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCellId(maxRows, maxCols) {
  const col = randomInt(1, maxCols);
  const row = randomInt(1, maxRows);
  return `${idxToColLabel(col)}${row}`;
}

// ---------- Sparse state helpers ----------

function makeEmptyState() {
  return Object.create(null); // don't inherit any extra methods, just bare empty state rather than {}
}

function setCellRaw(state, cellId, raw) {
  state[cellId] = { raw: String(raw), value: "", error: undefined };
}

function clearState(state) {
  for (const k of Object.keys(state)) {
    delete state[k];
  }
}

// ---------- Evaluator wrapper helpers ----------
function getValueFromState(state) {
  return function getValue(id) {
    const cell = state[id];
    if (!cell) {
      return "";
    }
    return cell.value ?? "";
  };
}

/*
 * recomputeAll:
 * - Iteratively evaluates all non-empty cells until stabilization or iteration cap.
 * - Returns an object with stats: { iterations, timeMs, validCount, errorCount }
 */
function recomputeAll(state, opts = {}) {
  const maxIterations = opts.maxIterations ?? 1000;
  const cellIds = () => {
    return Object.keys(state);
  }
  const getValue = getValueFromState(state);

  const start = performance.now();
  let iterations = 0;
  let changed = true;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations += 1;

    // Evaluate all cells (order doesn't matter because we iterate until stability)
    for (const id of cellIds()) {
      const entry = state[id];
      if (!entry) {
        continue;
      }
      const raw = String(entry.raw ?? "");

      if (!raw.startsWith("=")) {
        // plain raw value: set value to raw (string)
        const newVal = raw;
        if (entry.value !== newVal || entry.error !== undefined) {
          entry.value = newVal;
          entry.error = undefined;
          changed = true;
        }
      } else {
        // formula: evaluate using evaluator
        try {
          const res = evaluateFormula(raw, getValue);
          if ("error" in res) {
            if (entry.value !== res.error || entry.error !== res.error) {
              entry.value = res.error;
              entry.error = res.error;
              changed = true;
            }
          } else {
            // evaluator returns value number|string
            const valStr = String(res.value);
            if (entry.value !== valStr || entry.error !== undefined) {
              entry.value = valStr;
              entry.error = undefined;
              changed = true;
            }
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          if (entry.value !== "#ERROR" || entry.error !== err) {
            entry.value = "#ERROR";
            entry.error = err;
            changed = true;
          }
        }
      }
    }
  }

  const end = performance.now();

  // compute stats
  let validCount = 0;
  let errorCount = 0;
  for (const id of Object.keys(state)) {
    if (state[id].error) {
      errorCount += 1;
    } else {
      validCount += 1;
    }
  }

  return {
    iterations,
    timeMs: end - start,
    validCount,
    errorCount,
    totalCells: Object.keys(state).length,
  };
}

// ---------- Random content generators ----------
function randomNumberRaw() {
  return String(randomInt(0, 1000));
}

function randomArithmeticFormula(existingIds = [], maxRefs = 2) {
  if (!existingIds || existingIds.length === 0) {
    console.log('Reverted to simple numeric evaluation')
    return `=${randomInt(1, 10)}+${randomInt(1, 10)}`;
  }
  const refs = [];
  const k = Math.min(maxRefs, Math.max(1, Math.floor(Math.random() * (maxRefs + 1))));
  for (let i = 0; i < k; i++) {
    refs.push(existingIds[randomInt(0, existingIds.length - 1)]);
  }
  return `=${refs.join("+")}`;
}

function randomRangeFormula(existingIds = [], maxRangeSize = 5) {
  const pick = () => {
    return existingIds[randomInt(0, existingIds.length - 1)];
  }
  if (!existingIds || existingIds.length < 2) {
    return "=SUM(A1:A3)";
  }
  // try build a range from two existing ids if possible (best-effort)
  const a = pick();
  const b = pick();

  // if picks equal or invalid, fallback
  if (!a || !b) {
    return "=SUM(A1:A3)";
  }

  // extract col+row
  const mA = a.match(/^([A-Z]+)(\d+)$/);
  const mB = b.match(/^([A-Z]+)(\d+)$/);
  if (!mA || !mB) {
    return "=SUM(A1:A3)";
  }

  const colA = mA[1], rowA = parseInt(mA[2], 10);
  const colB = mB[1], rowB = parseInt(mB[2], 10);
  const start = Math.min(rowA, rowB);
  const end = Math.max(rowA, rowB);
  return `=SUM(${colA}${start}:${colB}${end})`;
}

function randomInvalidRaw() {
  const choices = ["=A1++B2", "=SUM()", "=UNKNOWN(1,2)", "=A9#999#99+1"];
  return choices[randomInt(0, choices.length - 1)];
}

// ---------- Primary test runner ----------
/*
 * runScaleSmokeTest(options)
 * options:
 *   rows, cols: grid dimensions (default 1000x1000)
 *   scales: array of filled-cell counts to test (default [10,100,1000,5000,10000])
 *   runsPerScale: how many times to repeat each scale for averaging
 *   seed: optional deterministic seed (not implemented here)
 *
 * Returns a Promise that resolves with results array.
 */
export async function runScaleSmokeTest(opts = {}) {
  const {
    rows = 1000,
    cols = 1000,
    scales = [10, 100, 1000, 5000, 10000],
    runsPerScale = 2,
    log = true,
  } = opts;

  const results = [];

  for (const scale of scales) {
    const runTimes = [];
    const runStats = [];

    for (let run = 0; run < runsPerScale; run++) {
      const state = makeEmptyState();
      const existingIds = [];

      // Populate `scale` distinct random cells
      const attempted = new Set();
      while (existingIds.length < scale) {
        const id = randomCellId(rows, cols);
        if (attempted.has(id)) continue;
        attempted.add(id);
        // choose what to insert
        const r = Math.random();
        if (r < 0.80) {
          // numeric
          setCellRaw(state, id, randomNumberRaw());
        } else if (r < 0.95) {
          // formula: either arithmetic or range-based
          if (existingIds.length >= 2 && Math.random() < 0.4) {
            setCellRaw(state, id, randomRangeFormula(existingIds));
          } else {
            setCellRaw(state, id, randomArithmeticFormula(existingIds));
          }
        } else {
          // invalid
          setCellRaw(state, id, randomInvalidRaw());
        }
        existingIds.push(id);
      }

      // measure recomputation (initial compute), like a true measure of eval speed
      const t0 = performance.now();
      const stats = recomputeAll(state, { maxIterations: 500 });
      const t1 = performance.now();

      runTimes.push(t1 - t0);
      runStats.push(stats);

      // optionally log a small sample
      if (log) {
        console.group(`Scale ${scale} run ${run + 1}`);
        console.log(`Filled cells: ${stats.totalCells}`);
        console.log(`Iterations: ${stats.iterations}`);
        console.log(`Time (ms): ${(t1 - t0).toFixed(2)}`);
        console.log(`Valid: ${stats.validCount}  Errors: ${stats.errorCount}`);

        // sample up to 8 cells to show output / errors
        const sample = existingIds.slice(0, Math.min(8, existingIds.length));
        for (const id of sample) {
          const e = state[id];
          console.log(id, { raw: e.raw, value: e.value, error: e.error });
        }
        console.groupEnd();
      }

      // line below gives a slight delay to allow UI to breathe if run from UI (button, etc)
      // await new Promise((r) => setTimeout(r, 10));
    } 

    // aggregate
    const avgTime = runTimes.reduce((a, b) => a + b, 0) / runTimes.length;
    const avgIter = runStats.reduce((a, b) => a + b.iterations, 0) / runStats.length;
    const avgValid = runStats.reduce((a, b) => a + b.validCount, 0) / runStats.length;
    const avgError = runStats.reduce((a, b) => a + b.errorCount, 0) / runStats.length;

    const res = {
      scale,
      runs: runsPerScale,
      avgTimeMs: avgTime,
      avgIterations: avgIter,
      avgValid: avgValid,
      avgError: avgError,
    };

    results.push(res);
    if (log) {
      console.group(`RESULT scale=${scale}`);
      console.log(res);
      console.groupEnd();
    }
  } // scales

  if (log) {
    console.table(results);
  }
  return results;
}

// default export convenience
export default runScaleSmokeTest;
