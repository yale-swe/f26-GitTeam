import type { ReactNode } from "react";
import styles from "./Card.module.css";

type CardProps = {
  children: ReactNode;
  tone?: "default" | "muted" | "blue" | "amber";
  className?: string;
};

export default function Card({ children, tone = "default", className }: CardProps) {
  return (
    <section className={[styles.card, styles[tone], className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}
