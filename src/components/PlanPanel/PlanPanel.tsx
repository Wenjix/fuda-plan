import type { SessionStatus } from '../../core/types';
import { useSemanticStore } from '../../store/semantic-store';
import { useSessionStore } from '../../store/session-store';
import { PlanCard } from '../PlanCard/PlanCard';
import { SynthesisPanel } from '../SynthesisPanel/SynthesisPanel';
import styles from './PlanPanel.module.css';

const SYNTHESIS_STATUSES: ReadonlySet<SessionStatus> = new Set([
  'lane_planning',
  'synthesis_ready',
  'synthesized',
]);

interface PlanPanelProps {
  onGeneratePlan: (laneId: string) => void;
  onEvidenceClick?: (nodeId: string) => void;
  onSynthesize?: () => Promise<void>;
  onTalkToPlan?: () => void;
}

export function PlanPanel({ onGeneratePlan, onEvidenceClick, onSynthesize, onTalkToPlan }: PlanPanelProps) {
  const lanePlans = useSemanticStore(s => s.lanePlans);
  const unifiedPlan = useSemanticStore(s => s.unifiedPlan);
  const activeLaneId = useSessionStore(s => s.activeLaneId);
  const sessionStatus = useSessionStore(s => s.session?.status ?? 'exploring');
  const activePlan = lanePlans.find(p => p.laneId === activeLaneId);
  const promotionCount = useSemanticStore(s =>
    s.promotions.filter(p => p.laneId === activeLaneId).length,
  );

  const showSynthesis = SYNTHESIS_STATUSES.has(sessionStatus);

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        <span className={styles.tabLabel}>
          Lane Plans ({lanePlans.length})
        </span>
        {unifiedPlan && (
          <span className={styles.tabLabel}>Unified Plan</span>
        )}
      </div>

      {activePlan ? (
        <PlanCard plan={activePlan} onEvidenceClick={onEvidenceClick} />
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No plan generated for this lane yet.</p>
          <p className={styles.promotionCount}>
            {promotionCount} promoted node{promotionCount !== 1 ? 's' : ''}
          </p>
          <button
            className={styles.generateBtn}
            onClick={() => activeLaneId && onGeneratePlan(activeLaneId)}
            disabled={promotionCount === 0}
          >
            Generate Lane Plan
          </button>
        </div>
      )}

      {/* Show all lane plans summary */}
      {lanePlans.length > 1 && (
        <div className={styles.planList}>
          <h4 className={styles.planListTitle}>All Lane Plans</h4>
          {lanePlans.map(p => (
            <div
              key={p.id}
              className={`${styles.planListItem} ${p.laneId === activeLaneId ? styles.active : ''}`}
            >
              <span className={styles.planListName}>{p.title}</span>
              <span className={styles.planListConfidence}>
                {Math.round(p.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Synthesis section */}
      {showSynthesis && (
        <>
          <div className={styles.divider} />
          <SynthesisPanel
            status={sessionStatus}
            lanePlans={lanePlans}
            unifiedPlan={unifiedPlan}
            onSynthesize={onSynthesize}
            onEvidenceClick={onEvidenceClick}
            onTalkToPlan={onTalkToPlan}
          />
        </>
      )}
    </div>
  );
}
