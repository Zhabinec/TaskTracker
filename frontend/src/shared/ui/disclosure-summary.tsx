import type { ComponentProps } from "react";
import { Icon } from "./icon";
import type { IconName } from "./icon";

export function DisclosureSummary({ icon, children, className = "", ...props }: ComponentProps<"summary"> & { icon: IconName }) {
  return <summary {...props} className={`disclosure ${className}`}><Icon name={icon} /><span>{children}</span><Icon name="chevron" className="disclosure-chevron" /></summary>;
}
