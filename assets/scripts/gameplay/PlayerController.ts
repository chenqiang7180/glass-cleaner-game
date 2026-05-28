/**
 * PlayerController.ts - 玩家角色控制组件
 * 处理触屏输入 → 角色移动 → 擦窗交互
 * 支持跨窗户移动、掉落动画
 */
import { _decorator, Component, Node, Vec3, Vec2, tween, Tween } from 'cc';
import { TouchInput } from '../components/TouchInput';
import { WindowController } from './WindowController';
import { GameEvent } from '../utils/Constants';
import { AudioManager, SoundName } from '../managers/AudioManager';
import { WechatAdapter } from '../utils/WechatAdapter';
import { director } from 'cc';
const { ccclass, property } = _decorator;

/** 玩家状态 */
export enum PlayerState {
    IDLE = 'idle',
    MOVING = 'moving',
    FALLING = 'falling',
    DEAD = 'dead',
}

@ccclass('PlayerController')
export class PlayerController extends Component {

    /**
     * 触摸输入组件
     * 可以通过编辑器绑定，也可以在 init 时自动创建
     */
    @property(TouchInput)
    public touchInput: TouchInput | null = null;

    /** 触摸监听的目标节点（默认为自身节点，也可以设为全屏节点） */
    private _touchTarget: Node | null = null;

    /** 窗户控制器列表（BuildingFloor下所有WindowController） */
    private _windows: WindowController[] = [];

    /** 当前所在窗户ID */
    private _currentWindowId: string = '';

    /** 玩家状态 */
    private _playerState: PlayerState = PlayerState.IDLE;

    /** 移动速度（像素/秒），通过 touchInput 的 delta 乘以此值 */
    @property
    public moveSpeed: number = 1.5;

    /** 玩家活动范围 Y轴上下界（安全绳约束） */
    private _yMin: number = -Infinity;
    private _yMax: number = Infinity;

    /** 玩家活动范围 X轴左右界（整层楼宽度） */
    private _xMin: number = -Infinity;
    private _xMax: number = Infinity;

    /** 掉落动画的 tween 引用 */
    private _fallTween: Tween | null = null;

    /** 掉落动画是否正在播放 */
    private _fallAnimating: boolean = false;

    /** 上次触摸位置（用于绝对定位模式） */
    private _touchStartPos: Vec2 = new Vec2();
    private _playerStartPos: Vec3 = new Vec3();

    /** 擦窗音效播放间隔 */
    private _lastCleanSoundTime: number = 0;
    private readonly _cleanSoundInterval: number = 0.4;

    public get currentWindowId(): string {
        return this._currentWindowId;
    }

    public get isMoving(): boolean {
        return this._playerState === PlayerState.MOVING;
    }

    public get hasFallen(): boolean {
        return this._playerState === PlayerState.FALLING || this._playerState === PlayerState.DEAD;
    }

    public get playerState(): PlayerState {
        return this._playerState;
    }

    /**
     * 初始化玩家
     * @param windows 所有窗户控制器
     * @param yMin Y轴下界
     * @param yMax Y轴上界
     */
    public init(windows: WindowController[], yMin: number, yMax: number, touchTarget?: Node): void {
        this._windows = windows;
        this._yMin = yMin;
        this._yMax = yMax;
        this._touchTarget = touchTarget || this.node;

        // 如果没有 TouchInput，自动创建并挂载到触摸目标上
        if (!this.touchInput) {
            this.touchInput = this._touchTarget.getComponent(TouchInput)
                || this._touchTarget.addComponent(TouchInput);
        }

        // 计算X轴范围（最左窗户左边界 → 最右窗户右边界）
        if (windows.length > 0) {
            let minX = Infinity;
            let maxX = -Infinity;
            for (const w of windows) {
                const bounds = w.getWindowBounds();
                minX = Math.min(minX, bounds.left);
                maxX = Math.max(maxX, bounds.right);
            }
            this._xMin = minX;
            this._xMax = maxX;
        }

        // 初始位置：最左侧窗户
        this._currentWindowId = windows.length > 0 ? windows[0].windowId : '';

        // 注册触摸回调
        if (this.touchInput) {
            this.touchInput.setMoveCallback(this._onTouchMove.bind(this));
            this.touchInput.setStartCallback(this._onTouchStart.bind(this));
            this.touchInput.setEndCallback(this._onTouchEnd.bind(this));
        }

        this._playerState = PlayerState.IDLE;
    }

    /**
     * 设置初始位置
     * @param position 世界坐标
     */
    public setStartPosition(position: Vec3): void {
        this.node.setWorldPosition(position);
    }

    /** 触摸开始 */
    private _onTouchStart(pos: Vec2): void {
        if (this.hasFallen) return;

        this._playerState = PlayerState.MOVING;
        this._touchStartPos.set(pos.x, pos.y);
        this._playerStartPos = this.node.getWorldPosition();
    }

