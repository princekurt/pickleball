import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTeamName(team: {
  name?: string | null;
  player1: { name: string };
  player2?: { name: string } | null;
}): string {
  if (team.name) return team.name;
  if (team.player2) return `${team.player1.name} & ${team.player2.name}`;
  return team.player1.name;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'in_progress':
      return 'bg-green-500';
    case 'scheduled':
    case 'setup':
      return 'bg-blue-500';
    case 'completed':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'scheduled':
      return 'Scheduled';
    case 'setup':
      return 'Setup';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

export const SKILL_LEVELS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
