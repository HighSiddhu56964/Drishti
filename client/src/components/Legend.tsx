import { getColor, TYPE_COLORS } from "../types";

const LEGEND_ITEMS = [
  { type: "country", label: "Country" },
  { type: "organization", label: "Organization" },
  { type: "event", label: "Event" },
  { type: "resource", label: "Resource" },
  { type: "person", label: "Person" },
  { type: "company", label: "Company" },
  { type: "economic_factor", label: "Economic" },
  { type: "infrastructure", label: "Other" },
];

export default function Legend() {
  return (
    <div className="legend" style={{ opacity: 1, pointerEvents: "auto" }}>
      <h4>Entity Types</h4>
      {LEGEND_ITEMS.map((item) => (
        <div key={item.type} className="legend-item">
          <div className="legend-dot" style={{ background: getColor(item.type) }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