    /** 触摸移动 — 相对移动模式 */
    private _onTouchMove(delta: Vec2, worldPos: Vec2): void {
        if (this.hasFallen) return;

        // delta 是触摸点的偏移量，直接乘以速度应用到角色
        const currentPos = this.node.getWorldPosition();
        let newX = currentPos.x + delta.x * this.moveSpeed;
        let newY = currentPos.y + delta.y * this.moveSpeed;

        // 边界约束：X轴限制在整层楼范围
        newX = Math.max(this._xMin, Math.min(this._xMax, newX));

        // Y轴限制在窗户高度范围（安全绳约束）
        newY = Math.max(this._yMin, Math.min(this._yMax, newY));

        this.node.setWorldPosition(new Vec3(newX, newY, 0));

        // 更新当前所在窗户
        this._updateCurrentWindow();

        // 擦窗
        this._cleanCurrentWindow();
    }

    /** 触摸结束 */
    private _onTouchEnd(): void {
        if (this.hasFallen) return;

        this._playerState = PlayerState.IDLE;

        // 通知当前窗户结束擦窗（重置插值）
        const windowCtrl = this._findWindow(this._currentWindowId);
        if (windowCtrl) {
            windowCtrl.onCleanEnd();
        }
    }

    /** 更新当前所在窗户 */
    private _updateCurrentWindow(): void {
        const pos = this.node.getWorldPosition();

        for (const w of this._windows) {
            if (w.isPointInWindow(pos)) {
                if (w.windowId !== this._currentWindowId) {
                    const oldWindowId = this._currentWindowId;
                    this._currentWindowId = w.windowId;

                    // 通知旧窗户结束擦窗
                    const oldWindow = this._findWindow(oldWindowId);
                    if (oldWindow) oldWindow.onCleanEnd();

                    director.getEventTarget().emit(
                        GameEvent.PLAYER_SWITCH_WINDOW,
                        oldWindowId, this._currentWindowId
                    );
                }
                return;
            }
        }
    }

    /** 在当前窗户上擦除 */
    private _cleanCurrentWindow(): void {
        const windowCtrl = this._findWindow(this._currentWindowId);
        if (!windowCtrl) return;

        // 如果窗户正在打开或已打开，不允许擦窗（已掉落了）
        if (windowCtrl.isWindowOpen || windowCtrl.isWindowWarning) return;

        // 将玩家世界坐标转换为窗户局部坐标
        const worldPos = this.node.getWorldPosition();
        const windowWorldPos = windowCtrl.node.getWorldPosition();
        const localX = worldPos.x - windowWorldPos.x;
        const localY = worldPos.y - windowWorldPos.y;

        // 调用擦窗
        windowCtrl.cleanAt(localX, localY);

        // 播放擦窗音效（间隔控制，避免每帧播放）
        const now = Date.now();
        if (now - this._lastCleanSoundTime >= this._cleanSoundInterval * 1000) {
            this._lastCleanSoundTime = now;
            const audioMgr = AudioManager.instance;
            if (audioMgr) {
                audioMgr.play(SoundName.CLEAN);
            }
        }

        director.getEventTarget().emit(GameEvent.PLAYER_MOVE, this._currentWindowId);
    }

    /** 查找窗户控制器 */
    private _findWindow(windowId: string): WindowController | null {
        return this._windows.find(w => w.windowId === windowId) ?? null;
    }

    /**
     * 掉落
     * 由 LevelFlow 在检测到 NPC 开窗时调用
     */
    public fall(): void {
        if (this.hasFallen) return;

        this._playerState = PlayerState.FALLING;
        this._fallAnimating = true;

        // 震动反馈
        const wechatAdapter = WechatAdapter.instance;
        if (wechatAdapter) {
            wechatAdapter.vibrateLong();
        }

        // 播放掉落动画：角色下坠 + 缩小 + 旋转
        this._fallTween = tween(this.node)
            .to(0.8, {
                worldPosition: new Vec3(
                    this.node.worldPosition.x,
                    this.node.worldPosition.y - 600,
                    0
                ),
                scale: new Vec3(0.2, 0.2, 1),
                angle: 45,
            }, { easing: 'quadIn' })
            .call(() => {
                this._playerState = PlayerState.DEAD;
                this._fallAnimating = false;
                this._fallTween = null;
                director.getEventTarget().emit(GameEvent.PLAYER_FALL);
            })
            .start();
    }

    /**
     * 重置玩家
     */
    public reset(): void {
        this._playerState = PlayerState.IDLE;
        this._fallAnimating = false;
        this.node.setScale(1, 1, 1);
        this.node.angle = 0;

        // 停止所有 tween
        if (this._fallTween) {
            this._fallTween.stop();
            this._fallTween = null;
        }
        Tween.stopAllByTarget(this.node);
    }
}
