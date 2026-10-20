import type { ComponentType } from "react";
import { READY } from "./ready";
import { MapBody } from "./map";
import { BrandBody } from "./brand";

export type ScreenImpl = { Body: ComponentType; Rail?: ComponentType };

export const SCREEN_MAP: Record<string, ScreenImpl> = {
  map: { Body: MapBody },
  brand: { Body: BrandBody },
};

for (const k of Object.keys(SCREEN_MAP)) READY.add(k);
