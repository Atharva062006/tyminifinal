/**
 * Status Badge & Chip formatting component for Team D Frontend.
 */

window.components = window.components || {};

window.components.renderBadge = function(state) {
  if (!state) return '<span class="badge badge-withdrawn">Unknown</span>';
  const cleanState = String(state).toUpperCase().trim();
  const cssClass = cleanState.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const label = cleanState.replace(/_/g, ' ');
  return `<span class="badge badge-${cssClass}">${label}</span>`;
};

window.components.renderEligibilityBadge = function(result) {
  if (result === 'ELIGIBLE') {
    return `<span class="badge badge-selected">Eligible</span>`;
  }
  if (result === 'CONDITIONAL') {
    return `<span class="badge badge-waitlisted">Conditional</span>`;
  }
  return `<span class="badge badge-not_eligible">Not Eligible</span>`;
};
