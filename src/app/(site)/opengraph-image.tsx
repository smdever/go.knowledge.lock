import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Knowledge Lock: signed-off truth for teams and AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (weight: 600 | 700) => fs.readFileSync(path.join(process.cwd(), `src/assets/fonts/geist-sans-latin-${weight}-normal.woff`));

/** Share image for knowledge-lock.com and the demo. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#293241", color: "#e0fbfc", padding: "72px 80px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 32, fontWeight: 700 }}>
          <div style={{ display: "flex", width: 52, height: 52, borderRadius: 12, background: "#ee6c4d", marginRight: 18, alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex", width: 20, height: 16, borderRadius: 3, background: "#293241", marginTop: 8 }} />
          </div>
          Knowledge Lock
        </div>
        <div style={{ display: "flex", fontSize: 78, fontWeight: 700, lineHeight: 1.06, letterSpacing: -2, maxWidth: 1000 }}>Signed-off truth for teams and AI</div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#98c1d9" }}>by Guided Orchestration</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: font(600), weight: 600, style: "normal" },
        { name: "Geist", data: font(700), weight: 700, style: "normal" },
      ],
    }
  );
}
