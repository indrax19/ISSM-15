import * as React from "react";

/**
 * VisuallyHidden component for hiding content from visual display
 * while keeping it accessible to screen readers
 */
const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className="sr-only"
    {...props}
  />
));
VisuallyHidden.displayName = "VisuallyHidden";

export { VisuallyHidden };
