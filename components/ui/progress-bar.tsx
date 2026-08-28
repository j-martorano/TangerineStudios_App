"use client";

import { AppProgressBar } from "next-nprogress-bar";

export function ProgressBar() {
  return (
    <AppProgressBar
      height="2px"
      color="#f97316"
      options={{ showSpinner: false, trickleSpeed: 200 }}
      shallowRouting
    />
  );
}
