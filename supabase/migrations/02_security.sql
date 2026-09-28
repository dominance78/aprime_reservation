-- 1. RLS(Row Level Security) 활성화
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 2. 누구나 예약 내역을 볼 수 있도록 SELECT 허용
CREATE POLICY "누구나 예약 조회 가능" 
ON reservations FOR SELECT 
USING (true);

-- 3. 누구나 예약을 생성할 수 있도록 INSERT 허용
CREATE POLICY "누구나 예약 생성 가능" 
ON reservations FOR INSERT 
WITH CHECK (true);

-- 4. 외부 API(익명 사용자)가 password 컬럼을 아예 조회하지 못하도록 차단 (경고 해결의 핵심)
REVOKE SELECT (password) ON reservations FROM anon, authenticated;

-- 5. 안전한 예약 삭제를 위한 내부 함수(RPC) 생성
CREATE OR REPLACE FUNCTION delete_reservation_group(
  p_group_id VARCHAR,
  p_password VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- 비밀번호가 일치하는 예약만 삭제
  DELETE FROM reservations 
  WHERE group_id = p_group_id AND password = p_password;
  
  -- 삭제된 행의 개수 확인
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION '비밀번호가 일치하지 않거나 예약 정보를 찾을 수 없습니다.';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 안전한 예약 수정을 위한 내부 함수(RPC) 생성
CREATE OR REPLACE FUNCTION modify_reservation_group(
  p_group_id VARCHAR,
  p_password VARCHAR,
  p_new_reservations JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_isValid BOOLEAN;
BEGIN
  -- 1) 비밀번호 확인
  SELECT EXISTS(
    SELECT 1 FROM reservations 
    WHERE group_id = p_group_id AND password = p_password
  ) INTO v_isValid;

  IF NOT v_isValid THEN
    RAISE EXCEPTION '비밀번호가 일치하지 않습니다.';
  END IF;

  -- 2) 기존 그룹 예약 삭제
  DELETE FROM reservations WHERE group_id = p_group_id;

  -- 3) 새 예약 삽입
  INSERT INTO reservations (date, time_slot, team_name, booker_name, password, group_id)
  SELECT 
    (elem->>'date')::DATE,
    (elem->>'time_slot')::TIME,
    elem->>'team_name',
    elem->>'booker_name',
    elem->>'password',
    elem->>'group_id'
  FROM jsonb_array_elements(p_new_reservations) AS elem;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
