'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FindingResolutionProps {
  findingId: string;
  reviewId: string;
  currentStatus?: string;
}

const RESOLUTION_OPTIONS = [
  { value: 'open', label: 'Open', color: '#60A5FA' },
  { value: 'fixed', label: 'Fixed', color: '#2DD4BF' },
  { value: 'wont_fix', label: "Won't Fix", color: '#5E6F8A' },
  { value: 'false_positive', label: 'False Positive', color: '#F59E0B' },
] as const;

type ResolutionStatus = (typeof RESOLUTION_OPTIONS)[number]['value'];

function getStatusColor(status: string): string {
  return (
    RESOLUTION_OPTIONS.find((opt) => opt.value === status)?.color ?? '#60A5FA'
  );
}

export function FindingResolution({
  findingId,
  reviewId,
  currentStatus = 'open',
}: FindingResolutionProps) {
  const [status, setStatus] = useState<ResolutionStatus>(
    currentStatus as ResolutionStatus
  );
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleStatusChange(newStatus: string) {
    const previousStatus = status;
    setStatus(newStatus as ResolutionStatus);
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/review/${reviewId}/findings/${findingId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Failed to update resolution');
      }
    } catch {
      setStatus(previousStatus);
    } finally {
      setIsUpdating(false);
    }
  }

  const currentColor = getStatusColor(status);

  return (
    <Select
      value={status}
      onValueChange={handleStatusChange}
      disabled={isUpdating}
    >
      <SelectTrigger
        className="w-[160px] h-8 text-sm font-medium"
        style={{
          borderColor: currentColor,
          color: currentColor,
        }}
      >
        <SelectValue placeholder="Set resolution" />
      </SelectTrigger>
      <SelectContent>
        {RESOLUTION_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: option.color }}
              />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
