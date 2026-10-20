"use client";

import { useEffect } from "react";

/** Starts the page at the top (used after locking, coming from a long workspace page). */
export default function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return null;
}
