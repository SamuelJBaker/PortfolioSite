"use client";

import * as React from "react";
import { useBackgroundEffects } from "./BackgroundEffectsProvider";
import type { EffectEvent } from "./BackgroundEffectsProvider";

/**
 * Subscribe to the background effect bus for the lifetime of the component.
 * The handler is read through a ref, so callers can pass an inline function
 * without re-subscribing on every render.
 */
export function useEffectBus(handler: (event: EffectEvent) => void) {
  const { subscribeEffect } = useBackgroundEffects();
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    return subscribeEffect((event) => handlerRef.current(event));
  }, [subscribeEffect]);
}
