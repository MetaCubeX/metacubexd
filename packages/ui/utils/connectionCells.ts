import type { VNode } from 'vue'
import { h } from 'vue'

/**
 * Render a two-line table cell with a primary (strong) line and an
 * optional auxiliary (softer) line. When aux is null/empty, only the
 * primary div is rendered — combined with the parent `<td>`'s
 * `vertical-align: middle`, the primary line is vertically centered
 * in the cell instead of being pinned to the top by an empty placeholder.
 *
 * `primaryTitle` / `auxTitle` set hover tooltips on the respective lines.
 */
export function renderTwoLineCell(
  primary: string,
  aux: string | null | undefined,
  primaryTitle?: string | null,
  auxTitle?: string | null,
): VNode {
  const children: VNode[] = [
    h(
      'div',
      { class: 'conn-primary', title: primaryTitle || undefined },
      primary,
    ),
  ]
  if (aux) {
    children.push(
      h('div', { class: 'conn-aux', title: auxTitle || undefined }, aux),
    )
  }
  return h('div', { class: 'conn-cell-stack' }, children)
}
