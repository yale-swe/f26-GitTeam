import Icon from "@/components/Icon/Icon";
import styles from "./Checkbox.module.css";

type CheckboxProps = {
  checked?: boolean;
  // Amber outline used for blocked items.
  warning?: boolean;
  size?: 18 | 19;
};

// Visual-only checkbox for the wireframes.
export default function Checkbox({ checked = false, warning = false, size = 18 }: CheckboxProps) {
  const className = [
    styles.box,
    checked && styles.checked,
    warning && styles.warning,
    size === 19 && styles.large,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={className}>{checked && <Icon name="check-12-white" />}</span>;
}
