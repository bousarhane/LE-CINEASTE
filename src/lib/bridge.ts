import type { ProjectSnapshot, ProjectSummary } from './types';

const STORAGE_KEY = 'scene-writer-projects-v0.1';

function hasTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function invokeTauri<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

function readBrowserProjects(): ProjectSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeBrowserProjects(projects: ProjectSnapshot[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (hasTauri()) return invokeTauri<ProjectSummary[]>('list_projects');
  return readBrowserProjects()
    .map((s) => ({
      id: s.project.id,
      title: s.project.title,
      author: s.project.author,
      projectType: s.project.projectType,
      estimatedDurationMin: s.project.estimatedDurationMin ?? null,
      episodeCount: s.project.episodeCount ?? null,
      updatedAt: s.project.updatedAt
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadProject(projectId: string): Promise<ProjectSnapshot | null> {
  if (hasTauri()) return invokeTauri<ProjectSnapshot | null>('load_project', { projectId });
  return readBrowserProjects().find((s) => s.project.id === projectId) ?? null;
}

export async function saveProject(snapshot: ProjectSnapshot): Promise<void> {
  if (hasTauri()) {
    await invokeTauri<void>('save_project_snapshot', { snapshot });
    return;
  }
  const projects = readBrowserProjects();
  const index = projects.findIndex((p) => p.project.id === snapshot.project.id);
  if (index >= 0) projects[index] = snapshot;
  else projects.push(snapshot);
  writeBrowserProjects(projects);
}

export async function deleteProject(projectId: string): Promise<void> {
  if (hasTauri()) {
    await invokeTauri<void>('delete_project', { projectId });
    return;
  }
  writeBrowserProjects(readBrowserProjects().filter((p) => p.project.id !== projectId));
}

function downloadBrowser(filename: string, content: string, mime = 'text/plain;charset=utf-8'): string {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

export async function exportTextFile(filename: string, content: string, extension: string): Promise<string> {
  if (hasTauri()) return invokeTauri<string>('export_text_file', { filename, content, extension });
  return downloadBrowser(`${filename}.${extension}`, content);
}

export async function exportBinaryFile(filename: string, bytes: Uint8Array, extension: string, mime: string): Promise<string> {
  if (hasTauri()) return invokeTauri<string>('export_binary_file', { filename, bytes: Array.from(bytes), extension });
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${extension}`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}


export function isDesktopRuntime(): boolean {
  return hasTauri();
}
