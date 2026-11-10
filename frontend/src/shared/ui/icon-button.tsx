import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./icon";
import type { IconName } from "./icon";

export function IconButton({ icon, label, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return <button type="button" {...props} className={`icon-button ${className}`} aria-label={label} title={label}><Icon name={icon} /></button>;
}
