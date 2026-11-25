import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => {
      const urlStr = url.toString();
      // 클라이언트(브라우저)에서 Supabase API 호출 시, 프록시(/api/supabase) 경로로 치환하여 CORS 에러를 방지합니다.
      if (typeof window !== 'undefined' && urlStr.startsWith(supabaseUrl)) {
        const proxyUrl = urlStr.replace(supabaseUrl, '/api/supabase');
        return fetch(proxyUrl, { ...options, cache: 'no-store' });
      }
      // 서버 사이드 랜더링 시에는 원래 URL로 바로 요청합니다.
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});
