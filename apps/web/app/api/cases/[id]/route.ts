import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@orbitstreet/database';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * DELETE /api/cases/[id] — elimina UN caso PROPIO del tablón.
 * Las confirmaciones ciudadanas se borran en cascada (onDelete: Cascade
 * ya configurado). El filtro userId impide borrar casos ajenos.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await prisma.case.deleteMany({
    where: { id, userId: user.id }
  });

  if (deleted.count === 0) {
    return NextResponse.json({ errorCode: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
