import { randomUUID } from 'crypto';
import { getDb, ensureDb } from '@/lib/db';
import type { MiniSession, PomodoroProgram } from '@/domain/pomodoro/types';

export type { PomodoroProgram, MiniSession };

export interface CreateProgramInput {
  name:     string;
  sessions: MiniSession[];
}

export type UpdateProgramInput = Partial<CreateProgramInput>;

function stamp(): string {
  return new Date().toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProgram(row: Record<string, any>): PomodoroProgram {
  return {
    id:        row.id as string,
    name:      row.name as string,
    sessions:  JSON.parse(row.sessions as string) as MiniSession[],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const pomodoroStore = {
  findAll: async (): Promise<PomodoroProgram[]> => {
    await ensureDb();
    const result = await getDb().execute(
      'SELECT * FROM pomodoro_programs ORDER BY updated_at DESC',
    );
    return result.rows.map(rowToProgram);
  },

  findById: async (id: string): Promise<PomodoroProgram | undefined> => {
    await ensureDb();
    const result = await getDb().execute({
      sql:  'SELECT * FROM pomodoro_programs WHERE id = ?',
      args: [id],
    });
    return result.rows[0] ? rowToProgram(result.rows[0]) : undefined;
  },

  create: async (input: CreateProgramInput): Promise<PomodoroProgram> => {
    await ensureDb();
    const now = stamp();
    const program: PomodoroProgram = {
      id:        randomUUID(),
      name:      input.name.trim(),
      sessions:  input.sessions,
      createdAt: now,
      updatedAt: now,
    };
    await getDb().execute({
      sql: `INSERT INTO pomodoro_programs (id, name, sessions, created_at, updated_at)
            VALUES (?,?,?,?,?)`,
      args: [
        program.id, program.name, JSON.stringify(program.sessions),
        program.createdAt, program.updatedAt,
      ],
    });
    return program;
  },

  update: async (id: string, input: UpdateProgramInput): Promise<PomodoroProgram> => {
    await ensureDb();
    const existing = await pomodoroStore.findById(id);
    if (!existing) throw new Error(`Pomodoro program ${id} not found`);

    const updated: PomodoroProgram = {
      ...existing,
      ...input,
      name:      (input.name ?? existing.name).trim(),
      updatedAt: stamp(),
    };
    await getDb().execute({
      sql: `UPDATE pomodoro_programs SET name = ?, sessions = ?, updated_at = ?
            WHERE id = ?`,
      args: [updated.name, JSON.stringify(updated.sessions), updated.updatedAt, id],
    });
    return updated;
  },

  delete: async (id: string): Promise<void> => {
    await ensureDb();
    await getDb().execute({ sql: 'DELETE FROM pomodoro_programs WHERE id = ?', args: [id] });
  },
};
