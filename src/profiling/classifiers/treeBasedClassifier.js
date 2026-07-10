// =============================================================================
// Tree-Based Classifier
// Used by: classifierStrategy.js
//
// Traverses the decisionTree config deterministically from root to leaf.
// At each internal node, evaluates the node's condition against the
// SessionContext and follows the yes or no branch accordingly.
// Records every node label visited — the full path is the explainability trace.
//
// OFFLINE ALGORITHM PROVENANCE:
//   Tree structure derived from offline Decision Tree analysis of the
//   Kaggle Customer Segmentation Data dataset. The branching structure,
//   split features, and thresholds were transcribed into decisionTree.js.
//   No model runs at runtime.
//
// SUPPORTED CONDITION OPERATORS:
//   eq      — field === value
//   neq     — field !== value
//   in      — value array includes field value
//   not_in  — value array does not include field value
//   lte     — field <= value
//   gte     — field >= value
//   between — value.min <= field <= value.max
//
// OUTPUT: ProfilingDecision with classifierType: 'TREE_BASED'
//   trace.path          — ordered array of node labels from root to leaf
//   trace.nodeIds       — ordered array of node ids from root to leaf
//   trace.leafId        — id of the terminal leaf node
//   membershipInfluenced — taken from the leaf result field
// =============================================================================

import { createProfilingDecision, CLASSIFIER_TYPES } from '../ProfilingDecision.js';

// ---------------------------------------------------------------------------
// Condition evaluator — supports all tree operators
// ---------------------------------------------------------------------------

/**
 * Evaluates a single tree node condition against the session context.
 *
 * @param {object} sessionContext — frozen SessionContext
 * @param {object} condition      — { field, operator, value }
 * @returns {boolean}
 */
function evaluateNodeCondition(sessionContext, condition) {
  const { field, operator, value } = condition;
  const contextValue = sessionContext[field];

  switch (operator) {
    case 'eq':
      return contextValue === value;

    case 'neq':
      return contextValue !== value;

    case 'in':
      if (!Array.isArray(value)) {
        console.warn(`[treeBasedClassifier] 'in' operator requires an array value for field "${field}"`);
        return false;
      }
      return value.includes(contextValue);

    case 'not_in':
      if (!Array.isArray(value)) {
        console.warn(`[treeBasedClassifier] 'not_in' operator requires an array value for field "${field}"`);
        return false;
      }
      return !value.includes(contextValue);

    case 'lte':
      return typeof contextValue === 'number' && contextValue <= value;

    case 'gte':
      return typeof contextValue === 'number' && contextValue >= value;

    case 'between':
      return (
        typeof contextValue === 'number' &&
        typeof value === 'object' &&
        value !== null &&
        contextValue >= value.min &&
        contextValue <= value.max
      );

    default:
      console.warn(`[treeBasedClassifier] Unknown operator "${operator}" for field "${field}". Treating as false.`);
      return false;
  }
}

// ---------------------------------------------------------------------------
// Tree traversal engine
// ---------------------------------------------------------------------------

/**
 * Traverses the decision tree from root to leaf, recording the path.
 * Returns the leaf result and the full traversal path.
 *
 * @param {object} node           — current tree node
 * @param {object} sessionContext — frozen SessionContext
 * @param {Array}  path           — accumulated node labels (mutated during traversal)
 * @param {Array}  nodeIds        — accumulated node ids (mutated during traversal)
 * @param {number} depth          — current depth (guards against infinite loops)
 * @returns {{ result: object, path: string[], nodeIds: string[], leafId: string }}
 */
function traverseTree(node, sessionContext, path = [], nodeIds = [], depth = 0) {
  // Safety guard — tree should never exceed 20 levels
  if (depth > 20) {
    console.error('[treeBasedClassifier] Maximum tree depth exceeded. Returning generic fallback.');
    return {
      result: {
        demographic: 'GENERIC_DEMOGRAPHIC',
        confidence: 0.50,
        reason: 'Tree traversal depth exceeded — defensive fallback applied',
        membershipInfluenced: false,
      },
      path: [...path, 'depth_exceeded_fallback'],
      nodeIds: [...nodeIds, 'depth_exceeded_fallback'],
      leafId: 'depth_exceeded_fallback',
    };
  }

  // Record this node in the path
  path.push(node.label || node.id);
  nodeIds.push(node.id);

  // Leaf node — has result, no condition
  if (node.result) {
    return {
      result: node.result,
      path: [...path],
      nodeIds: [...nodeIds],
      leafId: node.id,
    };
  }

  // Internal node — must have condition, yes, and no branches
  if (!node.condition || !node.yes || !node.no) {
    console.error(`[treeBasedClassifier] Malformed node "${node.id}" — missing condition, yes, or no branch. Returning generic fallback.`);
    return {
      result: {
        demographic: 'GENERIC_DEMOGRAPHIC',
        confidence: 0.50,
        reason: `Malformed tree node "${node.id}" — defensive fallback applied`,
        membershipInfluenced: false,
      },
      path: [...path, 'malformed_node_fallback'],
      nodeIds: [...nodeIds, 'malformed_node_fallback'],
      leafId: 'malformed_node_fallback',
    };
  }

  // Evaluate condition and follow the appropriate branch
  const conditionResult = evaluateNodeCondition(sessionContext, node.condition);
  const nextNode = conditionResult ? node.yes : node.no;

  return traverseTree(nextNode, sessionContext, path, nodeIds, depth + 1);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies a SessionContext using the deterministic decision-tree engine.
 *
 * @param {object} sessionContext — frozen SessionContext from assembleSessionContext()
 * @param {object} treeConfig     — root node of the decision tree from decisionTree.js
 * @returns {object} ProfilingDecision
 */
export function treeBasedClassifier(sessionContext, treeConfig) {
  if (!sessionContext || typeof sessionContext !== 'object') {
    throw new Error('[treeBasedClassifier] sessionContext must be a non-null object');
  }
  if (!treeConfig || typeof treeConfig !== 'object') {
    throw new Error('[treeBasedClassifier] treeConfig must be a non-null object');
  }

  const { result, path, nodeIds, leafId } = traverseTree(
    treeConfig,
    sessionContext,
    [],
    [],
    0
  );

  return createProfilingDecision({
    demographic:          result.demographic,
    confidence:           result.confidence,
    reason:               result.reason,
    classifierType:       CLASSIFIER_TYPES.TREE_BASED,
    trace: {
      path,       // ordered array of node labels — human-readable
      nodeIds,    // ordered array of node ids — for programmatic replay
      leafId,     // terminal leaf node id
    },
    membershipInfluenced: result.membershipInfluenced || false,
    membershipTier:       sessionContext.membershipTier || null,
    sessionContext,
  });
}
