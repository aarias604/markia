"use client";

// Generador de imágenes de Markia: dibuja una publicación cuadrada (1080x1080) en SVG
// con los colores y el logo de la marca. Se descarga como PNG con lib/download.ts.
import type { ReactNode, Ref } from "react";
import { fitHeadline, resolveColor, wrapText, type BrandColors } from "@/lib/templates";
import type { TemplateDefinition } from "@/lib/types";

const S = 1080;
const FONT = "Arial, Helvetica, sans-serif";

interface Props {
  definition: TemplateDefinition;
  colors: BrandColors;
  logoUrl?: string | null;
  headline: string;
  subtext?: string | null;
  brandName?: string | null;
  className?: string;
  ref?: Ref<SVGSVGElement>;
}

interface TextBoxProps {
  x: number;
  width: number;
  anchor: "start" | "middle";
  /** "center": y es el centro del bloque; "bottom": y es el borde inferior. */
  mode: "center" | "bottom";
  y: number;
  color: string;
  headline: string;
  subtext?: string | null;
}

function TextBox({ x, width, anchor, mode, y, color, headline, subtext }: TextBoxProps) {
  const { size, lines } = fitHeadline(headline || "Tu mensaje aquí", width);
  const lh = size * 1.12;
  const subSize = 38;
  const subLh = subSize * 1.3;
  const subLines = subtext ? wrapText(subtext, Math.floor(width / (subSize * 0.5)), 3) : [];
  const gap = subLines.length ? 36 : 0;
  const total = lines.length * lh + gap + subLines.length * subLh;
  const top = mode === "center" ? y - total / 2 : y - total;

  return (
    <g fill={color} fontFamily={FONT} textAnchor={anchor}>
      {lines.map((line, i) => (
        <text key={`h${i}`} x={x} y={top + size * 0.85 + i * lh} fontSize={size} fontWeight={700}>
          {line}
        </text>
      ))}
      {subLines.map((line, i) => (
        <text
          key={`s${i}`}
          x={x}
          y={top + lines.length * lh + gap + subSize * 0.9 + i * subLh}
          fontSize={subSize}
          opacity={0.85}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function Logo({
  url,
  name,
  x,
  y,
  w,
  h,
  color,
  align,
}: {
  url?: string | null;
  name?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  align: "start" | "middle";
}) {
  if (url) {
    return (
      <image
        href={url}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio={align === "middle" ? "xMidYMid meet" : "xMinYMid meet"}
      />
    );
  }
  if (!name) return null;
  return (
    <text
      x={align === "middle" ? x + w / 2 : x}
      y={y + h / 2 + 14}
      fill={color}
      fontFamily={FONT}
      fontSize={40}
      fontWeight={700}
      textAnchor={align}
    >
      {name}
    </text>
  );
}

export function PostImage({ definition, colors, logoUrl, headline, subtext, brandName, className, ref }: Props) {
  const bg = resolveColor(definition.fondo, colors);
  const fg = resolveColor(definition.texto, colors);
  const dt = resolveColor(definition.detalle, colors);
  const text = { headline, subtext, color: fg };

  let body: ReactNode;
  switch (definition.layout) {
    case "banda":
      body = (
        <>
          <rect x={90} y={190} width={140} height={16} rx={8} fill={dt} />
          <TextBox {...text} x={90} width={900} anchor="start" mode="center" y={520} />
          <rect x={0} y={900} width={S} height={180} fill={dt} />
          <Logo url={logoUrl} name={brandName} x={90} y={930} w={260} h={120} color={bg} align="start" />
        </>
      );
      break;
    case "esquina":
      body = (
        <>
          <path d={`M ${S} 0 L ${S} 430 A 430 430 0 0 1 ${S - 430} 0 Z`} fill={dt} />
          <circle cx={S - 120} cy={120} r={40} fill={bg} opacity={0.35} />
          <Logo url={logoUrl} name={brandName} x={90} y={80} w={240} h={130} color={fg} align="start" />
          <TextBox {...text} x={90} width={880} anchor="start" mode="bottom" y={980} />
        </>
      );
      break;
    case "dividido":
      body = (
        <>
          <rect x={0} y={0} width={400} height={S} fill={dt} />
          <Logo url={logoUrl} name={brandName} x={50} y={440} w={300} h={200} color={bg} align="middle" />
          <TextBox {...text} x={470} width={540} anchor="start" mode="center" y={540} />
        </>
      );
      break;
    case "marco":
      body = (
        <>
          <rect x={40} y={40} width={1000} height={1000} fill="none" stroke={dt} strokeWidth={16} />
          <rect x={72} y={72} width={936} height={936} fill="none" stroke={dt} strokeWidth={3} />
          <TextBox {...text} x={540} width={780} anchor="middle" mode="center" y={480} />
          <Logo url={logoUrl} name={brandName} x={440} y={800} w={200} h={140} color={fg} align="middle" />
        </>
      );
      break;
    default: // centrado
      body = (
        <>
          <circle cx={S} cy={0} r={270} fill={dt} opacity={0.9} />
          <circle cx={0} cy={S} r={210} fill={dt} opacity={0.6} />
          <TextBox {...text} x={540} width={860} anchor="middle" mode="center" y={480} />
          <Logo url={logoUrl} name={brandName} x={430} y={830} w={220} h={150} color={fg} align="middle" />
        </>
      );
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${S} ${S}`}
      width="100%"
      className={className}
      role="img"
      aria-label={headline}
    >
      <rect width={S} height={S} fill={bg} />
      {body}
    </svg>
  );
}
