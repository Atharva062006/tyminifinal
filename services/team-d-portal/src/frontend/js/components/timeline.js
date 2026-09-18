/**
 * 7-Step Visual Application Timeline Progression Component for Team D.
 */

window.components = window.components || {};

window.components.renderTimeline = function(steps = []) {
  if (!steps || steps.length === 0) return '';

  const stepHtml = steps.map((step, idx) => {
    let iconChar = idx + 1;

    const statusClass = step.status ? step.status.toLowerCase() : 'upcoming';

    return `
      <div class="timeline-step ${statusClass}" title="${step.desc || ''}">
        <div class="timeline-icon">${iconChar}</div>
        <div class="timeline-title">${step.label}</div>
        <div class="timeline-desc">${step.desc || ''}</div>
        ${step.timestamp ? `<div style="font-size: 0.65rem; color: var(--accent-cyan); margin-top: 2px;">${new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="timeline-container">
      <div class="timeline-stepper">
        ${stepHtml}
      </div>
    </div>
  `;
};
