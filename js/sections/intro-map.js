// =========================================================
//  Intro US map — three states highlighted with their crops
// =========================================================
import { STATES, STATE_FP, STATE_COLORS, STATE_COLORS_DARK, STATE_CROP } from '../utils.js';

export function initIntroMap(ctx) {
  const container = document.getElementById('intro-map');
  if (!container) return;

  const render = () => {
    container.innerHTML = '';
    const width  = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%');

    // Use AlbersUSA so AK/HI tuck in nicely
    const projection = d3.geoAlbersUsa()
      .fitSize([width, height], ctx.usAll);

    const path = d3.geoPath(projection);

    // background US states
    svg.append('g')
      .attr('class', 'us-states')
      .selectAll('path')
      .data(ctx.usAll.features)
      .join('path')
      .attr('d', path)
      .attr('fill', '#E8E2D2')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 0.7);

    // highlight three states
    const wantedFPs = new Set(Object.values(STATE_FP));
    const focusFeatures = ctx.usAll.features.filter(f =>
      wantedFPs.has(String(f.id).padStart(2, '0'))
    );

    svg.append('g')
      .selectAll('path')
      .data(focusFeatures)
      .join('path')
      .attr('d', path)
      .attr('fill', f => {
        const fp = String(f.id).padStart(2, '0');
        const stateName = Object.entries(STATE_FP).find(([_, v]) => v === fp)[0];
        return STATE_COLORS[stateName];
      })
      .attr('fill-opacity', 0.55)
      .attr('stroke', f => {
        const fp = String(f.id).padStart(2, '0');
        const stateName = Object.entries(STATE_FP).find(([_, v]) => v === fp)[0];
        return STATE_COLORS_DARK[stateName];
      })
      .attr('stroke-width', 1.4);

    // labels
    const labels = svg.append('g').attr('class', 'state-labels');
    focusFeatures.forEach(f => {
      const fp = String(f.id).padStart(2, '0');
      const stateName = Object.entries(STATE_FP).find(([_, v]) => v === fp)[0];
      const [cx, cy] = path.centroid(f);
      const g = labels.append('g').attr('transform', `translate(${cx}, ${cy})`);
      g.append('text')
        .attr('class', 'state-name')
        .attr('text-anchor', 'middle')
        .attr('y', -4)
        .attr('font-family', 'Fraunces, Georgia, serif')
        .attr('font-size', 16)
        .attr('font-weight', 600)
        .attr('fill', STATE_COLORS_DARK[stateName])
        .text(stateName);
      g.append('text')
        .attr('class', 'crop-label')
        .attr('text-anchor', 'middle')
        .attr('y', 12)
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-size', 10)
        .attr('letter-spacing', '0.1em')
        .attr('fill', STATE_COLORS_DARK[stateName])
        .attr('opacity', 0.9)
        .text(STATE_CROP[stateName].toUpperCase());
    });
  };

  render();

  // Re-render on resize
  let resizeId;
  window.addEventListener('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(render, 150);
  });
}
