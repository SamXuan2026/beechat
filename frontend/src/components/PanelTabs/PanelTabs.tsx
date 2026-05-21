import "./PanelTabs.css";

interface PanelTabsProps {
  tabs: string[];
  active: string;
  onChange?: (tab: string) => void;
}

export function PanelTabs({ tabs, active, onChange }: PanelTabsProps) {
  return (
    <div className="bc-panel-tabs">
      {tabs.map((tab) => (
        <button className={tab === active ? "active" : ""} key={tab} onClick={() => onChange?.(tab)} type="button">
          {tab}
        </button>
      ))}
    </div>
  );
}
