import { timeToMinutes } from './gameMode';

export type GreetingPeriod = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

export interface TimePositionInput {
  hour: number;
  minute: number;
  screenWidth: number;
  petSize: number;
  startTime: string;
  endTime: string;
}

export interface EdgeTarget {
  x: number;
  y: number;
  rotation: number;
}

export function getTimePeriodAt(hour: number, minute: number): GreetingPeriod {
  if (hour >= 20 || hour < 5) return 'night';
  if (hour < 11 || (hour === 11 && minute < 30)) return 'morning';
  if (hour < 12 || (hour === 12 && minute < 30)) return 'noon';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function calculateTimePosition(input: TimePositionInput): number {
  const currentMinutes = input.hour * 60 + input.minute;
  const workStartMinutes = timeToMinutes(input.startTime);
  const workEndMinutes = timeToMinutes(input.endTime);
  const totalWorkMinutes = workEndMinutes - workStartMinutes;

  let progress: number;
  if (currentMinutes < workStartMinutes) {
    progress = 0;
  } else if (currentMinutes >= workEndMinutes) {
    progress = 1;
  } else {
    progress = (currentMinutes - workStartMinutes) / totalWorkMinutes;
  }

  const startX = input.screenWidth - input.petSize - 20;
  return startX - progress * startX;
}

export function nextEdgeTarget(segment: string, screenWidth: number, screenHeight: number, petSize: number, bottomMargin: number): EdgeTarget {
  switch (segment) {
    case 'right':
      return { x: screenWidth - petSize, y: screenHeight - petSize - bottomMargin, rotation: 0 };
    case 'bottom':
      return { x: 0, y: screenHeight - petSize - bottomMargin, rotation: 0 };
    case 'left':
      return { x: 0, y: 0, rotation: 90 };
    case 'top':
      return { x: screenWidth - petSize, y: 0, rotation: 180 };
    case 'top_to_right':
      return { x: screenWidth - petSize, y: screenHeight - petSize - bottomMargin, rotation: 270 };
    default:
      return { x: screenWidth - petSize, y: screenHeight - petSize - bottomMargin, rotation: 0 };
  }
}
