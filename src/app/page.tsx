"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { format, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import ReservationModal from "@/components/ReservationModal";
import ManageModal from "@/components/ManageModal";
import {
  fetchReservations,
  createReservations,
  cancelReservationGroup,
  modifyReservationGroup,
  ReservationDB,
} from "@/lib/api";
import {
  TIME_SLOTS,
  getKstCurrentSlot,
  getKstDateList,
  isKstToday,
  isKstTodayOrPast,
} from "@/lib/date";

type ReservationData = {
  teamName: string;
  bookerName: string;
  groupId: string;
};
type ReservationsState = Record<string, ReservationData>;

const FILTERS = ["전체", "새벽", "오전", "오후", "저녁"] as const;
const LOCAL_STORAGE_KEY = "localReservations";

const emptySubscribe = () => () => {};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function generateGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function readLocalReservations(): ReservationsState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ReservationsState;
    }
    return {};
  } catch {
    return {};
  }
}

export default function Home() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [nowTick, setNowTick] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeFilter, setTimeFilter] = useState<(typeof FILTERS)[number]>("전체");

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

  // 1분마다 현재 시각 기준(KST) 갱신
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick((prev) => prev + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dates = useMemo(() => {
    if (!isClient) return [];
    void nowTick;
    return getKstDateList(15);
  }, [isClient, nowTick]);

  const activeDate = selectedDate ?? dates[0] ?? null;
  const activeDateStr = activeDate ? format(activeDate, "yyyy-MM-dd") : null;

  const persistReservations = useCallback((next: ReservationsState) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 스토리지 용량 초과 등 예외 무시
    }
  }, []);

  const loadReservationsForDate = useCallback(
    async (dateStr: string, isCancelled?: () => boolean) => {
      try {
        const data = await fetchReservations(dateStr, dateStr);
        if (isCancelled?.()) return;

        const dbData: ReservationsState = {};
        data.forEach((row) => {
          const key = `${row.date}_${row.time_slot.slice(0, 5)}`;
          dbData[key] = {
            teamName: row.team_name,
            bookerName: row.booker_name,
            groupId: row.group_id,
          };
        });

        setReservations((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${dateStr}_`)) {
              delete next[k];
            }
          });
          const merged = { ...next, ...dbData };
          persistReservations(merged);
          return merged;
        });
      } catch (err) {
        console.warn("Supabase DB 통신 실패 (환경변수 확인 필요).", err);
        if (isCancelled?.()) return;
        const cached = readLocalReservations();
        setReservations((prev) => (Object.keys(prev).length === 0 ? cached : prev));
      }
    },
    [persistReservations]
  );

  // 날짜 변경 시 DB 데이터 Fetch
  useEffect(() => {
    if (!activeDateStr) return;
    let cancelled = false;

    const run = async () => {
      await loadReservationsForDate(activeDateStr, () => cancelled);
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [activeDateStr, loadReservationsForDate]);

  // 화면이 다시 활성화될 때 최신 데이터 동기화
  useEffect(() => {
    if (!activeDateStr) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadReservationsForDate(activeDateStr);
      }
    };
    const handleFocus = () => {
      void loadReservationsForDate(activeDateStr);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [activeDateStr, loadReservationsForDate]);

  const getReservationKey = (dateStr: string, time: string) => `${dateStr}_${time}`;

  const isDday = activeDate ? isKstToday(activeDate) : false;
  const isLockedDate = activeDate ? isKstTodayOrPast(activeDate) : true;
  const currentKstSlot = isClient ? getKstCurrentSlot() : "";

  const handleSlotClick = (time: string, isBooked: boolean) => {
    if (!activeDateStr || isLockedDate) return;
    setSelectedSlot(time);

    if (isBooked) {
      const key = getReservationKey(activeDateStr, time);
      const clickedData = reservations[key];
      if (!clickedData) return;
      const groupId = clickedData.groupId;

      const groupKeys = Object.keys(reservations)
        .filter((k) => k.startsWith(`${activeDateStr}_`) && reservations[k].groupId === groupId)
        .sort();

      if (groupKeys.length === 0) return;

      const currentStart = groupKeys[0].split("_")[1];
      const currentLastSlot = groupKeys[groupKeys.length - 1].split("_")[1];
      const currentLastIndex = TIME_SLOTS.indexOf(currentLastSlot);
      const currentEnd =
        currentLastIndex + 1 < TIME_SLOTS.length ? TIME_SLOTS[currentLastIndex + 1] : "24:00";

      let minStartIdx = TIME_SLOTS.indexOf(currentStart);
      while (
        minStartIdx > 0 &&
        !reservations[getReservationKey(activeDateStr, TIME_SLOTS[minStartIdx - 1])]
      ) {
        minStartIdx--;
      }

      let maxEndIdx = currentLastIndex;
      while (
        maxEndIdx < TIME_SLOTS.length - 1 &&
        !reservations[getReservationKey(activeDateStr, TIME_SLOTS[maxEndIdx + 1])]
      ) {
        maxEndIdx++;
      }

      setManageModalData({
        reservation: clickedData,
        currentStart,
        currentEnd,
        availableBlock: TIME_SLOTS.slice(minStartIdx, maxEndIdx + 1),
      });
      setIsManageModalOpen(true);
    } else {
      const startIndex = TIME_SLOTS.indexOf(time);
      const ends: string[] = [];

      for (let i = startIndex + 1; i <= TIME_SLOTS.length; i++) {
        const endTimeStr = i === TIME_SLOTS.length ? "24:00" : TIME_SLOTS[i];
        ends.push(endTimeStr);
        if (i < TIME_SLOTS.length && reservations[getReservationKey(activeDateStr, TIME_SLOTS[i])]) {
          break;
        }
      }
      setAvailableEndTimes(ends);
      setIsReserveModalOpen(true);
    }
  };

  const renderSlots = activeDateStr
    ? TIME_SLOTS.filter((time) => {
        const hour = parseInt(time.split(":")[0], 10);
        if (timeFilter === "새벽" && (hour < 0 || hour >= 6)) return false;
        if (timeFilter === "오전" && (hour < 6 || hour >= 12)) return false;
        if (timeFilter === "오후" && (hour < 12 || hour >= 18)) return false;
        if (timeFilter === "저녁" && (hour < 18 || hour >= 24)) return false;
        if (isDday) return !!reservations[getReservationKey(activeDateStr, time)];
        return true;
      })
    : [];

  const handleReserveSubmit = async (
    team: string,
    name: string,
    endTime: string,
    password: string
  ): Promise<boolean> => {
    if (!selectedSlot || !activeDate || !activeDateStr) return false;

    if (isKstTodayOrPast(activeDate)) {
      alert("당일 또는 지난 날짜는 예약할 수 없습니다.");
      return false;
    }

    const startIndex = TIME_SLOTS.indexOf(selectedSlot);
    const endIndex = endTime === "24:00" ? TIME_SLOTS.length : TIME_SLOTS.indexOf(endTime);
    if (startIndex === -1 || endIndex <= startIndex) {
      alert("올바른 시간 범위를 선택해주세요.");
      return false;
    }

    const groupId = generateGroupId();
    const payload: Omit<ReservationDB, "id">[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      payload.push({
        date: activeDateStr,
        time_slot: `${TIME_SLOTS[i]}:00`,
        team_name: team,
        booker_name: name,
        group_id: groupId,
        password,
      });
    }

    try {
      await createReservations(payload);

      setReservations((prev) => {
        const next = { ...prev };
        payload.forEach((p) => {
          next[`${activeDateStr}_${p.time_slot.slice(0, 5)}`] = {
            teamName: team,
            bookerName: name,
            groupId,
          };
        });
        persistReservations(next);
        return next;
      });

      setIsReserveModalOpen(false);
      alert("예약이 신청되었습니다.");
      return true;
    } catch (e: unknown) {
      const message = getErrorMessage(e, "예약에 실패했습니다. 다시 시도해주세요.");
      console.warn("DB 에러:", message);
      alert(message);
      void loadReservationsForDate(activeDateStr);
      return false;
    }
  };

  const handleCancelSubmit = async (groupId: string, passwordInput: string): Promise<boolean> => {
    if (!activeDate || !activeDateStr) return false;

    if (isKstTodayOrPast(activeDate)) {
      alert("당일 또는 지난 예약은 취소할 수 없습니다.");
      return false;
    }

    try {
      await cancelReservationGroup(groupId, passwordInput);

      setReservations((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k].groupId === groupId) delete next[k];
        });
        persistReservations(next);
        return next;
      });
      setIsManageModalOpen(false);
      alert("예약이 성공적으로 취소되었습니다.");
      return true;
    } catch (e: unknown) {
      const message = getErrorMessage(
        e,
        "예약 취소에 실패했습니다. 비밀번호를 다시 확인해주세요."
      );
      console.warn("DB 취소 실패:", message);
      alert(message);
      return false;
    }
  };

  const handleModifySubmit = async (
    groupId: string,
    newStart: string,
    newEnd: string,
    passwordInput: string
  ): Promise<boolean> => {
    if (!activeDate || !activeDateStr) return false;

    if (isKstTodayOrPast(activeDate)) {
      alert("당일 또는 지난 예약은 수정할 수 없습니다.");
      return false;
    }

    let teamName = "";
    let bookerName = "";
    Object.keys(reservations).forEach((k) => {
      if (reservations[k].groupId === groupId) {
        teamName = reservations[k].teamName;
        bookerName = reservations[k].bookerName;
      }
    });

    const startIndex = TIME_SLOTS.indexOf(newStart);
    const endIndex = newEnd === "24:00" ? TIME_SLOTS.length : TIME_SLOTS.indexOf(newEnd);
    if (startIndex === -1 || endIndex <= startIndex) {
      alert("올바른 시간 범위를 선택해주세요.");
      return false;
    }

    const payload: Omit<ReservationDB, "id">[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      payload.push({
        date: activeDateStr,
        time_slot: `${TIME_SLOTS[i]}:00`,
        team_name: teamName,
        booker_name: bookerName,
        group_id: groupId,
        password: passwordInput,
      });
    }

    try {
      await modifyReservationGroup(groupId, passwordInput, payload);

      setReservations((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k].groupId === groupId) delete next[k];
        });
        payload.forEach((p) => {
          next[`${activeDateStr}_${p.time_slot.slice(0, 5)}`] = {
            teamName,
            bookerName,
            groupId,
          };
        });
        persistReservations(next);
        return next;
      });
      setIsManageModalOpen(false);
      alert("예약 시간이 수정되었습니다.");
      return true;
    } catch (e: unknown) {
      const message = getErrorMessage(
        e,
        "예약 수정에 실패했습니다. 비밀번호를 확인해주세요."
      );
      console.warn("DB 변경 실패:", message);
      alert(message);
      void loadReservationsForDate(activeDateStr);
      return false;
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <header className="p-4 bg-primary text-white shadow-sm shrink-0">
        <h1 className="text-xl font-bold">어프라임 동아리실 예약 시스템</h1>
        <p className="text-sm mt-1 opacity-90">
          예약 및 수정/취소는 이용 전날 23:59까지 가능합니다.
        </p>
      </header>

      <div className="flex overflow-x-auto p-4 gap-3 no-scrollbar border-b border-gray-100 shrink-0">
        {!isClient ? (
          <div className="flex gap-3 w-full">
            {Array.from({ length: 6 }, (_, idx) => (
              <div
                key={idx}
                className="min-w-15 h-15 rounded-xl bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : (
          dates.map((date) => {
            const dateKey = format(date, "yyyy-MM-dd");
            const isSelected = activeDate ? isSameDay(date, activeDate) : false;
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center min-w-15 min-h-14 p-2 rounded-xl transition-colors ${
                  isSelected
                    ? "bg-primary text-white font-bold"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="text-xs">{format(date, "E", { locale: ko })}</span>
                <span className="text-lg">{format(date, "d")}</span>
              </button>
            );
          })
        )}
      </div>

      {isClient && !isDday && (
        <div className="flex px-4 py-3 gap-2 overflow-x-auto no-scrollbar border-b border-gray-100 shrink-0">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTimeFilter(filter)}
              className={`min-h-11 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                timeFilter === filter
                  ? "bg-secondary text-primary font-bold"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 flex flex-col flex-1 overflow-y-auto bg-gray-50/30">
        {!isClient || !activeDateStr ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, idx) => (
              <div key={idx} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : isDday && renderSlots.length === 0 ? (
          <div className="flex items-center justify-center flex-1 h-32 text-gray-500">
            동아리실 예약이 없습니다
          </div>
        ) : (
          renderSlots.map((time, idx) => {
            const key = getReservationKey(activeDateStr, time);
            const res = reservations[key];
            const isCurrentSlot = isDday && time === currentKstSlot;

            if (res) {
              const prevTime = idx > 0 ? renderSlots[idx - 1] : null;
              const nextTime = idx < renderSlots.length - 1 ? renderSlots[idx + 1] : null;
              const timeIdx = TIME_SLOTS.indexOf(time);

              const continuesFromPrev =
                prevTime !== null &&
                timeIdx - TIME_SLOTS.indexOf(prevTime) === 1 &&
                reservations[getReservationKey(activeDateStr, prevTime)]?.groupId === res.groupId;

              const continuesToNext =
                nextTime !== null &&
                TIME_SLOTS.indexOf(nextTime) - timeIdx === 1 &&
                reservations[getReservationKey(activeDateStr, nextTime)]?.groupId === res.groupId;

              const borderRadiusClass =
                !continuesFromPrev && !continuesToNext
                  ? "rounded-xl border"
                  : !continuesFromPrev
                    ? "rounded-t-xl border-t border-x"
                    : !continuesToNext
                      ? "rounded-b-xl border-b border-x"
                      : "border-x";

              const spacingClass = continuesFromPrev ? "" : "mt-2 first:mt-0";

              return (
                <div
                  key={time}
                  onClick={() => !isLockedDate && handleSlotClick(time, true)}
                  className={`flex items-center justify-between min-h-14 p-4 bg-sky-100 border-sky-300 shadow-sm transition-colors ${borderRadiusClass} ${spacingClass} ${
                    !isLockedDate ? "cursor-pointer hover:bg-sky-200/70" : "cursor-default opacity-90"
                  } ${isCurrentSlot ? "ring-2 ring-emerald-700" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-gray-700 w-12">{time}</span>
                    {!continuesFromPrev && (
                      <div className="flex flex-col text-sm text-emerald-800 font-medium">
                        <span>{res.teamName}</span>
                        <span className="text-xs opacity-75">{res.bookerName}</span>
                      </div>
                    )}
                  </div>
                  {isCurrentSlot && (
                    <span className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-700 rounded-full shrink-0">
                      🔴 이용 중
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={time}
                onClick={() => handleSlotClick(time, false)}
                className="flex items-center justify-between min-h-14 p-4 bg-white border border-emerald-200 rounded-xl shadow-sm cursor-pointer hover:border-primary transition-colors mt-2 first:mt-0"
              >
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-700 w-12">{time}</span>
                  <span className="text-sm text-gray-500">예약 가능</span>
                </div>
                <button
                  type="button"
                  className="min-h-9 px-3 py-1 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                >
                  예약
                </button>
              </div>
            );
          })
        )}
      </div>

      {isReserveModalOpen && activeDate && selectedSlot && (
        <ReservationModal
          key={`${activeDateStr}_${selectedSlot}`}
          isOpen={isReserveModalOpen}
          onClose={() => setIsReserveModalOpen(false)}
          onSuccess={handleReserveSubmit}
          date={activeDate}
          timeSlot={selectedSlot}
          availableEndTimes={availableEndTimes}
        />
      )}

      {isManageModalOpen && activeDate && manageModalData && (
        <ManageModal
          key={`${manageModalData.reservation.groupId}_${manageModalData.currentStart}_${manageModalData.currentEnd}`}
          isOpen={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          onCancelSuccess={handleCancelSubmit}
          onModifySuccess={handleModifySubmit}
          date={activeDate}
          reservation={manageModalData.reservation}
          currentStart={manageModalData.currentStart}
          currentEnd={manageModalData.currentEnd}
          availableBlock={manageModalData.availableBlock}
          fullTimeSlots={TIME_SLOTS}
        />
      )}
    </div>
  );
}
