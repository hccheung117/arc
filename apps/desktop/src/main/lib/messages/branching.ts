/**
 * Branch Computation
 *
 * Finds divergence points in the message tree where conversations branch.
 * A branch point exists when a parent message has multiple child responses.
 */

import type { BranchInfo } from '@main/contracts/messages'

/**
 * Computes all branch points from a parent→children map.
 * A branch point exists where a parent has multiple children.
 *
 * @param childrenMap - Map of parentId → sorted child message IDs
 * @returns All branch points (parents with multiple children)
 */
export function computeBranchPoints(
  childrenMap: Map<string | null, string[]>,
): BranchInfo[] {
  const branchPoints: BranchInfo[] = []

  for (const [parentId, children] of childrenMap.entries()) {
    if (children.length > 1) {
      branchPoints.push({
        parentId,
        branches: children,
        currentIndex: 0, // Default; renderer manages active selection
      })
    }
  }

  return branchPoints
}
