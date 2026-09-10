"use client";

import { useState, useEffect } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import ReservationModal from "@/components/ReservationModal";
import ManageModal from "@/components/ManageModal";
import { fetchReservations, createReservations, cancelReservationGroup, modifyReservationGroup, ReservationDB } from "@/lib/api";

type ReservationData = {
  teamName: string;
  bookerName: string;
  groupId: string;
};
type ReservationsState = Record<string, ReservationData>;

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeFilter, setTimeFilter] = useState("전체");

  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  
  const [availableEndTimes, setAvailableEndTimes] = useState<string[]>([]);
  const [manageModalData, setManageModalData] = useState<{
    reservation: ReservationData;
    currentStart: string;
    currentEnd: string;
    availableBlock: string[];
  } | null>(null);

  const [reservations, setReservations] = useState<ReservationsState>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // 로컬 스토리지에서 초기 데이터 불러오기
  useEffect(() => {
    const localData = localStorage.getItem("localReservations");
    if (localData) {
      setReservations(JSON.parse(localData));
    }
    setIsLoaded(true);
  }, []);

  // 상태가 변경될 때마다 로컬 스토리지에 저장
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("localReservations", JSON.stringify(reservations));
    }
  }, [reservations, isLoaded]);

  // 날짜 변경 시 DB 데이터 Fetch
  useEffect(() => {
    const loadData = async () => {
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const data = await fetchReservations(dateStr, dateStr);
        
        const dbData: ReservationsState = {};
        data.forEach((row) => {
          const key = `${row.date}_${row.time_slot.slice(0, 5)}`; // HH:mm:ss -> HH:mm
          dbData[key] = {
            teamName: row.team_name,
            bookerName: row.booker_name,
            groupId: row.group_id,
          };
        });
        setReservations(prev => ({ ...prev, ...dbData }));
      } catch (err) {
        console.warn("Supabase DB 통신 실패 (환경변수 확인 필요). 로컬 임시 데이터를 유지합니다.", err);
      }
    };
    loadData();
  }, [selectedDate]);

  const dates = Array.from({ length: 15 }, (_, i) => addDays(new Date(), i));
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, "0");
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hours}:${minutes}`;
  });
  const filters = ["전체", "새벽", "오전", "오후", "저녁"];

  const getReservationKey = (date: Date, time: string) => {
    return `${format(date, "yyyy-MM-dd")}_${time}`;
  };

  const handleSlotClick = (time: string, isBooked: boolean) => {
    setSelectedSlot(time);
    
    if (isBooked) {
      const key = getReservationKey(selectedDate, time);
      const clickedData = reservations[key];
      const groupId = clickedData.groupId;
      
      const groupKeys = Object.keys(reservations)
        .filter((k) => k.startsWith(format(selectedDate, "yyyy-MM-dd")) && reservations[k].groupId === groupId)
        .sort();
      
      const currentStart = groupKeys[0].split("_")[1];
      const currentLastSlot = groupKeys[groupKeys.length - 1].split("_")[1];
      const currentLastIndex = timeSlots.indexOf(currentLastSlot);
      const currentEnd = currentLastIndex + 1 < timeSlots.length ? timeSlots[currentLastIndex + 1] : "24:00";

      let minStartIdx = timeSlots.indexOf(currentStart);
      while (minStartIdx > 0 && !reservations[getReservationKey(selectedDate, timeSlots[minStartIdx - 1])]) {
        minStartIdx--;
      }
      
      let maxEndIdx = currentLastIndex;
      while (maxEndIdx < timeSlots.length - 1 && !reservations[getReservationKey(selectedDate, timeSlots[maxEndIdx + 1])]) {
        maxEndIdx++;
      }

      setManageModalData({
        reservation: clickedData,
        currentStart,
        currentEnd,
        availableBlock: timeSlots.slice(minStartIdx, maxEndIdx + 1),
      });
      setIsManageModalOpen(true);
    } else {
      const startIndex = timeSlots.indexOf(time);
      const ends: string[] = [];
      
      for (let i = startIndex + 1; i <= timeSlots.length; i++) {
        const endTimeStr = i === timeSlots.length ? "24:00" : timeSlots[i];
        ends.push(endTimeStr);
        if (i < timeSlots.length && reservations[getReservationKey(selectedDate, timeSlots[i])]) break;
      }
      setAvailableEndTimes(ends);
      setIsReserveModalOpen(true);
    }
  };

  const isDday = isSameDay(selectedDate, new Date());

  const renderSlots = timeSlots.filter((time) => {
    const hour = parseInt(time.split(":")[0], 10);
    if (timeFilter === "새벽" && (hour < 0 || hour >= 6)) return false;
    if (timeFilter === "오전" && (hour < 6 || hour >= 12)) return false;
    if (timeFilter === "오후" && (hour < 12 || hour >= 18)) return false;
    if (timeFilter === "저녁" && (hour < 18 || hour >= 24)) return false;
    if (isDday) return !!reservations[getReservationKey(selectedDate, time)];
    return true;
  });

  const handleReserveSubmit = async (team: string, name: string, endTime: string, password?: string) => {
    if (!selectedSlot) return;
    
    const startIndex = timeSlots.indexOf(selectedSlot);
    const endIndex = endTime === "24:00" ? timeSlots.length : timeSlots.indexOf(endTime);
    const groupId = Math.random().toString(36).substr(2, 9);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const payload: Omit<ReservationDB, "id">[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      payload.push({
        date: dateStr,
        time_slot: timeSlots[i] + ":00", // API DB 규격 맞춤 (HH:mm:ss)
        team_name: team,
        booker_name: name,
        group_id: groupId,
        password: password || "0000",
      });
    }

    try {
      // 1. API 호출 시도
      await createReservations(payload);
      
      // 2. 로컬 State 업데이트
      setReservations((prev) => {
        const next = { ...prev };
        payload.forEach((p) => {
          next[`${dateStr}_${p.time_slot.slice(0, 5)}`] = { teamName: team, bookerName: name, groupId };
        });
        return next;
      });
      
      setIsReserveModalOpen(false);
      alert("예약이 완료되었습니다.");
    } catch (e: any) {
      console.warn("DB 에러:", e.message);
      alert(e.message || "예약에 실패했습니다. 다시 시도해주세요.");
    }
  };

    try {
      await cancelReservationGroup(groupId, passwordInput || "0000");
      
      setReservations((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k].groupId === groupId) delete next[k];
        });
        return next;
      });
      setIsManageModalOpen(false);
      alert("예약이 성공적으로 취소되었습니다.");
    } catch (e: any) {
      console.warn("DB 취소 실패:", e.message);
      alert(e.message || "예약 취소에 실패했습니다. 비밀번호를 다시 확인해주세요.");
    }
  };

  const handleModifySubmit = async (groupId: string, newStart: string, newEnd: string, passwordInput?: string) => {
    // 1. 기존 데이터 찾기
    let teamName = "";
    let bookerName = "";
    Object.keys(reservations).forEach((k) => {
      if (reservations[k].groupId === groupId) {
        teamName = reservations[k].teamName;
        bookerName = reservations[k].bookerName;
      }
    });

    const startIndex = timeSlots.indexOf(newStart);
    const endIndex = newEnd === "24:00" ? timeSlots.length : timeSlots.indexOf(newEnd);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    const payload: Omit<ReservationDB, "id">[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      payload.push({
        date: dateStr,
        time_slot: timeSlots[i] + ":00",
        team_name: teamName,
        booker_name: bookerName,
        group_id: groupId,
        password: passwordInput || "0000",
      });
    }

    try {
      await modifyReservationGroup(groupId, passwordInput || "0000", payload);
      
      // 2. 로컬 State 변경
      setReservations((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k].groupId === groupId) delete next[k];
        });
        payload.forEach((p) => {
          next[`${dateStr}_${p.time_slot.slice(0, 5)}`] = { teamName, bookerName, groupId };
        });
        return next;
      });
      setIsManageModalOpen(false);
      alert("예약 시간이 수정되었습니다.");
    } catch (e: any) {
      console.warn("DB 변경 실패:", e.message);
      alert(e.message || "예약 수정에 실패했습니다. 비밀번호를 확인해주세요.");
    }
  };

  const isContinuation = (time: string, groupId: string) => {
    const idx = timeSlots.indexOf(time);
    if (idx <= 0) return false;
    const prevKey = getReservationKey(selectedDate, timeSlots[idx - 1]);
    return reservations[prevKey]?.groupId === groupId;
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <header className="p-4 bg-[var(--color-primary)] text-white shadow-sm shrink-0">
        <h1 className="text-xl font-bold">어프라임 동아리실 예약 시스템</h1>
        <p className="text-sm mt-1 opacity-90">
          예약 및 수정/취소는 이용 전날 23:59까지 가능합니다.
        </p>
      </header>

      <div className="flex overflow-x-auto p-4 gap-3 no-scrollbar border-b border-gray-100 shrink-0">
        {dates.map((date, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedDate(date)}
            className={`flex flex-col items-center min-w-[60px] p-2 rounded-xl transition-colors ${
              isSameDay(date, selectedDate)
                ? "bg-[var(--color-primary)] text-white font-bold"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className="text-xs">{format(date, "E", { locale: ko })}</span>
            <span className="text-lg">{format(date, "d")}</span>
          </button>
        ))}
      </div>

      {!isDday && (
        <div className="flex px-4 py-3 gap-2 overflow-x-auto no-scrollbar border-b border-gray-100 shrink-0">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                timeFilter === filter
                  ? "bg-[var(--color-secondary)] text-[var(--color-primary)] font-bold"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto bg-gray-50/30">
        {isDday && renderSlots.length === 0 ? (
          <div className="flex items-center justify-center flex-1 h-32 text-gray-500">
            동아리실 예약이 없습니다
          </div>
        ) : (
          renderSlots.map((time) => {
            const key = getReservationKey(selectedDate, time);
            const isBooked = !!reservations[key];
            
            if (isBooked) {
              const res = reservations[key];
              const continues = isContinuation(time, res.groupId);
              
              return (
                <div
                  key={time}
                  onClick={() => !isDday && handleSlotClick(time, true)}
                  className={`flex items-center justify-between p-4 bg-[#E0F2FE] border-x border-[#7DD3FC] shadow-sm transition-colors ${
                    !isDday ? "cursor-pointer hover:bg-sky-100" : "cursor-default opacity-80"
                  } ${continues ? "border-t-0 rounded-b-xl" : "border-t rounded-t-xl"}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-gray-700 w-12">{time}</span>
                    {!continues && (
                      <div className="flex flex-col text-sm text-[#065F46] font-medium">
                        <span>{res.teamName}</span>
                        <span className="text-xs opacity-75">{res.bookerName}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={time}
                onClick={() => handleSlotClick(time, false)}
                className="flex items-center justify-between p-4 bg-white border border-[#A7F3D0] rounded-xl shadow-sm cursor-pointer hover:border-[var(--color-primary)] transition-colors my-1"
              >
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-700 w-12">{time}</span>
                  <span className="text-sm text-gray-500">예약 가능</span>
                </div>
                <button className="px-3 py-1 text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[#00a868] hover:text-white transition-colors">
                  예약
                </button>
              </div>
            );
          })
        )}
      </div>

      <ReservationModal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        // @ts-ignore
        onSuccess={handleReserveSubmit}
        date={selectedDate}
        timeSlot={selectedSlot}
        availableEndTimes={availableEndTimes}
      />

      <ManageModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        // @ts-ignore
        onCancelSuccess={handleCancelSubmit}
        // @ts-ignore
        onModifySuccess={handleModifySubmit}
        date={selectedDate}
        reservation={manageModalData?.reservation}
        currentStart={manageModalData?.currentStart || ""}
        currentEnd={manageModalData?.currentEnd || ""}
        availableBlock={manageModalData?.availableBlock || []}
        fullTimeSlots={timeSlots}
      />
    </div>
  );
}
