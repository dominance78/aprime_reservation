"use client";

import { useState, useEffect } from "react";
import { format, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";

interface ManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancelSuccess: (groupId: string, passwordInput?: string) => void;
  onModifySuccess: (groupId: string, newStart: string, newEnd: string, passwordInput?: string) => void;
  date: Date | null;
  
  // 현재 예약 그룹의 정보
  reservation?: {
    teamName: string;
    bookerName: string;
    groupId: string;
  };
  currentStart: string;
  currentEnd: string;
  
  // 수정 가능한 연속된 빈 슬롯 풀 (현재 예약 슬롯 포함)
  availableBlock: string[];
  // 전체 슬롯 배열 (24:00 계산용)
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

  // 모달이 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setIsEditMode(false);
      setNewStart(currentStart);
      setNewEnd(currentEnd);
    }
  }, [isOpen, currentStart, currentEnd]);

  // 시작 시간이 바뀌면, 유효한 종료 시간 목록에 맞게 종료 시간 조정
  useEffect(() => {
    if (!isOpen) return;
    const startIndex = fullTimeSlots.indexOf(newStart);
    const endIndex = newEnd === "24:00" ? fullTimeSlots.length : fullTimeSlots.indexOf(newEnd);
    
    // 종료 시간이 시작 시간보다 앞서거나 같으면 30분 뒤로 자동 조정
    if (endIndex <= startIndex) {
      const nextEndStr = startIndex + 1 === fullTimeSlots.length ? "24:00" : fullTimeSlots[startIndex + 1];
      setNewEnd(nextEndStr);
    }
  }, [newStart, newEnd, fullTimeSlots, isOpen]);

  if (!isOpen || !date || !reservation) return null;

  const isDday = isSameDay(date, new Date());

  const handleCancel = () => {
    if (password.length !== 4) return alert("비밀번호 4자리를 입력해주세요.");
    // 실제라면 여기서 DB 비밀번호 검증 API 호출
    alert("전체 예약이 취소되었습니다.");
    onCancelSuccess(reservation.groupId, password);
  };

  const handleModifySubmit = () => {
    if (password.length !== 4) return alert("비밀번호 4자리를 입력해주세요.");
    alert("예약 시간이 성공적으로 변경되었습니다.");
    onModifySuccess(reservation.groupId, newStart, newEnd, password);
  };

  // 선택 가능한 종료 시간 계산 (newStart 이후 ~ availableBlock의 끝)
  const startIndexInFull = fullTimeSlots.indexOf(newStart);
  const maxAvailableIndexInFull = fullTimeSlots.indexOf(availableBlock[availableBlock.length - 1]);
  
  const possibleEndTimes: string[] = [];
  if (startIndexInFull !== -1 && maxAvailableIndexInFull !== -1) {
    for (let i = startIndexInFull + 1; i <= maxAvailableIndexInFull + 1; i++) {
      possibleEndTimes.push(i === fullTimeSlots.length ? "24:00" : fullTimeSlots[i]);
    }
  }

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

          {isDday ? (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-100">
              당일에는 취소나 변경이 불가합니다.
            </div>
          ) : (
            <>
              {isEditMode ? (
                // 수정 모드 뷰
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-blue-900">시간 수정</h3>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">시작</label>
                      <select
                        className="w-full border border-gray-300 rounded p-2 text-sm outline-none"
                        value={newStart}
                        onChange={(e) => setNewStart(e.target.value)}
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
                        className="w-full border border-gray-300 rounded p-2 text-sm outline-none"
                        value={newEnd}
                        onChange={(e) => setNewEnd(e.target.value)}
                      >
                        {possibleEndTimes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  권한 확인 (비밀번호)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="비밀번호 4자리"
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-slate-800"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>

              <div className="flex gap-2 mt-2">
                {!isEditMode ? (
                  <>
                    <button
                      onClick={handleCancel}
                      className="flex-1 py-2.5 rounded-lg font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      예약 전체 취소
                    </button>
                    <button
                      onClick={() => setIsEditMode(true)}
                      className="flex-1 py-2.5 rounded-lg font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      시간 수정
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditMode(false)}
                      className="flex-1 py-2.5 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      이전
                    </button>
                    <button
                      onClick={handleModifySubmit}
                      className="flex-[2] py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      변경 내용 저장
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          
          <button
            onClick={onClose}
            className="mt-1 w-full py-2.5 rounded-lg font-medium text-gray-500 hover:bg-gray-100 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
