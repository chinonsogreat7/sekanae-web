import { type ReactNode } from "react";

type SectionHeadingProps = {
  title: string;
  copy?: string;
  align?: "left" | "center";
  children?: ReactNode;
};

export function SectionHeading({ title, copy, align = "left", children }: SectionHeadingProps) {
  return (
    <div className={`section-heading section-heading-${align}`}>
      <div>
        <h2>{title}</h2>
        {copy && <p>{copy}</p>}
      </div>
      {children}
    </div>
  );
}
