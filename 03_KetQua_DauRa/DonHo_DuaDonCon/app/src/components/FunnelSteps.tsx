// Các bước của một trường trong phễu: đã qua (dấu tích), đang ở (viền), chưa tới. Luôn có chữ, không chỉ dựa vào màu.
import { STAGE_LABEL, STAGES, stageIndex, type Stage } from "@/domain/sales";
import { Icon } from "./Icon";

export function FunnelSteps({ stage }: { stage: Stage }) {
  const at = stageIndex(stage);
  return (
    <ol className="funnel-steps" aria-label={`Bước hiện tại: ${STAGE_LABEL[stage]}`}>
      {STAGES.map((s, i) => (
        <li key={s} className={i < at ? "done" : i === at ? "now" : undefined} aria-current={i === at ? "step" : undefined}>
          <span className="dot" aria-hidden="true">{i <= at ? <Icon name="check" size={16} /> : i + 1}</span>
          <span className="label">{STAGE_LABEL[s]}{i === at && <span className="sr-only"> (đang ở bước này)</span>}</span>
        </li>
      ))}
    </ol>
  );
}
