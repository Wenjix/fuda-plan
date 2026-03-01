import { BaseEdge, getStraightPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import './Connector.css';

export function Connector(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, id } = props;
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return <BaseEdge id={id} path={edgePath} className="fuda-connector" />;
}
