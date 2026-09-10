export const TEAM_LIST = ['압전소자팀', 'ESG팀', '탄소중립팀', '행정부'] as const;

export type TeamName = typeof TEAM_LIST[number];
