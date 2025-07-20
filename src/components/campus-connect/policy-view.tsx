"use client";

import { Button } from "@/components/ui/button";

interface PolicyViewProps {
  onAgree: () => void;
}

export default function PolicyView({ onAgree }: PolicyViewProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-card/80 border border-border rounded-2xl shadow-2xl p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4 text-white">Community Guidelines</h2>
        <p className="mb-6 text-muted-foreground">
          Welcome to Campus Connect! To ensure a safe and positive experience for everyone, you must agree to our community guidelines. Be respectful, don't share personal information, and report any inappropriate behavior.
        </p>
        <Button onClick={onAgree} className="w-full font-bold">
          I Agree
        </Button>
      </div>
    </div>
  );
}
