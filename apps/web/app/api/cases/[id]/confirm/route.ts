import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@orbitstreet/database';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * POST /api/cases/[id]/confirm — "Yo lo observo" (requiere sesión).
 * Una confirmación por usuario y caso (unique [caseId, userId]):
 * idempotente (200 con already=true si ya confirmó). El conteo lo
 * devuelve; los veredictos NUNCA se alteran: son matemática, no votos.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const caseExists = await prisma.case.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!caseExists) {
    return NextResponse.json({ errorCode: 'not_found' }, { status: 404 });
  }

  try {
    await prisma.caseConfirmation.create({
      data: { caseId: id, userId: user.id }
    });
  } catch (error) {
    // Unique violado → ya confirmó: idempotente.
    if (
      error instanceof Error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      const count = await prisma.caseConfirmation.count({
        where: { caseId: id }
      });
      return NextResponse.json({ count, already: true });
    }
    throw error;
  }

  const count = await prisma.caseConfirmation.count({
    where: { caseId: id }
  });
  return NextResponse.json({ count, already: false });
}
