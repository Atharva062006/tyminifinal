// Team A — Pluggable rule-chaining engine (A2).
// Strategies: SEQUENTIAL_AND | WEIGHTED_PRIORITY | DECISION_TREE (all implemented from scratch).
const SequentialANDChain = require('../rules/SequentialANDChain');
const WeightedPriority = require('../rules/WeightedPriority');
const DecisionTree = require('../rules/DecisionTree');
const { buildRules, RULE_SET_VERSION } = require('../rules/ruleSet');
const { v4: uuidv4 } = require('uuid');

const STRATEGIES = ['DECISION_TREE', 'SEQUENTIAL_AND', 'WEIGHTED_PRIORITY'];

function buildTree(nodes) {
  // Linear decision tree: each node's `pass` leads to the next rule, `fail` terminates.
  let node = null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    node = { rule: nodes[i], pass: node, fail: null };
  }
  return node;
}

/** Returns raw strategy outcome: { result, failedCodes } */
function runStrategy(strategy, student, rules) {
  const hard = rules.filter(r => r.hard);
  const soft = rules.filter(r => !r.hard);
  const adapt = r => ({ name: r.code, weight: r.weight, evaluate: () => r.evaluate(student) });

  if (strategy === 'WEIGHTED_PRIORITY') {
    const out = new WeightedPriority(rules.map(adapt)).evaluate(student, null);
    return { result: out.result, failedCodes: out.failed_rules, score: out.score };
  }

  let out;
  if (strategy === 'SEQUENTIAL_AND') {
    out = new SequentialANDChain(hard.map(adapt)).evaluate(student, null);
  } else {
    const root = buildTree(hard.map(adapt));
    out = root ? new DecisionTree(root).evaluate(student, null) : { result: 'ELIGIBLE', failed_rules: [] };
  }
  if (out.result === 'NOT_ELIGIBLE') return { result: 'NOT_ELIGIBLE', failedCodes: out.failed_rules };

  const softFailed = soft.filter(r => !r.evaluate(student)).map(r => r.code);
  return { result: softFailed.length ? 'CONDITIONAL' : 'ELIGIBLE', failedCodes: softFailed };
}

/** Reference oracle used for correctness checks (strategy-independent hard/soft semantics). */
function referenceDecision(student, criteria) {
  const rules = buildRules(criteria);
  if (rules.some(r => r.hard && !r.evaluate(student))) return 'NOT_ELIGIBLE';
  return rules.some(r => !r.hard && !r.evaluate(student)) ? 'CONDITIONAL' : 'ELIGIBLE';
}

function evaluate(student, criteria, strategy = 'DECISION_TREE') {
  const strat = STRATEGIES.includes(strategy) ? strategy : 'DECISION_TREE';
  const rules = buildRules(criteria);
  const t0 = process.hrtime.bigint();
  const out = runStrategy(strat, student, rules);
  const micros = Number((process.hrtime.bigint() - t0) / 1000n);

  const byCode = Object.fromEntries(rules.map(r => [r.code, r]));
  const breakdown = rules.map(r => ({
    rule: r.code, hard: r.hard, required: r.required, actual: r.actual(student), passed: r.evaluate(student),
  }));

  return {
    decision_id: `DEC-${uuidv4().substring(0, 8)}`,
    eligibility_result: out.result,
    failed_rules: out.failedCodes.map(code => byCode[code].fail(student)),
    failed_rule_codes: [...new Set(out.failedCodes)],
    passed_rules: rules.filter(r => r.evaluate(student)).map(r => r.pass()),
    criteria_breakdown: breakdown,
    weighted_score: out.score,
    rule_set_version: RULE_SET_VERSION,
    strategy: strat,
    decision_metrics: {
      evaluation_time_us: micros,
      rules_evaluated: rules.length,
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = { evaluate, referenceDecision, STRATEGIES };
