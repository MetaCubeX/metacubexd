import { Title } from '@solidjs/meta'
import { ParentComponent } from 'solid-js'

export default (({ children }) => {
  return <Title>{children} - MetaCubeXD</Title>
}) as ParentComponent
