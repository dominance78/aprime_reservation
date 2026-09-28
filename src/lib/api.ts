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
  // DB 내부의 함수(RPC)를 호출하여 안전하게 삭제 처리
  const { error } = await supabase.rpc('delete_reservation_group', {
    p_group_id: groupId,
    p_password: passwordInput
  });

  if (error) {
    throw new Error(error.message || "예약 취소에 실패했습니다.");
  }
  return true;
}

// 4. 예약 수정 (그룹 ID 기반)
export async function modifyReservationGroup(
  groupId: string, 
  passwordInput: string,
  newReservations: Omit<ReservationDB, "id">[]
) {
  // DB 내부의 함수(RPC)를 호출하여 안전하게 수정(삭제 후 생성) 처리
  const { error } = await supabase.rpc('modify_reservation_group', {
    p_group_id: groupId,
    p_password: passwordInput,
    p_new_reservations: newReservations
  });

  if (error) {
    if (error.message.includes("비밀번호")) {
      throw new Error("비밀번호가 일치하지 않습니다.");
    } else if (error.code === '23505') {
      throw new Error("이미 예약된 시간이 포함되어 있습니다. 다시 확인해주세요.");
    }
    throw new Error("새로운 시간 예약에 실패했습니다.");
  }
  
  return true;
}
