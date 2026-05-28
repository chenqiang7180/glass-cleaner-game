/**
 * WindowController.ts - 窗户状态管理组件
 * 每面窗户一个实例，管理：脏层/净层切换、开窗动画、NPC区域
 *
 * 设计要点：
 * - 开窗锁：同一窗户同时只能有一个NPC操作
 * - 状态机：CLOSED → WARNING → OPENING → OPEN → CLOSING → CLOSED
 * - 关窗后自动重置所有动画状态
 */
import { _decorator, Component, Node, Sprite, RenderTexture, Vec3, tween, UITransform, director } from 'cc';
import { GameEvent, BRUSH_RADIUS } from '../utils/Constants';
import { IWindowConfig } from '../utils/ILevelConfig';
import { WindowCleaner } from './WindowCleaner';
import { AudioManager, SoundName } from '../managers/AudioManager';
import { WechatAdapter } from '../utils/WechatAdapter';
const { ccclass, property } = _decorator;

/** 窗户状态 */
export enum WindowState {
    CLOSED = 'closed',
    WARNING = 'warning',     // 开窗预警（闪烁）
    OPENING = 'opening',     // 正在打开
    OPEN = 'open',           // 已打开
    CLOSING = 'closing',     // 正在关闭
}

@ccclass('WindowController')
export class WindowController extends Component {

    /** 窗户ID */
    public windowId: string = '';

    /** 窗户配置 */
    private _config: IWindowConfig | null = null;

    /** 当前窗户状态 */
    private _state: WindowState = WindowState.CLOSED;

    /** 干净层 Sprite（底层，显示清晰的玻璃） */
    private _cleanBG: Sprite | null = null;

    /** 脏层 Sprite（上层，显示 RenderTexture 脏效果） */
    private _dirtyLayer: Sprite | null = null;

    /** 窗框 Sprite */
    private _windowFrame: Sprite | null = null;

    /** NPC活动区域 */
    private _npcArea: Node | null = null;

    /** 预警闪烁节点 */
    private _warningNode: Node | null = null;

    /** 擦窗核心组件 */
    private _cleaner: WindowCleaner | null = null;

    /** 窗户在 BuildingFloor 中的位置和尺寸 */
    private _position: Vec3 = new Vec3();
    private _size: { width: number; height: number } = { width: 300, height: 400 };

    /** 开窗预警的 tween 引用（用于清理） */
    private _warningTween: any = null;

    /** 开窗动画的 tween 引用 */
    private _openTween: any = null;

    /** 关窗动画的 tween 引用 */
    private _closeTween: any = null;

    /** 预警闪烁的脏层 tween */
    private _dirtyBlinkTween: any = null;

    /** 预警定时器ID */
    private _warningScheduleId: string = 'warning_open';

    /** 开窗锁：为true时其他NPC不能操作这面窗 */
    private _windowLocked: boolean = false;

    public get state(): WindowState {
        return this._state;
    }

    public get isWindowOpen(): boolean {
        return this._state === WindowState.OPEN || this._state === WindowState.OPENING;
    }

    public get isWindowWarning(): boolean {
        return this._state === WindowState.WARNING;
    }

    /** 窗户是否被锁定（正在被某个NPC操作） */
    public get isLocked(): boolean {
        return this._windowLocked;
    }

    public get cleaner(): WindowCleaner | null {
        return this._cleaner;
    }

    public get npcArea(): Node | null {
        return this._npcArea;
    }

    public get windowSize(): { width: number; height: number } {
        return this._size;
    }

    /**
     * 设置视觉节点引用
     * 由 NodeFactory 创建窗户节点后调用
     */
    public setupVisuals(
        cleanBG: Sprite | null,
        dirtyLayer: Sprite | null,
        windowFrame: Sprite | null,
        npcArea: Node | null,
        warningNode: Node | null
    ): void {
        this._cleanBG = cleanBG;
        this._dirtyLayer = dirtyLayer;
        this._windowFrame = windowFrame;
        this._npcArea = npcArea;
        this._warningNode = warningNode;
    }

    /**
     * 初始化窗户
     * @param config 窗户配置
     */
    public init(config: IWindowConfig): void {
        this._config = config;
        this.windowId = config.id;

        // 设置位置和尺寸
        this._position.set(config.position[0], config.position[1], 0);
        this._size = { width: config.size[0], height: config.size[1] };
        this.node.setPosition(this._position);

        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(this._size.width, this._size.height);
        }

        this._state = WindowState.CLOSED;
        this._windowLocked = false;

        // 初始化擦窗系统
        this._cleaner = this.node.addComponent(WindowCleaner);
        this._cleaner.init(this._size.width, this._size.height, this._dirtyLayer);

