import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listSessions } from '@/lib/services/history-service';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const result = await listSessions(user.id, page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to list history:', error);
    return NextResponse.json({ error: '获取历史记录失败' }, { status: 500 });
  }
}
