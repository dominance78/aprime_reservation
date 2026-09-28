import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  // Vercel Cron의 요청인지 확인하기 위한 보안 인증 (선택 사항이지만 권장)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 아무 테이블이나 조회해서 데이터베이스에 활동(activity)을 만들어줍니다.
    // LIMIT 1을 사용해 최소한의 리소스만 사용합니다.
    // 사용하는 테이블 이름이 확실하지 않은 경우 가장 안전한 방법은 다음과 같습니다.
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
      // 테이블이 없더라도 요청 자체는 성공적으로 수신되었으므로 활동으로 인정될 수 있습니다.
      console.error('Keep-alive ping error (might be normal if table does not exist):', error);
      return NextResponse.json({ status: 'ok', message: 'Ping sent with error', error: error.message });
    }

    return NextResponse.json({ status: 'ok', message: 'Supabase keep-alive ping successful', data });
  } catch (err) {
    console.error('Unexpected error during keep-alive ping:', err);
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
  }
}
