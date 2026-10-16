import { previewPathPrefix } from "@/lib/preview-path-prefix";

export function assetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return prefix ? `${prefix}${path}` : path;
}

export type Art = {
  garden: HTMLImageElement;
  moth: HTMLImageElement[];
  dew: HTMLImageElement[];
  lantern: HTMLImageElement;
  blossom: HTMLImageElement;
  bramble: HTMLImageElement;
  charm: HTMLImageElement;
};

function load(path: string): HTMLImageElement {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = assetUrl(path);
  return img;
}

export function loadArt(): Art {
  return {
    garden: load("/game/garden.jpg"),
    moth: [1, 2, 3, 4].map((n) => load(`/game/moth-${n}.png`)),
    dew: [1, 2, 3, 4].map((n) => load(`/game/dew-${n}.png`)),
    lantern: load("/game/lantern.png"),
    blossom: load("/game/blossom.png"),
    bramble: load("/game/bramble.png"),
    charm: load("/game/charm.png"),
  };
}

export function ready(img: HTMLImageElement | undefined): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0;
}
