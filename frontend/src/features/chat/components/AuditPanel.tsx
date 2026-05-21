import { EmptyState } from "../../../components/EmptyState";
import type { AuditFilter, AuditLog, AuditQuery } from "../../../types/audit";
import { formatTime } from "../../../utils/format";

interface AuditPanelProps {
  auditQuery: AuditQuery;
  audits: AuditLog[];
  error: string | null;
  loading: boolean;
  onAuditQueryChange: (query: AuditQuery) => void;
}

export function AuditPanel({ auditQuery, audits, error, loading, onAuditQueryChange }: AuditPanelProps) {
  return (
    <section className="audit-panel" data-testid="audit-panel">
      <div className="panel-section-header">
        <div>
          <strong>审计记录</strong>
          <span>{audits.length} 条记录</span>
        </div>
        <small>{loading ? "加载中" : "支持组合筛选"}</small>
      </div>
      <div className="audit-filters">
        {auditFilters.map((filter) => (
          <button
            className={auditQuery.type === filter.value ? "active" : ""}
            data-testid={`audit-filter-${filter.value}`}
            key={filter.value}
            onClick={() => onAuditQueryChange({ ...auditQuery, type: filter.value })}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="audit-query">
        <input
          aria-label="审计操作者"
          data-testid="audit-operator-input"
          onChange={(event) => onAuditQueryChange({ ...auditQuery, operator: event.target.value })}
          placeholder="操作者"
          value={auditQuery.operator}
        />
        <input
          aria-label="审计关键词"
          data-testid="audit-keyword-input"
          onChange={(event) => onAuditQueryChange({ ...auditQuery, keyword: event.target.value })}
          placeholder="操作、目标关键词"
          value={auditQuery.keyword}
        />
        <input
          aria-label="审计开始日期"
          onChange={(event) => onAuditQueryChange({ ...auditQuery, from: event.target.value })}
          type="date"
          value={auditQuery.from}
        />
        <input
          aria-label="审计结束日期"
          onChange={(event) => onAuditQueryChange({ ...auditQuery, to: event.target.value })}
          type="date"
          value={auditQuery.to}
        />
      </div>
      {loading ? <EmptyState text="正在加载审计记录" /> : null}
      {error ? <div className="message-error">{error}</div> : null}
      {!loading && !audits.length ? <EmptyState text="暂无审计记录" /> : null}
      <div className="audit-list">
        {audits.map((audit) => (
          <article className="audit-row" data-testid="audit-row" key={audit.id}>
            <div>
              <strong>{audit.action}</strong>
              <small>
                {audit.operator} · {formatTime(audit.createdAt)}
              </small>
            </div>
            <span>{audit.targetId}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

const auditFilters: Array<{ label: string; value: AuditFilter }> = [
  { label: "全部", value: "all" },
  { label: "消息", value: "message" },
  { label: "文件", value: "file" },
  { label: "成员", value: "member" },
  { label: "登录", value: "login" }
];