        // 隐藏预警
        if (this._warningNode) {
            this._warningNode.active = false;
        }
    }

    /**
     * 在指定位置擦窗（代理到 WindowCleaner）
     * @param localX 窗户局部坐标 X
     * @param localY 窗户局部坐标 Y
     */
    public cleanAt(localX: number, localY: number): void {
        if (this._cleaner) {
            this._cleaner.cleanAt(localX, localY, BRUSH_RADIUS);
        }
    }

    /** 触摸结束，通知 cleaner 重置插值 */
    public onCleanEnd(): void {
        if (this._cleaner) {
            this._cleaner.onCleanEnd();
        }
    }

    /**
     * 获取当前窗户的清洁进度
     */
    public getCleanProgress(): number {
        return this._cleaner ? this._cleaner.cleanProgress : 0;
    }

    /**
     * 获取窗户的世界坐标范围
     * 用于判断玩家是否在窗户内
     */
    public getWindowBounds(): { left: number; right: number; top: number; bottom: number } {
        const pos = this.node.getWorldPosition();
        return {
            left: pos.x - this._size.width / 2,
            right: pos.x + this._size.width / 2,
            top: pos.y + this._size.height / 2,
            bottom: pos.y - this._size.height / 2,
        };
    }

    /**
     * 判断世界坐标点是否在窗户范围内
     */
    public isPointInWindow(worldPos: Vec3): boolean {
        const bounds = this.getWindowBounds();
        return worldPos.x >= bounds.left && worldPos.x <= bounds.right &&
            worldPos.y >= bounds.bottom && worldPos.y <= bounds.top;
    }

    /**
     * 开始开窗预警
     * 由 NPCController 在决定开窗时调用
     * @param warningTime 预警持续时间(秒)
     */
    public startWarning(warningTime: number): void {
        // 加锁
        if (this._windowLocked) return;
        this._windowLocked = true;

        this._state = WindowState.WARNING;

        // 震动预警（轻微）
        const wechatAdapter = WechatAdapter.instance;
        if (wechatAdapter) {
            wechatAdapter.vibrateShort();
        }

        // 预警视觉效果1：窗户边框闪烁变红
        if (this._warningNode) {
            this._warningNode.active = true;
            // 先重置scale
            this._warningNode.setScale(1, 1, 1);

            const blinkCount = Math.ceil(warningTime / 0.3);
            this._warningTween = tween(this._warningNode)
                .repeat(blinkCount,
                    tween(this._warningNode)
                        .to(0.1, { scale: new Vec3(1.08, 1.08, 1) })
                        .to(0.1, { scale: new Vec3(0.95, 0.95, 1) })
                )
                .call(() => {
                    if (this._warningNode) {
                        this._warningNode.active = false;
                        this._warningNode.setScale(1, 1, 1);
                    }
                })
                .start();
        }

        // 预警视觉效果2：脏层闪烁抖动（让玩家注意到这面窗户即将打开）
        if (this._dirtyLayer) {
            this._dirtyLayer.node.setScale(1, 1, 1);
            this._dirtyBlinkTween = tween(this._dirtyLayer.node)
                .repeat(4,
                    tween(this._dirtyLayer.node)
                        .to(0.08, { scale: new Vec3(1.03, 1.03, 1) })
                        .to(0.08, { scale: new Vec3(0.97, 0.97, 1) })
                )
                .call(() => {
                    if (this._dirtyLayer) {
                        this._dirtyLayer.node.setScale(1, 1, 1);
                    }
                })
                .start();
        }

        // 预警结束 → 开窗
        this.scheduleOnce(() => {
            this._openWindow();
        }, warningTime);
    }

    /**
     * 打开窗户（内部调用，由预警定时器触发）
     */
    private _openWindow(): void {
        this._state = WindowState.OPENING;

        // 发出开窗事件（判定点：玩家是否在这面窗户上）
        director.getEventTarget().emit(GameEvent.WINDOW_OPENING, this.windowId);

        // 开窗动画：窗框向上翻转消失（模拟窗户向外推开）
        const animDuration = 0.25;
        if (this._windowFrame) {
            this._windowFrame.node.setScale(1, 1, 1);
            this._windowFrame.node.angle = 0;
            if (this._openTween) this._openTween.stop();
            this._openTween = tween(this._windowFrame.node)
                .to(animDuration, { scale: new Vec3(1, 0.05, 1), angle: -15 }, { easing: 'backIn' })
                .call(() => {
                    this._state = WindowState.OPEN;
                    director.getEventTarget().emit(GameEvent.WINDOW_OPENED, this.windowId);
                })
                .start();
        }

        // 同时让脏层也翻转（窗户打开了，整面玻璃都翻出去）
        if (this._dirtyLayer) {
            this._dirtyLayer.node.setScale(1, 1, 1);
            this._dirtyLayer.node.angle = 0;
            tween(this._dirtyLayer.node)
                .to(animDuration, { scale: new Vec3(1, 0.05, 1), angle: -15 }, { easing: 'backIn' })
                .start();
        }

        // 让底层也翻转
        if (this._cleanBG) {
            this._cleanBG.node.setScale(1, 1, 1);
            this._cleanBG.node.angle = 0;
            tween(this._cleanBG.node)
                .to(animDuration, { scale: new Vec3(1, 0.05, 1), angle: -15 }, { easing: 'backIn' })
                .start();
        }
    }

    /**
     * 关闭窗户
     * 由 NPCController 在开窗持续时间结束后调用
     * @param delay 关闭前等待时间(秒)
     */
    public closeWindow(delay: number = 0): void {
        this.scheduleOnce(() => {
            this._state = WindowState.CLOSING;

            const animDuration = 0.3;
            // 关窗动画：窗框恢复正常
            if (this._windowFrame) {
                this._windowFrame.node.setScale(1, 0.05, 1);
                this._windowFrame.node.angle = -15;
                if (this._closeTween) this._closeTween.stop();
                this._closeTween = tween(this._windowFrame.node)
                    .to(animDuration, { scale: new Vec3(1, 1, 1), angle: 0 }, { easing: 'backOut' })
                    .start();
            }

            if (this._dirtyLayer) {
                this._dirtyLayer.node.setScale(1, 0.05, 1);
                this._dirtyLayer.node.angle = -15;
                tween(this._dirtyLayer.node)
                    .to(animDuration, { scale: new Vec3(1, 1, 1), angle: 0 }, { easing: 'backOut' })
                    .start();
            }

            if (this._cleanBG) {
                this._cleanBG.node.setScale(1, 0.05, 1);
                this._cleanBG.node.angle = -15;
                tween(this._cleanBG.node)
                    .to(animDuration, { scale: new Vec3(1, 1, 1), angle: 0 }, { easing: 'backOut' })
                    .call(() => {
                        this._onCloseComplete();
                    })
                    .start();
            } else {
                // 如果没有 cleanBG，用延时设置状态
                this.scheduleOnce(() => {
                    this._onCloseComplete();
                }, animDuration + 0.05);
            }
        }, delay);
    }

    /** 关窗完成 */
    private _onCloseComplete(): void {
        this._state = WindowState.CLOSED;
        this._windowLocked = false;
        director.getEventTarget().emit(GameEvent.WINDOW_CLOSED, this.windowId);

        // 播放关窗音效
        const audioMgr = AudioManager.instance;
        if (audioMgr) {
            audioMgr.play(SoundName.WINDOW_CLOSE);
        }
    }

    /**
     * 重置窗户状态
     */
    public reset(): void {
        this._state = WindowState.CLOSED;
        this._windowLocked = false;
        this.unscheduleAllCallbacks();

        // 停止所有动画
        if (this._warningTween) { this._warningTween.stop(); this._warningTween = null; }
        if (this._openTween) { this._openTween.stop(); this._openTween = null; }
        if (this._closeTween) { this._closeTween.stop(); this._closeTween = null; }
        if (this._dirtyBlinkTween) { this._dirtyBlinkTween.stop(); this._dirtyBlinkTween = null; }

        // 恢复窗框
        if (this._windowFrame) {
            this._windowFrame.node.setScale(1, 1, 1);
            this._windowFrame.node.angle = 0;
        }
        if (this._dirtyLayer) {
            this._dirtyLayer.node.setScale(1, 1, 1);
            this._dirtyLayer.node.angle = 0;
        }
        if (this._cleanBG) {
            this._cleanBG.node.setScale(1, 1, 1);
            this._cleanBG.node.angle = 0;
        }

        // 隐藏预警
        if (this._warningNode) {
            this._warningNode.active = false;
            this._warningNode.setScale(1, 1, 1);
        }

        // 重置擦窗
        if (this._cleaner) {
            this._cleaner.resetDirty();
        }
    }

    onDestroy() {
        this.unscheduleAllCallbacks();
        if (this._warningTween) this._warningTween.stop();
        if (this._openTween) this._openTween.stop();
        if (this._closeTween) this._closeTween.stop();
        if (this._dirtyBlinkTween) this._dirtyBlinkTween.stop();
    }
}
