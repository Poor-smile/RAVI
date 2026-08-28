"use client";

import { useId, type ButtonHTMLAttributes } from "react";
export function MagicWandIcon({ size = 18 }: { size?: number }) {
  const gradientId = `raavi-magic-${useId().replaceAll(":", "")}`;
  const wandPath =
    "M9.9 7.46029L8.19375 10.2165C8.09375 10.379 7.95313 10.4415 7.77188 10.404C7.59063 10.3665 7.475 10.2603 7.425 10.0853L6.80625 7.59154L1.06875 13.3103C0.95625 13.4228 0.825 13.479 0.675 13.479C0.525 13.479 0.39375 13.4228 0.28125 13.3103C0.16875 13.1978 0.1125 13.0665 0.1125 12.9165C0.1125 12.7665 0.16875 12.6353 0.28125 12.5228L6 6.80404L3.50625 6.18529C3.33125 6.13529 3.225 6.01967 3.1875 5.83842C3.15 5.65717 3.2125 5.51654 3.375 5.41654L6.13125 3.69154L5.90625 0.466544C5.89375 0.279044 5.97188 0.141544 6.14063 0.0540441C6.30938 -0.0334559 6.4625 -0.0147059 6.6 0.110294L9.075 2.19154L12.075 0.991544C12.25 0.929044 12.4 0.960294 12.525 1.08529C12.65 1.21029 12.6813 1.36029 12.6188 1.53529L11.4 4.53529L13.4813 7.01029C13.6063 7.14779 13.6281 7.30092 13.5469 7.46967C13.4656 7.63842 13.3313 7.71654 13.1438 7.70404L9.9 7.46029ZM0.09375 2.45404C0.03125 2.39154 0 2.32279 0 2.24779C0 2.17279 0.03125 2.10404 0.09375 2.04154L0.95625 1.17904C1.01875 1.11654 1.0875 1.08529 1.1625 1.08529C1.2375 1.08529 1.30625 1.11654 1.36875 1.17904L2.2125 2.02279C2.275 2.08529 2.30625 2.15404 2.30625 2.22904C2.30625 2.30404 2.275 2.37279 2.2125 2.43529L1.35 3.29779C1.2875 3.36029 1.21875 3.39154 1.14375 3.39154C1.06875 3.39154 1 3.36029 0.9375 3.29779L0.09375 2.45404ZM8.11875 8.21029L9.3 6.29779L11.55 6.46654L10.0875 4.74154L10.9313 2.66029L8.85 3.50404L7.125 2.04154L7.29375 4.29154L5.38125 5.49154L7.575 6.03529L8.11875 8.21029ZM11.175 13.5165L10.3125 12.654C10.25 12.5915 10.2219 12.5228 10.2281 12.4478C10.2344 12.3728 10.2688 12.304 10.3313 12.2415L11.175 11.3978C11.2375 11.3353 11.3063 11.304 11.3813 11.304C11.4563 11.304 11.525 11.3353 11.5875 11.3978L12.45 12.2603C12.5125 12.3228 12.5406 12.3915 12.5344 12.4665C12.5281 12.5415 12.4938 12.6103 12.4313 12.6728L11.5875 13.5165C11.525 13.579 11.4563 13.6103 11.3813 13.6103C11.3063 13.6103 11.2375 13.579 11.175 13.5165Z";
  return (
    <span className="magic-wand-icon" style={{ width: size, height: size }} aria-hidden="true">
      <svg className="magic-wand-icon__neutral" viewBox="0 0 13.595 13.611" fill="none">
        <path d={wandPath} fill="currentColor" />
      </svg>
      <svg
        className="magic-wand-icon__color"
        width={size}
        height={size}
        viewBox="0 0 13.595 13.611"
        fill="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="3" y1="21" x2="21" y2="3">
            <stop stopColor="#FF9B78" />
            <stop offset="0.34" stopColor="#D65BEA" />
            <stop offset="0.68" stopColor="#5167DA" />
            <stop offset="1" stopColor="#61C8E7" />
          </linearGradient>
        </defs>
        <path d={wandPath} fill={`url(#${gradientId})`} />
      </svg>
    </span>
  );
}

export function MagicWandTrigger({
  className = "",
  selected = false,
  iconSize = 18,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  iconSize?: number;
}) {
  return (
    <button
      {...props}
      className={`magic-wand-trigger ${selected ? "is-selected" : ""} ${className}`.trim()}
      type="button"
    >
      <MagicWandIcon size={iconSize} />
    </button>
  );
}
