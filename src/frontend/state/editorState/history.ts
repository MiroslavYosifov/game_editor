import type { Scene } from "../../../shared/types";

export interface HistorySnapshot {
  scene: Scene;
  selectedObjectIds: string[];
  gridSize: number;
  snapToGrid: boolean;
}

export interface HistoryState {
  isRestoringHistory: boolean;
  isBatchingHistory: boolean;
  hasBatchHistory: boolean;
}

export function shouldRecordHistory(history: HistoryState): boolean {
  if (history.isRestoringHistory) return false;
  if (history.isBatchingHistory && history.hasBatchHistory) return false;
  return true;
}

export function pushHistorySnapshot(undoStack: HistorySnapshot[], redoStack: HistorySnapshot[], snapshot: HistorySnapshot): void {
  undoStack.push(snapshot);
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}

export function takeUndoSnapshot(
  undoStack: HistorySnapshot[],
  redoStack: HistorySnapshot[],
  currentSnapshot: HistorySnapshot
): HistorySnapshot | null {
  const snapshot = undoStack.pop();
  if (!snapshot) return null;
  redoStack.push(currentSnapshot);
  return snapshot;
}

export function takeRedoSnapshot(
  undoStack: HistorySnapshot[],
  redoStack: HistorySnapshot[],
  currentSnapshot: HistorySnapshot
): HistorySnapshot | null {
  const snapshot = redoStack.pop();
  if (!snapshot) return null;
  undoStack.push(currentSnapshot);
  return snapshot;
}
