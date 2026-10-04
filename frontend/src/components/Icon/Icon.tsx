import Image from "next/image";
import styles from "./Icon.module.css";

// Icons exported from the Figma wireframes, stored in /public/icons.
// Names follow `<icon>-<size>-<color>`; the size is the SVG's native px size.
export type IconName =
  | "activity-14-gray"
  | "activity-15-white"
  | "activity-16-blue"
  | "activity-16-gray"
  | "alert-triangle-14-amber"
  | "alert-triangle-16-amber"
  | "arrow-left-16-gray"
  | "arrow-right-15-white"
  | "calendar-14-gray"
  | "calendar-15-gray"
  | "check-12-white"
  | "check-14-green"
  | "chevron-down-14-gray"
  | "dot-6-amber"
  | "dot-6-green"
  | "dot-6-red"
  | "dot-7-amber"
  | "dot-7-blue"
  | "dot-7-green"
  | "edit-13-blue"
  | "edit-15-gray"
  | "file-text-15-gray"
  | "file-text-16-blue"
  | "git-pull-request-14-gray"
  | "git-pull-request-15-gray"
  | "git-pull-request-16-gray"
  | "github-14-gray"
  | "github-16-blue"
  | "github-16-gray"
  | "github-16-white"
  | "grid-16-blue"
  | "grid-16-gray"
  | "hash-14-gray"
  | "hash-16-blue"
  | "hash-16-dark"
  | "hash-16-gray"
  | "link-14-blue"
  | "message-square-14-gray"
  | "message-square-16-gray"
  | "milestone-13-blue"
  | "milestone-16-blue"
  | "milestone-16-gray"
  | "more-horizontal-15-gray"
  | "more-horizontal-16-gray"
  | "plus-15-white"
  | "settings-15-gray"
  | "upload-15-gray"
  | "upload-16-blue";

export default function Icon({ name }: { name: IconName }) {
  const size = Number(name.match(/-(\d+)-/)?.[1]);
  return (
    <Image
      className={styles.icon}
      src={`/icons/${name}.svg`}
      width={size}
      height={size}
      alt=""
    />
  );
}
