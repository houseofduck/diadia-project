"use client";

import { motion } from "framer-motion";
import { ReportView } from "./report-view";

interface ReportPanelProps {
  report: string;
  sessionKey?: string;
  onNewQuery?: () => void;
  shouldAnimate?: boolean;
}

export function ReportPanel({
  report,
  sessionKey,
  onNewQuery,
  shouldAnimate = true,
}: ReportPanelProps) {
  const animationProps = shouldAnimate
    ? {
        animate: { opacity: 1, x: 0 },
        initial: { opacity: 0, x: "100%" },
        transition: {
          type: "tween" as const,
          duration: 0.6,
          ease: "easeOut", // Custom easing curve
          delay: 0.2, // Small delay for smooth entrance
        },
      }
    : ({
        animate: { opacity: 1, x: 0 },
        initial: { opacity: 1, x: 0 },
      } as any); // Would refactor this to be more type safe in the future

  return (
    <motion.div
      {...animationProps}
      className="w-full md:w-1/2 border-t md:border-t-0 md:border-l flex flex-col h-full bg-white relative z-10"
    >
      <ReportView
        report={report}
        sessionKey={sessionKey}
        onNewQuery={onNewQuery}
        className="h-full"
      />
    </motion.div>
  );
}
