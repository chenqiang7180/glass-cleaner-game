/**
 * Constants.ts - 全局常量定义
 * 集中管理游戏中的所有常量，避免魔法数字
 */

/** 游戏状态枚举 */
export enum GameState {
    MENU = 'menu',
    PLAYING = 'playing',
    PAUSED = 'paused',
    SUCCESS = 'success',
    FAILED = 'failed',
}

/** 关卡流程状态 */
export enum LevelState {
    INIT = 'init',
    PLAYING = 'playing',
    SUCCESS = 'success',
    FAILED = 'failed',
}

/** NPC 状态枚举 */
export enum NPCState {
    IDLE = 'idle',
    WALKING = 'walking',
    APPROACHING_WINDOW = 'approaching_window',
    OPENING_WINDOW = 'opening_window',
    CLOSING_WINDOW = 'closing_window',
}

/** 失败原因 */
export enum FailReason {
    WINDOW_OPENED = 'window_opened',   // NPC开窗导致掉落
    TIME_OUT = 'time_out',              // 时间耗尽
}

/** 游戏事件名 */
export enum GameEvent {
    // 关卡事件
    LEVEL_START = 'level_start',
    LEVEL_SUCCESS = 'level_success',
    LEVEL_FAILED = 'level_failed',
    LEVEL_RETRY = 'level_retry',

    // 窗户事件
    WINDOW_OPENING = 'window_opening',       // 窗户即将打开（预警）
    WINDOW_OPENED = 'window_opened',          // 窗户已打开（判定点）
    WINDOW_CLOSING = 'window_closing',
    WINDOW_CLOSED = 'window_closed',

    // 玩家事件
    PLAYER_FALL = 'player_fall',
    PLAYER_MOVE = 'player_move',
    PLAYER_SWITCH_WINDOW = 'player_switch_window',

    // 进度事件
    PROGRESS_UPDATE = 'progress_update',
}

/** 设计分辨率 */
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

/** RenderTexture 相关 */
export const RT_SIZE = 512;                 // RenderTexture 尺寸
export const PROGRESS_SAMPLE_INTERVAL = 0.5; // 进度采样间隔(秒)
export const PROGRESS_SAMPLE_STEP = 4;      // 采样步长(像素)

/** 擦窗笔刷 */
export const BRUSH_RADIUS = 30;             // 笔刷半径(像素)

/** NPC 默认配置 */
export const NPC_DEFAULT = {
    WALK_SPEED: 60,
    OPEN_INTERVAL_MIN: 5,
    OPEN_INTERVAL_MAX: 12,
    OPEN_DURATION_MIN: 1.5,
    OPEN_DURATION_MAX: 3,
    OPEN_PROBABILITY: 0.3,
    WARNING_TIME: 0.8,      // 开窗前预警时间
    DECISION_INTERVAL: 2,   // 决策判定间隔(秒)
};

/** 倒计时 */
export const COUNTDOWN_URGENT_TIME = 10; // 最后N秒进入紧急状态
