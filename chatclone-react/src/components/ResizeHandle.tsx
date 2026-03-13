import { useCallback, useEffect, useRef } from "react";

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction?: "left" | "right"; // "left" = dragging resizes panel on the left, "right" = panel on the right
  className?: string;
}

const ResizeHandle = ({ onResize, direction = "left", className = "" }: ResizeHandleProps) => {
  const isDragging = useRef(false);
  const startX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      startX.current = e.clientX;
      onResize(direction === "left" ? delta : -delta);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize, direction]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`group relative z-10 w-0 shrink-0 cursor-col-resize ${className}`}
    >
      {/* Invisible wider hit area */}
      <div className="absolute inset-y-0 -left-[3px] w-[6px]" />
      {/* Visible line on hover/drag */}
      <div className="absolute inset-y-0 -left-[1px] w-[2px] bg-transparent transition-colors group-hover:bg-primary/40 group-active:bg-primary/60" />
    </div>
  );
};

export default ResizeHandle;
