"use client";

import { useState } from "react";
import { format } from "date-fns";
import { TEAM_LIST, TeamName } from "@/constants/teams";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (team: string, name: string, endTime: string, password: string) => Promise<boolean>;
  date: Date | null;
  timeSlot: string | null;
  availableEndTimes: string[];
}

export default function ReservationModal({
  isOpen,
  onClose,
  onSuccess,
  date,
  timeSlot,
  availableEndTimes,
}: ReservationModalProps) {
  const [team, setTeam] = useState<TeamName | "">("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !date || !timeSlot) return null;

  const effectiveEndTime = availableEndTimes.includes(endTime)
    ? endTime
    : (availableEndTimes[0] ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!team) {
      alert("팀을 선택해주세요.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert("예약자 이름을 입력해주세요.");
      return;
    }

    if (!/^\d{4}$/.test(password)) {
      alert("비밀번호는 숫자 4자리로 입력해주세요.");
      return;
    }

    if (!effectiveEndTime) {
      alert("종료 시간을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const succeeded = await onSuccess(team, trimmedName, effectiveEndTime, password);
      if (succeeded) {
        setTeam("");
        setName("");
        setPassword("");
        setEndTime("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 bg-primary text-white">
          <h2 className="text-lg font-bold">새 예약 신청</h2>
          <p className="text-sm opacity-90">
            {format(date, "yyyy년 MM월 dd일")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
              <div className="w-full border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-gray-500 cursor-not-allowed">
                {timeSlot}
              </div>
            </div>
            <div className="flex items-center justify-center pt-6 text-gray-400">~</div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
              <select
                required
                disabled={isSubmitting}
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary disabled:bg-gray-100"
                value={effectiveEndTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                {availableEndTimes.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">팀 선택</label>
            <select
              required
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary disabled:bg-gray-100"
              value={team}
              onChange={(e) => setTeam(e.target.value as TeamName)}
            >
              <option value="" disabled>팀을 선택해주세요</option>
              {TEAM_LIST.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">예약자 이름</label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              maxLength={10}
              placeholder="이름 입력 (최대 10자)"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary disabled:bg-gray-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 (숫자 4자리)</label>
            <input
              type="password"
              inputMode="numeric"
              required
              disabled={isSubmitting}
              pattern="\d{4}"
              maxLength={4}
              placeholder="취소/수정 시 사용할 비밀번호"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary disabled:bg-gray-100"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 min-h-11 py-2.5 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-11 py-2.5 rounded-lg font-medium text-white bg-primary hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "예약 중..." : "예약하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
