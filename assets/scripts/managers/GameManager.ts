/**
 * GameManager.ts - 游戏全局管理器
 * 管理游戏生命周期、全局状态、界面切换
 *
 * 存档策略：
 * - 微信小游戏环境：wx.setStorageSync / wx.getStorageSync
 * - 浏览器环境：localStorage
 * - 自动检测环境并选择对应API
 */
import { _decorator, Component, Node, director } from 'cc';
import { GameState, GameEvent } from '../utils/Constants';
const { ccclass, property } = _decorator;

/** 微信小游戏API类型声明 */
declare const wx: any;

/** 存档key */
const SAVE_KEY = 'glass_cleaner_unlocked';
const SAVE_KEY_STAR_PREFIX = 'glass_cleaner_star_';

@ccclass('GameManager')
export class GameManager extends Component {

    /** 单例 */
    public static instance: GameManager | null = null;

    /** 当前游戏状态 */
    private _gameState: GameState = GameState.MENU;

    /** 各界面层节点 */
    @property(Node)
    public menuLayer: Node | null = null;

    @property(Node)
    public gameLayer: Node | null = null;

    @property(Node)
    public resultLayer: Node | null = null;

    /** 当前关卡ID */
    private _currentLevelId: number = 1;

    /** 已解锁的最高关卡 */
    private _unlockedLevel: number = 1;

    /** 各关卡星数 (levelId → stars 1~3) */
    private _levelStars: Map<number, number> = new Map();

    /** 最大关卡数 */
    private readonly _maxLevelId: number = 5;

    /** 是否微信小游戏环境 */
    private _isWechat: boolean = false;

    public get gameState(): GameState {
        return this._gameState;
    }

    public get currentLevelId(): number {
        return this._currentLevelId;
    }

    public get unlockedLevel(): number {
        return this._unlockedLevel;
    }

    public get maxLevelId(): number {
        return this._maxLevelId;
    }

    onLoad() {
        // 单例初始化
        if (GameManager.instance && GameManager.instance !== this) {
            this.node.destroy();
            return;
        }
        GameManager.instance = this;
        director.addPersistRootNode(this.node);

        // 检测微信小游戏环境
        this._isWechat = typeof wx !== 'undefined';

        // 加载存档
        this._loadProgress();

        // 显示主菜单
        this.showMenu();
    }

    onDestroy() {
        if (GameManager.instance === this) {
            GameManager.instance = null;
        }
    }

    /** 显示主菜单 */
    public showMenu(): void {
        this._gameState = GameState.MENU;
        this._setLayerActive(true, false, false);
    }

    /** 开始指定关卡 */
    public startLevel(levelId: number): void {
        if (levelId < 1 || levelId > this._maxLevelId) {
            console.warn(`[GameManager] Invalid level: ${levelId}`);
            return;
        }

        if (levelId > this._unlockedLevel) {
            console.warn(`[GameManager] Level ${levelId} is locked`);
            return;
        }

        this._currentLevelId = levelId;
        this._gameState = GameState.PLAYING;
        this._setLayerActive(false, true, false);

        // 通知关卡开始
        director.getEventTarget().emit(GameEvent.LEVEL_START, levelId);
    }

    /** 关卡成功 */
    public onLevelSuccess(): void {
        this._gameState = GameState.SUCCESS;

        // 解锁下一关
        if (this._currentLevelId >= this._unlockedLevel && this._currentLevelId < this._maxLevelId) {
            this._unlockedLevel = this._currentLevelId + 1;
        }

        // 计算星数（基于进度和时间）
        // 3星: 进度100% 且 用时 < 50%时限
        // 2星: 进度100% 或 用时 < 75%时限
        // 1星: 其他
        const stars = 1; // 简化版，后续可以加更精细的评分
        this._setLevelStar(this._currentLevelId, stars);

        this._saveProgress();
        this._setLayerActive(false, false, true);
    }

    /** 关卡失败 */
    public onLevelFailed(): void {
        this._gameState = GameState.FAILED;
        this._setLayerActive(false, false, true);
    }

    /** 重试当前关卡 */
    public retryLevel(): void {
        this._gameState = GameState.PLAYING;
        this._setLayerActive(false, true, false);
        director.getEventTarget().emit(GameEvent.LEVEL_RETRY, this._currentLevelId);
    }

    /** 返回主菜单 */
    public backToMenu(): void {
        this.showMenu();
    }

    /** 获取关卡星数 */
    public getLevelStars(levelId: number): number {
        return this._levelStars.get(levelId) ?? 0;
    }

    /** 是否已解锁 */
    public isLevelUnlocked(levelId: number): boolean {
        return levelId <= this._unlockedLevel;
    }

    /** 设置关卡星数 */
    private _setLevelStar(levelId: number, stars: number): void {
        const current = this._levelStars.get(levelId) ?? 0;
        if (stars > current) {
            this._levelStars.set(levelId, stars);
        }
    }

    /** 设置界面层显隐 */
    private _setLayerActive(menu: boolean, game: boolean, result: boolean): void {
        if (this.menuLayer) this.menuLayer.active = menu;
        if (this.gameLayer) this.gameLayer.active = game;
        if (this.resultLayer) this.resultLayer.active = result;
    }

    /** 加载本地存档 */
    private _loadProgress(): void {
        try {
            let unlockedStr: string | null = null;

            if (this._isWechat) {
                unlockedStr = wx.getStorageSync(SAVE_KEY) || null;
            } else {
                unlockedStr = localStorage.getItem(SAVE_KEY);
            }

            if (unlockedStr) {
                this._unlockedLevel = parseInt(unlockedStr, 10) || 1;
            }

            // 加载星数
            for (let i = 1; i <= this._maxLevelId; i++) {
                let starStr: string | null = null;
                if (this._isWechat) {
                    starStr = wx.getStorageSync(`${SAVE_KEY_STAR_PREFIX}${i}`) || null;
                } else {
                    starStr = localStorage.getItem(`${SAVE_KEY_STAR_PREFIX}${i}`);
                }
                if (starStr) {
                    this._levelStars.set(i, parseInt(starStr, 10) || 0);
                }
            }
        } catch (e) {
            console.warn('[GameManager] Failed to load progress:', e);
        }
    }

    /** 保存进度 */
    private _saveProgress(): void {
        try {
            if (this._isWechat) {
                wx.setStorageSync(SAVE_KEY, String(this._unlockedLevel));
                for (const [levelId, stars] of this._levelStars) {
                    wx.setStorageSync(`${SAVE_KEY_STAR_PREFIX}${levelId}`, String(stars));
                }
            } else {
                localStorage.setItem(SAVE_KEY, String(this._unlockedLevel));
                for (const [levelId, stars] of this._levelStars) {
                    localStorage.setItem(`${SAVE_KEY_STAR_PREFIX}${levelId}`, String(stars));
                }
            }
        } catch (e) {
            console.warn('[GameManager] Failed to save progress:', e);
        }
    }
}
