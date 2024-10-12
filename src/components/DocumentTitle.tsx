import { Title } from '@solidjs/meta'
import { ParentComponent } from 'solid-js'

export const DocumentTitle: ParentComponent = ({ children }) => {
  return <Title>{children} - MetaCubeXD</Title>
}
