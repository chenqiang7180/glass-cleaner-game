/**
 * ILevelConfig.ts - 关卡配置类型定义
 * 与 resources/levels/level_X.json 一一对应
 */

/** 窗户配置 */
export interface IWindowConfig {
    id: string;
    /** 窗户在楼层中的位置 [x, y] */
    position: [number, number];
    /** 窗户尺寸 [width, height] */
    size: [number, number];
}

/** NPC 配置 */
export interface INPCConfig {
    /** NPC行走速度 */
    walkSpeed: number;
    /** 开窗冷却间隔范围 [最小秒, 最大秒] */
    windowOpenInterval: { min: number; max: number };
    /** 开窗持续时长范围 [最小秒, 最大秒] */
    windowOpenDuration: { min: number; max: number };
    /** 每次判定开窗的概率 */
    windowOpenProbability: number;
    /** 开窗前预警时间(秒) */
    warningTimeBeforeOpen: number;
}

/** 关卡配置 */
export interface ILevelConfig {
    /** 关卡ID */
    levelId: number;
    /** 窗户列表 */
    windows: IWindowConfig[];
    /** NPC数量 */
    npcCount: number;
    /** NPC行为参数 */
    npcConfig: INPCConfig;
    /** 目标清洁进度 (0~1) */
    targetProgress: number;
    /** 时限(秒) */
    timeLimit: number;
}
