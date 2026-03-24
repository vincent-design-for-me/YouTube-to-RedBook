import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSessionDetail, deleteSession } from '@/lib/services/history-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    const session = await getSessionDetail(sessionId, user.id);
    if (!session) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Failed to get session detail:', error);
    return NextResponse.json({ error: '获取详情失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    await deleteSession(sessionId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
