// =========================================================
//  Entry point — loads data, hands off to each section
// =========================================================

import {
  STATES, STATE_FP, FP_TO_STATE, MONTH_NAMES,
  coerceState, coerceCounty
} from './utils.js';

import { initIntroMap }        from './sections/intro-map.js';
import { initReveal }          from './sections/reveal.js';
import { initTimeMachine }     from './sections/time-machine.js';
import { initRadial }          from './sections/radial.js';
import { initScatter }         from './sections/scatter.js';
import { initDayNight }        from './sections/day-night.js';

// --- CDN: us-atlas counties + states topojson ---
const US_TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

async function loadAll() {
  const [stateData, countyData, usTopo] = await Promise.all([
    d3.csv('data/state_data.csv',  coerceState),
    d3.csv('data/county_data.csv', coerceCounty),
    d3.json(US_TOPO_URL),
  ]);

  return { stateData, countyData, usTopo };
}

function filterTopoToThreeStates(usTopo) {
  // counties geometry
  const countiesGeo = topojson.feature(usTopo, usTopo.objects.counties);
  const statesGeo   = topojson.feature(usTopo, usTopo.objects.states);

  const wantedFPs = new Set(Object.values(STATE_FP));

  const counties = {
    ...countiesGeo,
    features: countiesGeo.features.filter(f => {
      const fp = String(f.id).padStart(5, '0').slice(0, 2);
      return wantedFPs.has(fp);
    })
  };

  const states = {
    ...statesGeo,
    features: statesGeo.features.filter(f => {
      const fp = String(f.id).padStart(2, '0');
      return wantedFPs.has(fp);
    })
  };

  // Per-state county groups (for separate map panels)
  const countiesByState = {};
  STATES.forEach(s => {
    const fp = STATE_FP[s];
    countiesByState[s] = {
      type: 'FeatureCollection',
      features: counties.features.filter(f => {
        const ff = String(f.id).padStart(5, '0').slice(0, 2);
        return ff === fp;
      })
    };
  });

  // State outline polygons indexed by state name
  const stateOutlines = {};
  STATES.forEach(s => {
    const fp = STATE_FP[s];
    stateOutlines[s] = states.features.find(f =>
      String(f.id).padStart(2, '0') === fp
    );
  });

  return { counties, states, countiesByState, stateOutlines, allStates: statesGeo };
}

// Build helper lookups so sections can quickly find data by (state, month) etc.
function buildIndex(countyData, stateData) {
  // by GEOID -> array of 12 monthly records (sorted)
  const byGeoid = d3.group(countyData, d => d.GEOID);
  for (const arr of byGeoid.values()) arr.sort((a, b) => a.month - b.month);

  // by (state, month) -> array of county records
  const byStateMonth = new Map();
  for (const d of countyData) {
    const key = d.state + '|' + d.month;
    if (!byStateMonth.has(key)) byStateMonth.set(key, []);
    byStateMonth.get(key).push(d);
  }

  // by state -> array of 12 monthly state-level records
  const stateByName = d3.group(stateData, d => d.state);
  for (const arr of stateByName.values()) arr.sort((a, b) => a.month - b.month);

  return { byGeoid, byStateMonth, stateByName };
}

async function main() {
  try {
    const { stateData, countyData, usTopo } = await loadAll();
    const geo   = filterTopoToThreeStates(usTopo);
    const index = buildIndex(countyData, stateData);

    const ctx = {
      stateData, countyData, geo, index,
      usAll: topojson.feature(usTopo, usTopo.objects.states),
    };

    // Initialize every section. Each one is responsible for its own DOM.
    initIntroMap(ctx);
    initReveal(ctx);
    initTimeMachine(ctx);
    initRadial(ctx);
    initScatter(ctx);
    initDayNight(ctx);

    console.log('[main] all sections initialized', {
      counties: countyData.length,
      states:   stateData.length,
    });
  } catch (err) {
    console.error('[main] failed to initialise', err);
    document.body.insertAdjacentHTML('afterbegin',
      `<div style="background:#C85A4D;color:white;padding:1rem;font-family:monospace">
        Failed to load data: ${err.message}
       </div>`);
  }
}

main();
