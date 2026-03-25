"use client";

import { useRef, useEffect } from "react";

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function SparklineChart({
  data,
  width = 80,
  height = 24,
  color,
}: SparklineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const drawHeight = height - padding * 2;
    const stepX = (width - 2) / (data.length - 1);

    // Determine color: green if last > first, red if last < first
    const lineColor =
      color ?? (data[data.length - 1] >= data[0] ? "#00b37e" : "#f75a68");

    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";

    for (let i = 0; i < data.length; i++) {
      const x = 1 + i * stepX;
      const y = padding + drawHeight - ((data[i] - min) / range) * drawHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [data, width, height, color]);

  if (data.length < 2) {
    return <div style={{ width, height }} className="bg-bg/30 rounded" />;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  );
}
