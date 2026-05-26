// =========================================================
//  Flagship: Time Machine — 3 state county choropleths
//  + month scrubber + play button + sparkline-on-hover
// =========================================================
import {
  STATES, STATE_FP, FP_TO_STATE, STATE_COLORS_DARK, STATE_CROP,
  VARIABLES, MONTH_NAMES, MONTH_SHORT,
  colorScaleFor, globalExtent, showTip, moveTip, hideTip
} from '../utils.js';

// ---------- Scrollytelling scenes ----------
const SCENES = [
  {
    month: 1, varKey: 'NDVI',
    eyebrow: 'January · Vegetation',
    title: 'The world is asleep.',
    body: 'In winter, the land is dormant across all three states. NDVI hovers near zero — there is nothing growing to see. But how each state begins its year already hints at the story to come.',
  },
  {
    month: 3, varKey: 'LST_Day',
    eyebrow: 'March · Daytime Temperature',
    title: 'The South wakes first.',
    body: 'By March, Texas counties already average 27 °C while Iowa hovers near freezing. The 17-degree gradient between Iowa and Texas is the largest of the entire year — and it dictates when each crop can begin.',
  },
  {
    month: 5, varKey: 'NDVI', focus: 'Kansas',
    eyebrow: 'May · Vegetation',
    title: 'Kansas wheat is first to peak.',
    body: 'Winter wheat planted last September is the only crop already mature. Kansas counties climb past NDVI 0.48 — far ahead of Iowa corn fields, which are still emerging seedlings.',
  },
  {
    month: 7, varKey: 'NDVI', focus: 'Iowa',
    eyebrow: 'July · Vegetation',
    title: 'The Iowa corn explosion.',
    body: 'July is corn\'s moment. Eastern Iowa counties shoot past NDVI 0.85 — rainforest-level greenness — while western Iowa trails near 0.55. A single state average of 0.84 hides a 0.30 gap inside the state itself.',
  },
  {
    month: 8, varKey: 'LST_Day', focus: 'Texas',
    eyebrow: 'August · Daytime Temperature',
    title: 'Texas bakes.',
    body: 'Cotton is heat-tolerant — but the average Texas daytime LST in August hits 41 °C, and West Texas climbs past 47 °C. The land surface is literally too hot to comfortably touch.',
  },
  {
    month: 10, varKey: 'Precipitation',
    eyebrow: 'October · Precipitation',
    title: 'The autumn rains shift south.',
    body: 'As Iowa harvests its corn and Kansas plants new winter wheat, the rain belt drifts toward Texas. Late-season moisture is critical for cotton boll development — without it, the year\'s yield collapses.',
  },
  {
    month: 7, varKey: 'NDVI', free: true,
    eyebrow: 'Your turn',
    title: 'Drive the time machine yourself.',
    body: 'Drag the month slider, switch variables, press play, hover any of the 458 counties to see its entire 12-month story below. The map will only update from the controls now — the story is yours.',
  },
];

