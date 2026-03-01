import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { SemanticNode } from '../../core/types';
import { StatusBadge } from '../shared/StatusBadge';
import { StreamingText } from '../shared/StreamingText';
import { useViewStore } from '../../store/view-store';
import { answerNode, branchFromNode } from '../../store/actions';
import type { PathType } from '../../core/types';
import styles from './ExplorationCard.module.css';

type ExplorationCardNodeType = Node<SemanticNode, 'explorationCard'>;

export function ExplorationCard({ data, id }: NodeProps<ExplorationCardNodeType>) {
  const node = data;
  const streamBuffer = useViewStore(s => s.streamBuffers.get(id) ?? '');
  const isStreaming = node.fsmState === 'generating';

  const handleAnswer = () => {
    if (node.fsmState === 'idle') {
      void answerNode(id);
    }
  };

  const handleBranch = (pathType: string) => {
    if (node.fsmState === 'resolved') {
      void branchFromNode(id, pathType as PathType);
    }
  };

  return (
    <div className={styles.card}>
      <Handle type="target" position={Position.Top} className={styles.handle} />

      <div className={styles.header}>
        <StatusBadge state={node.fsmState} />
        {node.pathType && (
          <span className={styles.pathType}>{node.pathType}</span>
        )}
      </div>

      <div className={styles.question}>{node.question}</div>

      {/* Show streaming text during generation */}
      {isStreaming && streamBuffer && (
        <div className={styles.answer}>
          <StreamingText text={streamBuffer} isStreaming={true} />
        </div>
      )}

      {/* Show resolved answer */}
      {node.answer && (
        <div className={styles.answer}>
          <p className={styles.summary}>{node.answer.summary}</p>
          <ul className={styles.bullets}>
            {node.answer.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className={styles.actions}>
        {node.fsmState === 'idle' && (
          <button className={styles.answerBtn} onClick={handleAnswer}>
            Show Answer
          </button>
        )}
        {node.fsmState === 'failed' && (
          <button className={styles.retryBtn} onClick={handleAnswer}>
            Retry
          </button>
        )}
        {node.fsmState === 'resolved' && (
          <div className={styles.branchActions}>
            <button onClick={() => handleBranch('go-deeper')}>Go Deeper</button>
            <button onClick={() => handleBranch('challenge')}>Challenge</button>
            <button onClick={() => handleBranch('connect')}>Connect</button>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
