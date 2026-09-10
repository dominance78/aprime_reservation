-- 동아리실 예약 시스템 DB 스키마

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  time_slot TIME NOT NULL,
  team_name VARCHAR(50) NOT NULL,
  booker_name VARCHAR(50) NOT NULL,
  password VARCHAR(10) NOT NULL,
  group_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- 한 슬롯당 1팀 단독 예약 방지 (동시성 제어)
  UNIQUE (date, time_slot)
);

-- RLS (Row Level Security) 설정 (원하는 경우)
-- 기본적으로 서버에서 서비스 키(혹은 환경변수 제어)를 통해 CRUD 수행 예정이라면 필수는 아님
