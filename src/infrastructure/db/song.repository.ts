import type { Prisma } from '../../generated/prisma';
import { db } from './prisma';

export type CreateSongInput = Prisma.SongCreateInput;
export type UpdateSongInput = Prisma.SongUpdateInput;

export const songRepository = {
  findById: (id: string) =>
    db.song.findUnique({ where: { id } }),

  findByUser: (userId: string) =>
    db.song.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    }),

  create: (data: CreateSongInput) =>
    db.song.create({ data }),

  update: (id: string, data: UpdateSongInput) =>
    db.song.update({ where: { id }, data }),

  delete: (id: string) =>
    db.song.delete({ where: { id } }),
};
