"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type StitchType = "running" | "satin" | "fill";
type ElementKind = "polyline" | "circle" | "shape";

type PatternElement =
  | {
      id: string;
      kind: "polyline";
      color: string;
      stitch: StitchType;
      points: { x: number; y: number }[];
    }
  | {
      id: string;
      kind: "circle";
      color: string;
      stitch: StitchType;
      center: { x: number; y: number };
      radius: number;
    }
  | {
      id: string;
      kind: "shape";
      color: string;
      stitch: StitchType;
      points: { x: number; y: number }[];
      label: string;
    };

const COLORS = [
  "#fa5252",
  "#fab005",
  "#4c6ef5",
  "#12b886",
  "#ffd43b",
  "#ae3ec9",
  "#f8f9fa",
  "#1c7ed6"
];

const stitchLabels: Record<StitchType, string> = {
  running: "Düz Dikiş",
  satin: "Sarma (Saten)",
  fill: "Dolgu"
};

function useCanvasSize() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const { inlineSize, blockSize } = Array.isArray(entry.contentBoxSize)
            ? entry.contentBoxSize[0]
            : entry.contentBoxSize;
          setSize({
            width: Math.max(480, inlineSize),
            height: Math.max(320, blockSize)
          });
        } else {
          setSize({
            width: Math.max(480, entry.contentRect.width),
            height: Math.max(320, entry.contentRect.height)
          });
        }
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return { containerRef, size };
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function roundToGrid(value: number, grid: number) {
  return Math.round(value / grid) * grid;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elements: PatternElement[],
  draft: { points: { x: number; y: number }[] } | null
) {
  ctx.clearRect(0, 0, width, height);

  const gridSize = 20;
  ctx.save();
  ctx.fillStyle = "#0b102a";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(88, 101, 242, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();

  const drawPolyline = (
    points: { x: number; y: number }[],
    color: string,
    stitch: StitchType
  ) => {
    if (points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = stitch === "fill" ? 3 : stitch === "satin" ? 2 : 1.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.restore();
  };

  for (const element of elements) {
    switch (element.kind) {
      case "polyline":
        drawPolyline(element.points, element.color, element.stitch);
        break;
      case "circle": {
        ctx.save();
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.stitch === "fill" ? 3 : element.stitch === "satin" ? 2 : 1.2;
        ctx.beginPath();
        ctx.arc(element.center.x, element.center.y, element.radius, 0, Math.PI * 2);
        element.stitch === "fill"
          ? ((ctx.fillStyle = `${element.color}33`), ctx.fill())
          : null;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "shape": {
        drawPolyline([...element.points, element.points[0]], element.color, element.stitch);
        if (element.stitch === "fill") {
          ctx.save();
          ctx.fillStyle = `${element.color}26`;
          ctx.beginPath();
          element.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.save();
        ctx.fillStyle = "#e5e7ff";
        ctx.font = "12px Inter";
        const centroid = element.points.reduce(
          (acc, pt) => ({ x: acc.x + pt.x / element.points.length, y: acc.y + pt.y / element.points.length }),
          { x: 0, y: 0 }
        );
        ctx.fillText(element.label, centroid.x - 20, centroid.y);
        ctx.restore();
        break;
      }
    }
  }

  if (draft && draft.points.length > 0) {
    drawPolyline(draft.points, "#74c0fc", "running");
    draft.points.forEach((pt) => {
      ctx.save();
      ctx.fillStyle = "#339af0";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

function exportToDXF(elements: PatternElement[], width: number, height: number) {
  const HEADER = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
TABLES
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  const FOOTER = `0
ENDSEC
0
EOF
`;

  const scale = 1; // pixels assumed as millimeters for simplicity

  const entityParts: string[] = [];
  const toDXFColor = (hex: string) => {
    const colors = [
      "#fa5252",
      "#fab005",
      "#ffd43b",
      "#4c6ef5",
      "#ae3ec9",
      "#12b886",
      "#1c7ed6",
      "#f8f9fa"
    ];
    const index = colors.findIndex((c) => c.toLowerCase() === hex.toLowerCase());
    return index >= 0 ? index + 1 : 1;
  };

  const serializePoints = (points: { x: number; y: number }[]) =>
    points
      .map((pt, idx) => {
        const x = (pt.x / scale).toFixed(3);
        const y = ((height - pt.y) / scale).toFixed(3);
        return `10
${x}
20
${y}
30
0
${idx === points.length - 1 ? "" : ""}`;
      })
      .join("\n");

  for (const element of elements) {
    const color = toDXFColor(element.color);
    switch (element.kind) {
      case "polyline": {
        if (element.points.length < 2) continue;
        entityParts.push(`0
LWPOLYLINE
8
CAD
62
${color}
90
${element.points.length}
70
0
${serializePoints(element.points)}`);
        break;
      }
      case "circle": {
        entityParts.push(`0
CIRCLE
8
CAD
62
${color}
10
${(element.center.x / scale).toFixed(3)}
20
${((height - element.center.y) / scale).toFixed(3)}
30
0
40
${(element.radius / scale).toFixed(3)}`);
        break;
      }
      case "shape": {
        entityParts.push(`0
LWPOLYLINE
8
CAD
62
${color}
90
${element.points.length + 1}
70
1
${serializePoints([...element.points, element.points[0]])}`);
        break;
      }
    }
  }

  return HEADER + entityParts.join("\n") + "\n" + FOOTER;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function HomePage() {
  const { containerRef, size } = useCanvasSize();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [elements, setElements] = useState<PatternElement[]>([]);
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [stitchType, setStitchType] = useState<StitchType>("running");
  const [isDrawing, setIsDrawing] = useState(false);
  const [draft, setDraft] = useState<{ points: { x: number; y: number }[] } | null>(null);
  const [status, setStatus] = useState("Yeni çizim oluşturmak için tuvale tıklayın.");

  const canvasSize = useMemo(() => {
    const margin = 24;
    return {
      width: size.width - margin,
      height: size.height - margin
    };
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, canvasSize.width, canvasSize.height, elements, draft);
  }, [elements, canvasSize, draft]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const snappedX = roundToGrid(x, 10);
    const snappedY = roundToGrid(y, 10);
    if (!isDrawing) {
      setIsDrawing(true);
      setDraft({ points: [{ x: snappedX, y: snappedY }] });
      setStatus("Çizim devam ediyor. Noktaları yerleştirin, bitirmek için 'Dikişi Sonlandır' tuşuna basın.");
    } else {
      setDraft((prev) => {
        if (!prev) return null;
        return { points: [...prev.points, { x: snappedX, y: snappedY }] };
      });
    }
  };

  const finishDraft = () => {
    if (!draft || draft.points.length < 2) {
      setIsDrawing(false);
      setDraft(null);
      setStatus("En az iki nokta seçmelisiniz.");
      return;
    }
    setElements((prev) => [
      ...prev,
      {
        id: generateId("poly"),
        kind: "polyline",
        color: activeColor,
        stitch: stitchType,
        points: draft.points
      }
    ]);
    setDraft(null);
    setIsDrawing(false);
    setStatus("Dikiş eklendi. Devam etmek için tuvale tıklayın.");
  };

  const addCircle = () => {
    setElements((prev) => [
      ...prev,
      {
        id: generateId("circle"),
        kind: "circle",
        color: activeColor,
        stitch: stitchType,
        center: { x: canvasSize.width / 2, y: canvasSize.height / 2 },
        radius: 80
      }
    ]);
    setStatus("Daire motifi eklendi.");
  };

  const addRosette = () => {
    const origin = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    const radius = 120;
    const petals = 6;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < petals; i += 1) {
      const angle = (Math.PI * 2 * i) / petals;
      points.push({
        x: origin.x + radius * Math.cos(angle),
        y: origin.y + radius * Math.sin(angle)
      });
    }
    setElements((prev) => [
      ...prev,
      {
        id: generateId("shape"),
        kind: "shape",
        color: activeColor,
        stitch: stitchType,
        points,
        label: "Rozet"
      }
    ]);
    setStatus("Rozet motifi eklendi.");
  };

  const resetCanvas = () => {
    setElements([]);
    setDraft(null);
    setIsDrawing(false);
    setStatus("Tuval temizlendi.");
  };

  const downloadDXF = () => {
    const dxf = exportToDXF(elements, canvasSize.width, canvasSize.height);
    downloadFile("nakis-dizayn.dxf", dxf);
    setStatus("DXF formatında indirildi.");
  };

  return (
    <main className="page">
      <div className="panel">
        <h1>NAKIS.CAD</h1>
        <p className="subtitle">
          Dijital nakış desenlerinizi oluşturun, planlayın ve DXF olarak dışa aktarın.
        </p>
        <section>
          <h2>Renk Paleti</h2>
          <div className="color-grid">
            {COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${color === activeColor ? "active" : ""}`}
                style={{ background: color }}
                onClick={() => setActiveColor(color)}
                aria-label={`Renk ${color}`}
              />
            ))}
          </div>
        </section>
        <section>
          <h2>Dikiş Tipi</h2>
          <div className="stitch-grid">
            {Object.entries(stitchLabels).map(([value, label]) => (
              <button
                key={value}
                className={`chip ${stitchType === value ? "chip-active" : ""}`}
                onClick={() => setStitchType(value as StitchType)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2>Motifler</h2>
          <div className="action-grid">
            <button onClick={addCircle}>Daire Motifi</button>
            <button onClick={addRosette}>Rozet Motifi</button>
            <button onClick={finishDraft} disabled={!draft}>
              Dikişi Sonlandır
            </button>
            <button onClick={resetCanvas} className="ghost">
              Tuvali Temizle
            </button>
          </div>
        </section>
        <section>
          <h2>Aktarım</h2>
          <button className="export" onClick={downloadDXF} disabled={elements.length === 0}>
            DXF İndir
          </button>
          <p className="hint">
            DXF dosyası, çoğu CAD ve nakış yazılımına aktarılabilir. Ölçüler mm cinsindedir.
          </p>
        </section>
        <p className="status">{status}</p>
      </div>
      <div className="canvas-wrapper" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="design-canvas"
          onClick={handleCanvasClick}
          aria-label="Nakış tasarım tuvali"
        />
        <div className="overlay">
          <span>
            Tuvale tıklayarak yeni dikiş noktaları ekleyin. Grid aralığı 10mm&apos;dir.
          </span>
        </div>
      </div>
    </main>
  );
}
