/**
 * Hero visual: a stylized rail diagram showing value moving
 * Fiat → USDC → Global, with small dots animated along each connecting path
 * via native SVG `<animateMotion>` (no JS animation library needed).
 *
 * Server component — purely decorative markup, degrades gracefully if
 * animation is disabled (prefers-reduced-motion is handled by pausing the
 * SVG animations via CSS on the `.rail-flow` wrapper, see globals.css).
 */
export function RailFlow({ className = "" }: { className?: string }) {
  const nodes = [
    { x: 40, label: "Fiat", sublabel: "Fiat rails" },
    { x: 260, label: "USDC", sublabel: "On Arc" },
    { x: 480, label: "Global", sublabel: "Any chain, any rail" },
  ];

  return (
    <div className={`rail-flow relative w-full ${className}`}>
      <svg
        viewBox="0 0 520 160"
        className="w-full h-auto"
        role="img"
        aria-label="Diagram showing money moving from Fiat to USDC on Arc to global rails"
      >
        <defs>
          <linearGradient id="railLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#14B8A6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Connecting lines */}
        <path
          id="rail-path-1"
          d="M 40 80 H 260"
          stroke="url(#railLine)"
          strokeWidth="2"
          fill="none"
        />
        <path
          id="rail-path-2"
          d="M 260 80 H 480"
          stroke="url(#railLine)"
          strokeWidth="2"
          fill="none"
        />

        {/* Animated flow dots */}
        <circle r="4" fill="#2DD4BF">
          <animateMotion dur="2.6s" repeatCount="indefinite" begin="0s">
            <mpath href="#rail-path-1" />
          </animateMotion>
        </circle>
        <circle r="4" fill="#2DD4BF">
          <animateMotion dur="2.6s" repeatCount="indefinite" begin="1.3s">
            <mpath href="#rail-path-2" />
          </animateMotion>
        </circle>

        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.label}>
            <circle
              cx={node.x}
              cy={80}
              r={26}
              className="fill-surface-elevated stroke-border soft-pulse"
              strokeWidth="1.5"
            />
            <text
              x={node.x}
              y={85}
              textAnchor="middle"
              className="fill-foreground text-[13px] font-semibold"
              fontFamily="var(--font-sans)"
            >
              {node.label}
            </text>
            <text
              x={node.x}
              y={128}
              textAnchor="middle"
              className="fill-current text-muted text-[11px]"
              fontFamily="var(--font-sans)"
            >
              {node.sublabel}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
