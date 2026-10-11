'use client';

import { useEffect } from 'react';

export default function BrandingConsole() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      console.clear();
      console.log(
        '%cOpenRemove',
        'color:#7DF9B6;font-size:52px;font-weight:900;font-family:monospace;'
      );
      console.log(
        '%cOpenRemove - Free & Automatic AI Background Removal',
        'color:#7DF9B6;font-size:13px;font-family:monospace;'
      );
      console.log(
        '%cCode without limits, think beyond the universe.',
        'color:rgba(240,236,228,0.4);font-size:12px;font-family:monospace;font-style:italic;'
      );
      console.log(
        '%cgithub.com/DGameXO | contact@dgxohq.com | dgxohq.com',
        'color:rgba(240,236,228,0.25);font-size:11px;font-family:monospace;'
      );
      console.log(
        '%cPowered by DGXO Core | Copyright © 2026 DGXO. All rights reserved.',
        'color:rgba(240,236,228,0.25);font-size:11px;font-family:monospace;'
      );
    } catch (_) {}
  }, []);

  return null;
}
