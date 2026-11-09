/**
 * Generates public/og.png (1200x630), the Open Graph / Twitter card image.
 *
 *   node scripts/og.ts
 *
 * Renders with next/og (satori + resvg, bundled with next), so it needs no extra
 * dependencies. Requires network: Geist is fetched as TTF from Google Fonts,
 * because satori cannot read the woff2 copies that ship in node_modules.
 * Name and tagline come from src/content/profile.ts; rerun after changing them.
 */
import { writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og.js";
import React from "react";
import { profile } from "../src/content/profile.ts";

const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#0a0a0d";
const GOLD = "#d4af5a";

async function geist(weight: 400 | 600): Promise<ArrayBuffer> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`)).text();
  const url = css.match(/url\((https:[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error(`Google Fonts returned no TTF for Geist ${weight}`);
  return (await fetch(url)).arrayBuffer();
}

const h = React.createElement;

const card = h(
  "div",
  {
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "0 96px",
      background: BG,
      fontFamily: "Geist",
    },
  },
  h("div", { style: { fontSize: 84, fontWeight: 600, color: "#f5f5f5", letterSpacing: "-0.02em" } }, profile.name),
  h("div", { style: { width: 160, height: 3, background: GOLD, margin: "36px 0" } }),
  h("div", { style: { fontSize: 36, fontWeight: 400, color: "#a3a3a3" } }, profile.tagline)
);

const image = new ImageResponse(card, {
  width: WIDTH,
  height: HEIGHT,
  fonts: [
    { name: "Geist", data: await geist(600), weight: 600, style: "normal" },
    { name: "Geist", data: await geist(400), weight: 400, style: "normal" },
  ],
});

const out = new URL("../public/og.png", import.meta.url);
await writeFile(out, Buffer.from(await image.arrayBuffer()));
console.log(`wrote ${out.pathname}`);
