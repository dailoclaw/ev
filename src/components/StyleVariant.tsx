import type { ComponentType } from 'react'
import { useStyle } from '../lib/style'

/** Keep Classic and Minimal as presentation adapters over the same route/data contract. */
export default function StyleVariant({
  classic: Classic,
  minimal: Minimal,
}: {
  classic: ComponentType
  minimal: ComponentType
}) {
  const [style] = useStyle()
  const Selected = style === 'minimal' ? Minimal : Classic
  return <Selected />
}