export function initTimeMachine(ctx) {
  // ---------- DOM refs ----------
  const shell      = document.querySelector('.tm-shell');
  if (!shell) return;
  const playBtn    = document.getElementById('tm-play');
  const monthInput = document.getElementById('tm-month');
  const monthLbl   = document.getElementById('tm-month-label');
  const monthTicks = document.getElementById('month-ticks');
  const varBtns    = Array.from(document.querySelectorAll('.var-btn'));
  const legendBand = document.getElementById('tm-legend');
  const legendAxis = document.getElementById('tm-legend-axis');
  const hoverPanel = document.getElementById('tm-hover');

  // month ticks
  monthTicks.innerHTML = MONTH_SHORT.map(m => `<span>${m}</span>`).join('');

  // ---------- State ----------
  let varKey = 'NDVI';
  let month  = +monthInput.value;
  let playing = false;
  let playTimer = null;
  let activeGeoid = null;

  const renderers = {};   // { Iowa, Kansas, Texas }

  // ---------- Build each state map ----------
  function buildStateMap(stateName) {
    const wrapEl = document.querySelector(`#tm-${stateName.toLowerCase()} .tm-map`);
    wrapEl.innerHTML = '';
    const w = wrapEl.clientWidth;
    const h = wrapEl.clientHeight;

    const fc = ctx.geo.countiesByState[stateName];
    const outline = ctx.geo.stateOutlines[stateName];

    const svg = d3.select(wrapEl).append('svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('width', '100%').attr('height', '100%');

    // Project to bounds of this state alone — each map fills its own panel
    const projection = d3.geoMercator().fitSize([w - 4, h - 4], fc);
    const path = d3.geoPath(projection);

    const gCounties = svg.append('g');
    const gOutline  = svg.append('g');

    const sel = gCounties.selectAll('path.county')
      .data(fc.features, f => f.id)
      .join('path')
      .attr('class', 'county')
      .attr('d', path)
      .attr('vector-effect', 'non-scaling-stroke')
      .on('mouseenter', function (event, f) { handleHover(f.id, event); })
      .on('mousemove',  function (event, f) { handleTipMove(event, f); })
      .on('mouseleave', function () { handleHoverEnd(); });

    gOutline.append('path')
      .datum(outline)
      .attr('d', path)
      .attr('class', 'state-outline');

    renderers[stateName] = { svg, sel, gOutline, w, h, path };
  }

  function buildAll() {
    STATES.forEach(buildStateMap);
    drawLegend();
    update();
  }

  // ---------- Update colors ----------
  function update() {
    const v = VARIABLES[varKey];
    const [lo, hi] = globalExtent(ctx.countyData, varKey);
    const color = colorScaleFor(varKey, [lo, hi]);

    // GEOID -> value at current month
    const monthLookup = new Map();
    ctx.countyData.forEach(d => {
      if (d.month === month) monthLookup.set(d.GEOID, d[varKey]);
    });

    STATES.forEach(s => {
      const r = renderers[s];
      if (!r) return;
      r.sel
        .transition().duration(280)
        .attr('fill', f => {
          const val = monthLookup.get(String(f.id));
          return Number.isFinite(val) ? color(val) : '#DDD6C7';
        });
    });

    monthLbl.textContent = MONTH_NAMES[month - 1];

    // legend gradient + axis
    drawLegend([lo, hi], color);

    // refresh hover panel if a county is locked
    if (activeGeoid) renderSparkline(activeGeoid);
  }

  function drawLegend(domain, color) {
    const v = VARIABLES[varKey];
    if (!domain) {
      [domain] = [globalExtent(ctx.countyData, varKey)];
      color = colorScaleFor(varKey, domain);
    }
    // gradient as CSS
    const stops = [];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      stops.push(`${color(domain[0] + t * (domain[1] - domain[0]))} ${(t * 100).toFixed(0)}%`);
    }
    legendBand.style.background = `linear-gradient(to right, ${stops.join(', ')})`;

    // axis labels (4 ticks)
    const ticks = d3.ticks(domain[0], domain[1], 5);
    legendAxis.innerHTML = ticks.map(t => `<span>${v.fmt(t)}</span>`).join('');
  }

  // ---------- Hover sparkline ----------
  function handleHover(geoid, event) {
    activeGeoid = String(geoid);
    // highlight class
    STATES.forEach(s => {
      renderers[s].sel
        .classed('active', d => String(d.id) === activeGeoid);
    });
    renderSparkline(activeGeoid);
  }
  function handleHoverEnd() {
    activeGeoid = null;
    STATES.forEach(s => renderers[s].sel.classed('active', false));
    hideTip();
    renderPlaceholder();
  }
  function handleTipMove(event, f) {
    const arr = ctx.index.byGeoid.get(String(f.id));
    if (!arr) return;
    const rec = arr.find(d => d.month === month);
    if (!rec) return;
    showTip(`
      <div class="tt-title">${rec.county}, ${rec.state}</div>
      <div class="tt-row"><span class="lbl">${VARIABLES[varKey].short}</span><span>${VARIABLES[varKey].fmt(rec[varKey])}</span></div>
      <div class="tt-row"><span class="lbl">Month</span><span>${MONTH_NAMES[month - 1]}</span></div>
    `, event);
  }

  function renderPlaceholder() {
    hoverPanel.innerHTML = `<div class="hover-placeholder">Hover any county to reveal its full-year story →</div>`;
  }

  function renderSparkline(geoid) {
    const arr = ctx.index.byGeoid.get(String(geoid));
    if (!arr) return renderPlaceholder();

    const v = VARIABLES[varKey];
    const stateName = arr[0].state;
    const stateColor = STATE_COLORS_DARK[stateName];
    const cropName   = STATE_CROP[stateName];

    const cur = arr.find(d => d.month === month);
    const values = arr.map(d => d[varKey]).filter(Number.isFinite);
    const yMin = d3.min(values), yMax = d3.max(values);
    const yearMinRec = arr.reduce((acc, d) => (acc == null || d[varKey] < acc[varKey] ? d : acc), null);
    const yearMaxRec = arr.reduce((acc, d) => (acc == null || d[varKey] > acc[varKey] ? d : acc), null);

    hoverPanel.innerHTML = `
      <div class="hover-content">
        <div class="hover-meta">
          <h5 style="color:${stateColor}">${arr[0].county} County</h5>
          <span class="sub">${stateName} · ${cropName}</span>
          <div class="hover-stats">
            <div><small>${MONTH_SHORT[month - 1]} ${v.short}</small><span>${cur ? v.fmt(cur[varKey]) : '—'}</span></div>
            <div><small>Year min · ${yearMinRec ? MONTH_SHORT[yearMinRec.month - 1] : ''}</small><span>${v.fmt(yMin)}</span></div>
            <div><small>Year max · ${yearMaxRec ? MONTH_SHORT[yearMaxRec.month - 1] : ''}</small><span>${v.fmt(yMax)}</span></div>
          </div>
        </div>
        <div class="hover-spark" id="hover-spark"></div>
      </div>
    `;

    const sparkEl = document.getElementById('hover-spark');
    const w = sparkEl.clientWidth || 340;
    const h = 90;
    const m = { t: 8, r: 10, b: 18, l: 32 };

    const svg = d3.select(sparkEl).append('svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('width', '100%').attr('height', h);

    const x = d3.scaleLinear().domain([1, 12]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([h - m.b, m.t]);

    // x axis: month ticks
    const xAxis = svg.append('g').attr('transform', `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d => MONTH_SHORT[d - 1]).tickSize(0))
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', 9)
      .attr('color', '#8A8A8A');
    xAxis.select('.domain').remove();

    // y axis
    const yAxis = svg.append('g').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(3).tickFormat(v.fmt).tickSize(-(w - m.l - m.r)))
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', 9)
      .attr('color', '#8A8A8A');
    yAxis.select('.domain').remove();
    yAxis.selectAll('.tick line').attr('stroke', '#E3DCCE').attr('stroke-dasharray', '2 3');

    // area
    const area = d3.area()
      .x(d => x(d.month))
      .y0(h - m.b)
      .y1(d => y(d[varKey]))
      .curve(d3.curveMonotoneX);
    svg.append('path')
      .datum(arr)
      .attr('fill', stateColor)
      .attr('fill-opacity', 0.14)
      .attr('d', area);

    // line
    const line = d3.line()
      .x(d => x(d.month))
      .y(d => y(d[varKey]))
      .curve(d3.curveMonotoneX);
    svg.append('path')
      .datum(arr)
      .attr('fill', 'none')
      .attr('stroke', stateColor)
      .attr('stroke-width', 2)
      .attr('d', line);

    // all dots
    svg.append('g').selectAll('circle')
      .data(arr).join('circle')
      .attr('cx', d => x(d.month))
      .attr('cy', d => y(d[varKey]))
      .attr('r', d => d.month === month ? 5 : 2.5)
      .attr('fill', d => d.month === month ? stateColor : '#FFF')
      .attr('stroke', stateColor)
      .attr('stroke-width', 1.4);

    // vertical guide on current month
    if (cur) {
      svg.append('line')
        .attr('x1', x(month)).attr('x2', x(month))
        .attr('y1', m.t).attr('y2', h - m.b)
        .attr('stroke', stateColor)
        .attr('stroke-dasharray', '3 3')
        .attr('stroke-opacity', 0.45);
    }
  }

  // ---------- Play / pause ----------
  function setPlaying(on) {
    playing = on;
    playBtn.classList.toggle('playing', on);
    playBtn.querySelector('.play-label').textContent = on ? 'Pause' : 'Play the year';
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    if (on) {
      playTimer = setInterval(() => {
        month = month >= 12 ? 1 : month + 1;
        monthInput.value = month;
        update();
      }, 700);
    }
  }

  // ---------- Wire up controls ----------
  playBtn.addEventListener('click', () => setPlaying(!playing));
  monthInput.addEventListener('input', () => {
    if (playing) setPlaying(false);
    month = +monthInput.value;
    update();
  });
  varBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      varBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      varKey = btn.dataset.var;
      update();
    });
  });

  document.addEventListener('mousemove', e => {
    if (document.getElementById('tooltip').classList.contains('visible')) moveTip(e);
  });

  // ---------- Initial render ----------
  buildAll();

  // ---------- Scrollytelling ----------
  const captionEl   = document.getElementById('tm-caption');
  const capCounter  = document.getElementById('cap-counter');
  const capEyebrow  = document.getElementById('cap-eyebrow');
  const capTitle    = document.getElementById('cap-title');
  const capBody     = document.getElementById('cap-body');
  const resetBtn    = document.getElementById('tm-reset');
  const stepNodes   = Array.from(document.querySelectorAll('.tm-step'));

  let currentScene = -1;

  function applyScene(idx) {
    if (idx === currentScene) return;
    currentScene = idx;
    const scene = SCENES[idx];
    if (!scene) return;

    // Stop autoplay during a scene change
    if (playing) setPlaying(false);

    // Sync state
    month  = scene.month;
    varKey = scene.varKey;

    // Update controls UI
    monthInput.value = month;
    varBtns.forEach(b => b.classList.toggle('active', b.dataset.var === varKey));

    // Caption fade-swap
    captionEl.classList.add('swap');
    setTimeout(() => {
      capCounter.textContent = `Scene ${idx + 1} of ${SCENES.length}`;
      capEyebrow.textContent = scene.eyebrow;
      capTitle.textContent   = scene.title;
      capBody.textContent    = scene.body;
      captionEl.classList.remove('swap');
    }, 180);

    // State focus / dim
    STATES.forEach(s => {
      const wrap = document.getElementById(`tm-${s.toLowerCase()}`);
      if (!wrap) return;
      wrap.classList.remove('focus', 'dim');
      if (scene.focus) {
        if (scene.focus === s) wrap.classList.add('focus');
        else                   wrap.classList.add('dim');
      }
    });

    update();
  }

  // Initialize Scrollama if available
  if (typeof scrollama !== 'undefined') {
    const scroller = scrollama();
    scroller
      .setup({
        step: '.tm-step',
        offset: 0.55,
        progress: false,
      })
      .onStepEnter(response => {
        const idx = +response.element.dataset.scene;
        applyScene(idx);
      });

    window.addEventListener('resize', () => scroller.resize());
  } else {
    console.warn('[time-machine] scrollama not loaded — scenes disabled, free explore only');
    // Fall back to scene 0 without scroll-driven changes
    applyScene(0);
  }

  // Reset button — scroll to first step
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const first = stepNodes[0];
      if (first) {
        const rect = first.getBoundingClientRect();
        const y = window.scrollY + rect.top - window.innerHeight * 0.45;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  }

  let resizeId;
  window.addEventListener('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(buildAll, 150);
  });
}
