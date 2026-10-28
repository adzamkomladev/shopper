import { qrMatrix } from "@shopper/hardware/qr";
import { currentShop } from "../../../stores/shops";

/**
 * The code as a QR the till's scanner reads like typing (a keyboard wedge): the API, the shop and the code, so
 * the enrol screen fills itself in. The quiet zone is part of the drawing.
 */
export function EnrolQr({ code }: { code: string }) {
  const payload = `shopper:enrol?${new URLSearchParams({
    api: window.location.origin,
    shop: currentShop()?.slug ?? "",
    code,
  })}`;
  const matrix = qrMatrix(payload);
  const size = matrix.length + 8;
  const modules = matrix.flatMap((row, y) =>
    row.flatMap((dark, x) => (dark ? [`M${x + 4} ${y + 4}h1v1h-1z`] : [])),
  );
  return (
    <svg
      role="img"
      aria-label="QR code to scan on the till"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="mx-auto size-48 rounded-md bg-white text-black"
    >
      <path d={modules.join("")} fill="currentColor" />
    </svg>
  );
}
