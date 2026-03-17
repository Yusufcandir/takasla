'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    window.location.href = '/admin';
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="skeleton h-8 w-48" />
    </div>
  );
}
