"use client";

export function CasherLogoSpin({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <img
        src="/casher-logo.png"
        alt=""
        className="h-11 w-auto max-w-[128px] animate-spin object-contain drop-shadow-[0_0_18px_rgba(52,211,153,0.45)] md:h-12 md:max-w-[140px]"
        style={{ animationDuration: "2.8s" }}
        draggable={false}
        aria-hidden
      />
    </div>
  );
}
