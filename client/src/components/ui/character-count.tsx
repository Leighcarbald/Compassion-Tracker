import React from "react";

interface CharacterCountProps {
  /** The current text value being counted */
  value: string;
  /** The maximum characters allowed */
  maxLength: number;
  /** Optional className for styling */
  className?: string;
}

/**
 * A component that displays the remaining character count for text inputs.
 * Shows the current character count out of the maximum allowed.
 */
export function CharacterCount({ value, maxLength, className = "" }: CharacterCountProps) {
  const currentCount = value?.length || 0;
  const remaining = maxLength - currentCount;
  const isNearLimit = remaining <= Math.floor(maxLength * 0.1); // Less than 10% remaining
  const isAtLimit = remaining <= 0;

  return (
    <div 
      className={`text-xs mt-1 text-right ${
        isAtLimit 
          ? "text-red-500 font-semibold" 
          : isNearLimit 
            ? "text-amber-500" 
            : "text-gray-500"
      } ${className}`}
    >
      {currentCount}/{maxLength} characters
      {remaining >= 0 ? ` (${remaining} remaining)` : ` (${Math.abs(remaining)} over limit)`}
    </div>
  );
}