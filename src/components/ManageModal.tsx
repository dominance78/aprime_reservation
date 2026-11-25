"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { isKstTodayOrPast } from "@/lib/date";

interface ManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancelSuccess: (groupId: string, passwordInput: string) => Promise<boolean>;
  onModifySuccess: (groupId: string, newStart: string, newEnd: string, passwordInput: string) => Promise<boolean>;
  date: Date | null;
  reservation?: {
    teamName: string;
    bookerName: string;
    groupId: string;
  };
  currentStart: string;
  currentEnd: string;
  availableBlock: string[];
  fullTimeSlots: string[];
}

export default function ManageModal({
  isOpen,
  onClose,
  onCancelSuccess,
  onModifySuccess,
  date,
  reservation,
  currentStart,
  currentEnd,
  availableBlock,
  fullTimeSlots,
}: ManageModalProps) {
  const [password, setPassword] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [newStart, setNewStart] = useState(currentStart);
  const [newEnd, setNewEnd] = useState(currentEnd);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !date || !reservation) return null;

  const isLockedDate = isKstTodayOrPast(date);

  const handleStartChange = (nextStart: string) => {
    setNewStart(nextStart);
    const startIndex = fullTimeSlots.indexOf(nextStart);
    const endIndex = newEnd === "24:00" ? fullTimeSlots.length : fullTimeSlots.indexOf(newEnd);

    if (endIndex <= startIndex && startIndex !== -1) {
      const nextEndStr =
        startIndex + 1 === fullTimeSlots.length ? "24:00" : fullTimeSlots[startIndex + 1];
      setNewEnd(nextEndStr);
    }
  };

  const handleCancel = async () => {
    if (isSubmitting) return;
    if (!/^\d{4}$/.test(password)) {
      alert("비밀번호 4자리를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCancelSuccess(reservation.groupId, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModifySubmit = async () => {
    if (isSubmitting) return;
    if (!/^\d{4}$/.test(password)) {
      alert("비밀번호 4자리를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onModifySuccess(reservation.groupId, newStart, newEnd, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startIndexInFull = fullTimeSlots.indexOf(newStart);
  const maxAvailableIndexInFull =
    availableBlock.length > 0
      ? fullTimeSlots.indexOf(availableBlock[availableBlock.length - 1])
      : -1;

  const possibleEndTimes: string[] = [];
  if (startIndexInFull !== -1 && maxAvailableIndexInFull !== -1) {
    for (let i = startIndexInFull + 1; i <= maxAvailableIndexInFull + 1; i++) {
      possibleEndTimes.push(i === fullTimeSlots.length ? "24:00" : fullTimeSlots[i]);
    }
  }

  const effectiveEnd = possibleEndTimes.includes(newEnd)
    ? newEnd
    : (possibleEndTimes[0] ?? currentEnd);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 bg-slate-800 text-white">
          <h2 className="text-lg font-bold">예약 정보 관리</h2>
          <p className="text-sm opacity-90">
            {format(date, "M월 d일 (E)", { locale: ko })} {currentStart} ~ {currentEnd}
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
            <span className="font-semibold text-gray-700">{reservation.teamName}</span>
            <span className="text-gray-500 text-sm">{reservation.bookerName}</span>
          </div>

          {isLockedDate ? (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-100">
              당일에는 취소나 변경이 불가합니다.
            </div>
          ) : (
            <>
              {isEditMode && (
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-blue-900">시간 수정</h3>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">시작</label>
                      <select
                        disabled={isSubmitting}
                        className="w-full border border-gray-300 rounded p-2 text-sm outline-none disabled:bg-gray-100"
                        value={newStart}
                        onChange={(e) => handleStartChange(e.target.value)}
                      >
                        {availableBlock.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center pt-5 text-gray-400">~</div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">종료</label>
                      <select
                        disabled={isSubmitting}
                        className="w-full border border-gray-300 rounded p-2 text-sm outline-none disabled:bg-gray-100"
                        value={effectiveEnd}
                        onChange={(e) => setNewEnd(e.target.value)}
                      >
                        {possibleEndTimes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  권한 확인 (비밀번호)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  disabled={isSubmitting}
                  maxLength={4}
                  placeholder="비밀번호 4자리"
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-slate-800 disabled:bg-gray-100"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>

              <div className="flex gap-2 mt-2">
                {!isEditMode ? (
                  <>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleCancel}
                      className="flex-1 min-h-11 py-2.5 rounded-lg font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? "취소 중..." : "예약 전체 취소"}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsEditMode(true)}
                      className="flex-1 min-h-11 py-2.5 rounded-lg font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      시간 수정
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsEditMode(false)}
                      className="flex-1 min-h-11 py-2.5 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      이전
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleModifySubmit}
                      className="flex-2 min-h-11 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? "저장 중..." : "변경 내용 저장"}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="mt-1 w-full min-h-11 py-2.5 rounded-lg font-medium text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
