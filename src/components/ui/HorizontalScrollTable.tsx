"use client";

import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
  scrollProps?: Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">;
};

/** Wide data table wrapper: horizontal scroll + fade hint when content overflows. */
export function HorizontalScrollTable({
  children,
  className = "",
  scrollClassName = "overflow-x-auto bg-app-bg",
  scrollProps,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div className={`relative ${className}`.trim()}>
      <div ref={scrollRef} className={scrollClassName} {...scrollProps}>
        {children}
      </div>
      {overflows ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-app-bg via-app-bg/80 to-transparent md:w-8"
            aria-hidden
          />
          <p className="pointer-events-none absolute bottom-1 right-2 text-[10px] font-medium uppercase tracking-wide text-app-fg/40 md:hidden">
            прокрутить →
          </p>
        </>
      ) : null}
    </div>
  );
}
