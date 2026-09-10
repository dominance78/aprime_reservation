import { supabase } from "./supabase";

export interface ReservationDB {
  id: string;
  date: string;
  time_slot: string;
  team_name: string;
  booker_name: string;
  password?: string;
  group_id: string;
}

// 1. 기간 내 예약 조회
export async function fetchReservations(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, date, time_slot, team_name, booker_name, group_id")
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw error;
  return data as ReservationDB[];
}

// 2. 신규 예약 생성 (다중 슬롯)
export async function createReservations(reservations: Omit<ReservationDB, "id">[]) {
  const { data, error } = await supabase
    .from("reservations")
    .insert(reservations)
    .select();

  if (error) {
    if (error.code === '23505') {
      throw new Error("이미 예약된 시간이 포함되어 있습니다. 다시 확인해주세요.");
    }
    throw error;
  }
  return data;
}

// 3. 예약 취소 (그룹 ID 기반)
export async function cancelReservationGroup(groupId: string, passwordInput: string) {
  // 비밀번호 확인을 위해 해당 그룹의 첫번째 데이터를 가져옴
  const { data: groupData, error: fetchError } = await supabase
    .from("reservations")
    .select("password")
    .eq("group_id", groupId)
    .limit(1)
    .single();

  if (fetchError || !groupData) throw new Error("예약 정보를 찾을 수 없습니다.");
  if (groupData.password !== passwordInput) throw new Error("비밀번호가 일치하지 않습니다.");

  // 일치하면 그룹 전체 삭제
  const { error: deleteError } = await supabase
    .from("reservations")
    .delete()
    .eq("group_id", groupId);

  if (deleteError) throw deleteError;
  return true;
}

// 4. 예약 수정 (그룹 ID 기반)
export async function modifyReservationGroup(
  groupId: string, 
  passwordInput: string,
  newReservations: Omit<ReservationDB, "id">[]
) {
  // 1) 비밀번호 검증
  const { data: groupData, error: fetchError } = await supabase
    .from("reservations")
    .select("password")
    .eq("group_id", groupId)
    .limit(1)
    .single();

  if (fetchError || !groupData) throw new Error("예약 정보를 찾을 수 없습니다.");
  if (groupData.password !== passwordInput) throw new Error("비밀번호가 일치하지 않습니다.");

  // 2) 트랜잭션과 유사하게 기존 데이터 삭제 후 새 데이터 삽입 (RPC 사용 권장되나, 클라이언트 레벨에서 임시 구현)
  const { error: deleteError } = await supabase
    .from("reservations")
    .delete()
    .eq("group_id", groupId);
    
  if (deleteError) throw deleteError;

  const { data, error: insertError } = await supabase
    .from("reservations")
    .insert(newReservations)
    .select();

  if (insertError) {
    // 롤백 처리는 복잡하므로 실 서비스에서는 DB 함수(RPC)로 처리하는 것이 안전함
    throw new Error("새로운 시간 예약에 실패했습니다.");
  }
  
  return data;
}
