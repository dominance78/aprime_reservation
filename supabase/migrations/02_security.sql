-- 1. RLS(Row Level Security) 활성화
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 2. 누구나 예약 내역을 볼 수 있도록 SELECT 허용
DROP POLICY IF EXISTS "누구나 예약 조회 가능" ON reservations;
CREATE POLICY "누구나 예약 조회 가능"
ON reservations FOR SELECT
USING (true);

-- 3. 예약 생성 허용 (KST 기준 내일 ~ 14일 이내만 허용, 당일/과거 차단)
DROP POLICY IF EXISTS "누구나 예약 생성 가능" ON reservations;
CREATE POLICY "누구나 예약 생성 가능"
ON reservations FOR INSERT
WITH CHECK (
  date > (now() AT TIME ZONE 'Asia/Seoul')::DATE
  AND date <= ((now() AT TIME ZONE 'Asia/Seoul')::DATE + INTERVAL '14 days')::DATE
);

-- 4. 외부 API(익명 사용자)가 password 컬럼을 아예 조회하지 못하도록 차단
REVOKE SELECT (password) ON reservations FROM anon, authenticated;

-- 5. 안전한 예약 삭제를 위한 내부 함수(RPC) 생성
CREATE OR REPLACE FUNCTION delete_reservation_group(
  p_group_id VARCHAR,
  p_password VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_deleted_count INTEGER;
  v_today_kst DATE := (now() AT TIME ZONE 'Asia/Seoul')::DATE;
  v_target_date DATE;
BEGIN
  -- 예약 날짜 및 비밀번호 검증
  SELECT MIN(date) INTO v_target_date
  FROM reservations
  WHERE group_id = p_group_id AND password = p_password;

  IF v_target_date IS NULL THEN
    RAISE EXCEPTION '비밀번호가 일치하지 않거나 예약 정보를 찾을 수 없습니다.';
  END IF;

  IF v_target_date <= v_today_kst THEN
    RAISE EXCEPTION '당일 또는 지난 예약은 취소할 수 없습니다.';
  END IF;

  -- 비밀번호가 일치하는 예약만 삭제
  DELETE FROM reservations
  WHERE group_id = p_group_id AND password = p_password;

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
  v_today_kst DATE := (now() AT TIME ZONE 'Asia/Seoul')::DATE;
  v_target_date DATE;
  v_invalid_new_date BOOLEAN;
BEGIN
  IF p_new_reservations IS NULL OR jsonb_array_length(p_new_reservations) = 0 THEN
    RAISE EXCEPTION '수정할 예약 시간이 비어 있습니다.';
  END IF;

  -- 1) 비밀번호 및 기존 예약 날짜 확인
  SELECT MIN(date) INTO v_target_date
  FROM reservations
  WHERE group_id = p_group_id AND password = p_password;

  IF v_target_date IS NULL THEN
    RAISE EXCEPTION '비밀번호가 일치하지 않습니다.';
  END IF;

  IF v_target_date <= v_today_kst THEN
    RAISE EXCEPTION '당일 또는 지난 예약은 수정할 수 없습니다.';
  END IF;

  -- 2) 새로 요청된 날짜가 KST 기준 허용 범위(내일 ~ 14일 이내)인지 확인
  SELECT EXISTS(
    SELECT 1
    FROM jsonb_array_elements(p_new_reservations) AS elem
    WHERE (elem->>'date')::DATE <= v_today_kst
       OR (elem->>'date')::DATE > (v_today_kst + INTERVAL '14 days')::DATE
  ) INTO v_invalid_new_date;

  IF v_invalid_new_date THEN
    RAISE EXCEPTION '예약 가능한 기간(이용일 D-14 ~ D-1)이 아닙니다.';
  END IF;

  -- 3) 기존 그룹 예약 삭제
  DELETE FROM reservations WHERE group_id = p_group_id AND password = p_password;

  -- 4) 새 예약 삽입 (group_id와 password는 검증된 값으로 고정)
  INSERT INTO reservations (date, time_slot, team_name, booker_name, password, group_id)
  SELECT
    (elem->>'date')::DATE,
    (elem->>'time_slot')::TIME,
    elem->>'team_name',
    elem->>'booker_name',
    p_password,
    p_group_id
  FROM jsonb_array_elements(p_new_reservations) AS elem;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
