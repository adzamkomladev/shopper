import type { CSSProperties, ReactNode } from "react";
import { qrMatrix } from "../qr";

// Satori subset: every parent is display:flex, inline styles only, no grid, no classes.
const flex: CSSProperties = { display: "flex" };

export const Stack = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ ...flex, flexDirection: "column", ...style }}>{children}</div>
);

export const Center = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ ...flex, justifyContent: "center", textAlign: "center", ...style }}>{children}</div>
);

export const Row = ({
  left,
  right,
  style,
}: {
  left: string;
  right: string;
  style?: CSSProperties;
}) => (
  <div style={{ ...flex, justifyContent: "space-between", gap: 12, ...style }}>
    <div style={flex}>{left}</div>
    <div style={flex}>{right}</div>
  </div>
);

export const Rule = () => (
  <div style={{ ...flex, borderTop: "2px dashed #000", margin: "8px 0" }} />
);

/** Dark modules as one SVG path, so the image stays a single small data URI. */
export function qrImage(text: string, size: number) {
  const matrix = qrMatrix(text);
  const path = matrix
    .flatMap((cells, y) => cells.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")))
    .join("");
  const n = matrix.length + 8;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${n} ${n}" shape-rendering="crispEdges">` +
    `<rect x="-4" y="-4" width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  return (
    <img
      alt="Receipt QR"
      width={size}
      height={size}
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
    />
  );
}
