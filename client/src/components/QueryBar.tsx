import { useState, useRef } from "react";

const EXAMPLES = [
  { label: "Iran-Israel & Oil", query: "Impact of Iran-Israel conflict on global oil trade and economy" },
  { label: "NVIDIA & AI Chips", query: "How does NVIDIA monopoly affect global AI chip supply chain" },
  { label: "Russia-Ukraine", query: "Russia Ukraine war impact on European energy and NATO strategy" },
];

interface Props { onSubmit: (query: string) => void; }

export default function QueryBar({ onSubmit }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => { if (value.trim()) onSubmit(value.trim()); };
  const setQuery = (q: string) => { setValue(q); inputRef.current?.focus(); };

  return (
    <div className="top-bar">
      <div className="logo">🔮 Palantir</div>
      <div className="input-row">
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter intelligence query..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn" onClick={submit}>Generate</button>
      </div>
      <div className="examples">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <div key={ex.label} className="example-chip" onClick={() => setQuery(ex.query)}>
            {ex.label}
          </div>
        ))}
      </div>
    </div>
  );
}
