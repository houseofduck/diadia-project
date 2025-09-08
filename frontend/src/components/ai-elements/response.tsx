"use client";

import { cn } from "../../lib/utils";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      components={{
        h1: ({ children }) => (
          <h1 className={cn("text-2xl font-serif font-semibold", className)}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className={cn("font-semibold text-xl", className)}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className={cn("font-semibold text-lg", className)}>{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className={cn("font-semibold text-base", className)}>{children}</h4>
        ),
        h5: ({ children }) => <h5 className={cn("font-medium", className)}>{children}</h5>,
        strong: ({ children }) => (
          <strong className={cn("font-semibold", className)}>{children}</strong>
        ),
        a: ({ children }) => (
          <a className={cn("text-primary underline underline-offset-2", className)}>{children}</a>
        ),
      }}
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
