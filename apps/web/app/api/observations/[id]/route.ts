import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@orbitstreet/database';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * DELETE /api/observations/[id] — elimina UNA observación PROPIA.
 * El filtro userId en la query garantiza que nadie borra datos ajenos:
 * si no es del usuario, el delete afecta 0 filas → 404.
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
  const deleted = await prisma.observation.deleteMany({
    where: { id, userId: user.id }
  });

  if (deleted.count === 0) {
    return NextResponse.json({ errorCode: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
