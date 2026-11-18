"use client";

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react";

import Button from "@/components/Button/Button";
import DiscordChannelPicker, {
  type DiscordChannelSelection,
} from "@/components/DiscordChannelPicker/DiscordChannelPicker";
import styles from "./DiscordConnectOverlay.module.css";

type DiscordConnectOverlayProps = {
  projectName: string;
  onClose: () => void;
  onConnect: (selection: DiscordChannelSelection) => Promise<void>;
  onLoadError: () => void;
};

export default function DiscordConnectOverlay({
  projectName,
  onClose,
  onConnect,
  onLoadError,
}: DiscordConnectOverlayProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState<DiscordChannelSelection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isConnecting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isConnecting, onClose]);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isConnecting) onClose();
  }

  async function handleConnect() {
    if (!selection || isConnecting) return;
    setIsConnecting(true);
    try {
      await onConnect(selection);
    } catch {
      // The project-health loader records the user-facing connection error.
    } finally {
      onClose();
    }
  }

  const handleLoadError = useCallback(() => {
    onLoadError();
    onClose();
  }, [onClose, onLoadError]);

  return (
    <div className={styles.backdrop} onMouseDown={handleBackdropClick}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.heading}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{projectName}</p>
            <h2 className={styles.title} id={titleId}>
              Connect Discord
            </h2>
            <p className={styles.description}>
              Choose the project channel with decisions, blockers, and coordination context.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.close}
            aria-label="Close Discord connection"
            onClick={onClose}
            disabled={isConnecting}
          >
            ×
          </button>
        </div>

        <DiscordChannelPicker
          selectedChannelId={selection?.channelId}
          onSelect={setSelection}
          onLoadError={handleLoadError}
        />

        <div className={styles.footer}>
          <Button onClick={onClose} disabled={isConnecting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="discord-16-white"
            onClick={handleConnect}
            disabled={!selection || isConnecting}
          >
            {isConnecting ? "Connecting…" : "Connect Discord"}
          </Button>
        </div>
      </section>
    </div>
  );
}
