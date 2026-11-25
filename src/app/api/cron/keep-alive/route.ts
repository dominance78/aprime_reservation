import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  // Vercel Cron의 요청인지 확인하기 위한 보안 인증 (선택 사항이지만 권장)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // reservations 테이블에서 id만 최소한으로 조회하여 DB 활동을 유지합니다.
    const { data, error } = await supabase
      .from('reservations')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Keep-alive ping error:', error);
      return NextResponse.json({ status: 'error', message: 'Ping failed', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', message: 'Supabase keep-alive ping successful', count: data?.length ?? 0 });
  } catch (err) {
    console.error('Unexpected error during keep-alive ping:', err);
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
  }
}
