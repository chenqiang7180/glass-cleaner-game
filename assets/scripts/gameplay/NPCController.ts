/**
 * NPCController.ts - NPC AI 控制器
 * 管理NPC在屋内的随机走动和开窗行为
 *
 * 状态机：IDLE ↔ WALKING → APPROACHING → OPENING_WINDOW → CLOSING_WINDOW → IDLE
 *
 * 设计要点：
 * - NPC 可以多次开窗（每次开窗后有独立冷却时间）
 * - NPC 走动时自动翻转朝向
 * - 多个NPC在同一窗户时通过开窗锁协调，避免同时开窗
 */
import { _decorator, Component, Node, Vec3, randomRange, UITransform } from 'cc';
import { NPCState, NPC_DEFAULT } from '../utils/Constants';
import { WindowController, WindowState } from './WindowController';
import { INPCConfig } from '../utils/ILevelConfig';
import { director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('NPCController')
export class NPCController extends Component {

    /** NPC当前状态 */
    private _state: NPCState = NPCState.IDLE;

    /** NPC配置 */
    private _config: INPCConfig | null = null;

    /** NPC所在的窗户控制器 */
    private _assignedWindow: WindowController | null = null;

    /** NPC活动区域宽度 */
    private _areaWidth: number = 300;

    /** NPC活动区域高度 */
    private _areaHeight: number = 200;

    /** 移动目标点 */
    private _targetPos: Vec3 = new Vec3();

    /** 冷却计时器（上次开窗后经过的时间） */
    private _cooldownTimer: number = 0;

    /** 冷却时间（下次可开窗的最小等待） */
    private _cooldownTime: number = 8;

    /** 决策计时器 */
    private _decisionTimer: number = 0;

    /** 待机计时器 */
    private _idleTimer: number = 0;

    /** 开窗持续计时器 */
    private _openDurationTimer: number = 0;

    /** 开窗持续时间 */
    private _openDuration: number = 2;

    /** 开窗次数（本局） */
    private _openCount: number = 0;

    /** 当前朝向：1=右, -1=左 */
    private _facing: number = 1;

    /** Body子节点引用（用于朝向翻转） */
    private _bodyNode: Node | null = null;

    /** Head子节点引用 */
    private _headNode: Node | null = null;

    /** 是否暂停 */
    private _paused: boolean = false;

    public get state(): NPCState {
        return this._state;
    }

    public get openCount(): number {
        return this._openCount;
    }

    /**
     * 初始化NPC
     * @param config NPC配置
     * @param assignedWindow 分配的窗户
     */
    public init(config: INPCConfig, assignedWindow: WindowController): void {
        this._config = config;
        this._assignedWindow = assignedWindow;

        // 设置活动区域
        const uiTransform = assignedWindow.node.getComponent(UITransform);
        if (uiTransform) {
            this._areaWidth = uiTransform.contentSize.width;
            this._areaHeight = 200; // NPC活动区域高度固定
        }

        // 初始冷却时间
        this._cooldownTime = randomRange(
            config.windowOpenInterval.min,
            config.windowOpenInterval.max
        );
        this._cooldownTimer = 0;
        this._decisionTimer = 0;
        this._openCount = 0;

        // 查找 Body / Head 子节点（用于朝向翻转）
        this._bodyNode = this.node.getChildByName('Body');
        this._headNode = this.node.getChildByName('Head');

        this._setState(NPCState.IDLE);
        this._idleTimer = randomRange(1, 3);

        // 设置初始位置（窗户内随机）
        this._setRandomPosition();
    }

    /** 暂停/恢复NPC */
    public setPaused(paused: boolean): void {
        this._paused = paused;
    }

    update(dt: number) {
        if (this._paused) return;

        switch (this._state) {
            case NPCState.IDLE:
                this._updateIdle(dt);
                break;
            case NPCState.WALKING:
                this._updateWalking(dt);
                break;
            case NPCState.APPROACHING_WINDOW:
                this._updateApproaching(dt);
                break;
            case NPCState.OPENING_WINDOW:
                this._updateOpening(dt);
                break;
            case NPCState.CLOSING_WINDOW:
                this._updateClosing(dt);
                break;
        }
    }

    /** 设置状态 */
    private _setState(state: NPCState): void {
        const oldState = this._state;
        this._state = state;

        if (oldState !== state) {
            this._onStateEnter(state);
        }
    }

    /** 状态进入时 */
    private _onStateEnter(state: NPCState): void {
        switch (state) {
            case NPCState.IDLE:
                this._idleTimer = randomRange(1, 3);
                break;
            case NPCState.WALKING:
                this._targetPos = this._getRandomPosInArea();
                this._updateFacing(this._targetPos.x - this.node.position.x);
                break;
            case NPCState.APPROACHING_WINDOW:
                this._targetPos = this._getWindowApproachPos();
                this._updateFacing(this._targetPos.x - this.node.position.x);
                break;
        }
    }

    /** IDLE 状态更新 */
    private _updateIdle(dt: number): void {
        this._idleTimer -= dt;
        this._cooldownTimer += dt;

        if (this._idleTimer <= 0) {
            // 随机走动
            this._setState(NPCState.WALKING);
            return;
        }

        // 冷却结束后判定是否开窗
        if (this._cooldownTimer >= this._cooldownTime) {
            this._decisionTimer += dt;
            if (this._decisionTimer >= NPC_DEFAULT.DECISION_INTERVAL) {
                this._decisionTimer = 0;
                this._tryOpenWindow();
            }
        }
    }

    /** WALKING 状态更新 */
    private _updateWalking(dt: number): void {
        if (!this._config) return;

        const speed = this._config.walkSpeed;
        const currentPos = this.node.position;
        const direction = this._targetPos.clone().subtract(currentPos);
        const distance = direction.length();

        if (distance < 5) {
            // 到达目标点，回到 IDLE
            this._setState(NPCState.IDLE);
            return;
        }

        // 朝目标移动
        direction.normalize();
        const movement = direction.multiplyScalar(speed * dt);
        this.node.setPosition(currentPos.add(movement));

        // 冷却计时（走动时也会累计冷却）
        this._cooldownTimer += dt;
        if (this._cooldownTimer >= this._cooldownTime) {
            this._decisionTimer += dt;
            if (this._decisionTimer >= NPC_DEFAULT.DECISION_INTERVAL) {
                this._decisionTimer = 0;
                this._tryOpenWindow();
            }
        }
    }

    /** 尝试开窗 */
    private _tryOpenWindow(): void {
        if (!this._config) return;

        // 检查窗户是否可以开（不是已经开着的或正在开/关的）
        if (this._assignedWindow) {
            const winState = this._assignedWindow.state;
            if (winState !== WindowState.CLOSED) {
                // 窗户不在关闭状态，不能开窗
                return;
            }
        }

        // 开窗概率判定
        if (Math.random() < this._config.windowOpenProbability) {
            // 决定开窗 → 走向窗户
            this._setState(NPCState.APPROACHING_WINDOW);
        }
    }

    /** APPROACHING_WINDOW 状态更新 */
    private _updateApproaching(dt: number): void {
        if (!this._config) return;

        // 如果窗户状态变了（其他NPC正在操作这面窗），取消靠近
        if (this._assignedWindow && this._assignedWindow.state !== WindowState.CLOSED) {
            this._setState(NPCState.IDLE);
            return;
        }

        const speed = this._config.walkSpeed * 1.2; // 走向窗户时稍快
        const currentPos = this.node.position;
        const direction = this._targetPos.clone().subtract(currentPos);
        const distance = direction.length();

        if (distance < 10) {
            // 到达窗前 → 开始开窗流程
            this._startOpeningWindow();
            return;
        }

        // 朝窗户移动
        direction.normalize();
        const movement = direction.multiplyScalar(speed * dt);
        this.node.setPosition(currentPos.add(movement));
    }

    /** 开始开窗流程 */
    private _startOpeningWindow(): void {
        if (!this._config || !this._assignedWindow) return;

        // 二次确认窗户状态
        if (this._assignedWindow.state !== WindowState.CLOSED) {
            this._setState(NPCState.IDLE);
            return;
        }

        this._setState(NPCState.OPENING_WINDOW);

        // 计算开窗持续时间
        this._openDuration = randomRange(
            this._config.windowOpenDuration.min,
            this._config.windowOpenDuration.max
        );
        this._openDurationTimer = 0;
        this._openCount++;

        // 触发窗户开窗预警 → 预警结束后自动开窗
        this._assignedWindow.startWarning(this._config.warningTimeBeforeOpen);
    }

    /** OPENING_WINDOW 状态更新 */
    private _updateOpening(dt: number): void {
        this._openDurationTimer += dt;

        // 检查窗户是否已经处于 OPEN 状态（开窗动画完成）
        // 等待开窗持续时间结束后关窗
        if (this._openDurationTimer >= this._openDuration) {
            // 关窗
            this._setState(NPCState.CLOSING_WINDOW);
            if (this._assignedWindow) {
                this._assignedWindow.closeWindow();
            }
        }
    }

    /** CLOSING_WINDOW 状态更新 */
    private _updateClosing(dt: number): void {
        // 等待关窗动画完成后回到IDLE
        if (this._assignedWindow && this._assignedWindow.state === WindowState.CLOSED) {
            this._setState(NPCState.IDLE);

            // 重置冷却（可再次开窗）
            if (this._config) {
                this._cooldownTime = randomRange(
                    this._config.windowOpenInterval.min,
                    this._config.windowOpenInterval.max
                );
            }
            this._cooldownTimer = 0;
            this._decisionTimer = 0;
        }
    }

    /** 更新NPC朝向 */
    private _updateFacing(moveDirX: number): void {
        if (moveDirX === 0) return;

        const newFacing = moveDirX > 0 ? 1 : -1;
        if (newFacing !== this._facing) {
            this._facing = newFacing;

            // 翻转 Body 和 Head
            if (this._bodyNode) {
                this._bodyNode.setScale(this._facing, 1, 1);
            }
            if (this._headNode) {
                this._headNode.setScale(this._facing, 1, 1);
            }
        }
    }

    /** 获取区域内随机位置 */
    private _getRandomPosInArea(): Vec3 {
        const x = randomRange(-this._areaWidth / 2 + 20, this._areaWidth / 2 - 20);
        const y = randomRange(-this._areaHeight / 2 + 20, this._areaHeight / 2 - 20);
        return new Vec3(x, y, 0);
    }

    /** 获取窗户前方位置（NPC走过去开窗的位置） */
    private _getWindowApproachPos(): Vec3 {
        // 窗户中央偏下的位置（NPC在屋内，靠近窗户底部中央）
        return new Vec3(
            randomRange(-20, 20),  // 稍微偏移，不完全居中
            this._areaHeight / 2 - 30,
            0
        );
    }

    /** 设置初始随机位置 */
    private _setRandomPosition(): void {
        const pos = this._getRandomPosInArea();
        this.node.setPosition(pos);
    }

    /**
     * 重置NPC
     */
    public reset(): void {
        this._setState(NPCState.IDLE);
        this._idleTimer = randomRange(1, 3);
        this._cooldownTimer = 0;
        this._decisionTimer = 0;
        this._openCount = 0;
        this._paused = false;
        this._setRandomPosition();
    }
}
